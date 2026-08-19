// Fase 1 da Calculadora de Ajudas de Custo — Saneamento do Histórico.
// Ver documento de arquitetura, secção 2, e DECISIONS.md.
//
// Todos os passos são funções puras de leitura — nenhum escreve em
// ajudas_percentagem_historica nem em ajudas_estimativas_fatura sozinho.
// A gravação (com ativo=true, e das linhas históricas) é sempre uma ação
// explícita do admin no ecrã "Histórico", nunca automática.
//
// Fonte de faturas: /api/toconline/relatorio?tipo=vendas (dados ao vivo do
// TOConline), não o espelho local `faturas` — esse espelho só cobre
// faturas pagas/reconciliadas e é usado noutro contexto (Custos). Como a
// % histórica e o rateio precisam de TODAS as faturas de venda emitidas no
// período (independentemente de estarem já pagas), a fonte tem de ser o
// relatório TOConline em tempo real.
//
// Filtro "tipo='cliente'" (pedido explicitamente no âmbito desta etapa):
// não existe um campo `tipo='cliente'` no relatório TOConline — esse
// filtro é específico da tabela local `faturas` (ver CostReports.jsx).
// A intenção equivalente aplicada aqui é: excluir documentos que não são
// faturas de receita (notas de crédito/débito, guias, orçamentos) do
// document_type_name devolvido pelo TOConline, usando a whitelist
// TOCONLINE_TIPOS_RECEITA abaixo. Este mapeamento não foi confirmado
// contra uma resposta real do TOConline nesta sessão — ver o resultado da
// validação em dados reais no resumo final antes de marcar qualquer % como
// ativa.

import { ratearProporcional } from './rateio.js';
import { calcularValoresPorClienteMes, mesSeguinte } from './valoresPorFatura.js';
import { extrairValorObs } from './valorObservacao.js';
import {
  TOCONLINE_TIPOS_RECEITA, fetchVendasTOConline, buscarFaturasVendasPeriodo,
} from './faturasToConline.js';

// Re-exportados por compatibilidade — estas três funções/valor viviam neste
// ficheiro antes de serem extraídas para faturasToConline.js (evitar import
// circular com valoresPorFatura.js, chamado por consolidarTotalReal abaixo).
// extrairValorObs, idem, extraído para valorObservacao.js.
export { TOCONLINE_TIPOS_RECEITA, fetchVendasTOConline, buscarFaturasVendasPeriodo, extrairValorObs };

function listarMesesEntre(periodoInicio, periodoFim) {
  const [anoI, mesI] = periodoInicio.split('-').map(Number);
  const [anoF, mesF] = periodoFim.split('-').map(Number);
  const meses = [];
  let ano = anoI, mes = mesI;
  while (ano < anoF || (ano === anoF && mes <= mesF)) {
    meses.push(`${ano}-${String(mes).padStart(2, '0')}`);
    mes += 1;
    if (mes > 12) { mes = 1; ano += 1; }
  }
  return meses;
}

// Gate fail-closed — tem de ser a primeira verificação, antes de qualquer
// cálculo. Bloqueia se houver cliente com faturas elegíveis-de-receita no
// período e `elegivel_ajudas_custo IS NULL` (ainda por decidir na aba
// Elegibilidade). Nunca calcula uma % parcial ignorando os por decidir.
export async function verificarClientesPorDecidir({ periodoInicio, periodoFim, dbClient, fetchVendasFn }) {
  const { faturas } = await buscarFaturasVendasPeriodo({ periodoInicio, periodoFim, dbClient, fetchVendasFn });

  const vistos = new Set();
  const porDecidir = [];
  for (const f of faturas) {
    if (f.elegivel == null && f.clientId && !vistos.has(f.clientId)) {
      vistos.add(f.clientId);
      porDecidir.push({ clientId: f.clientId, nome: f.clienteNome });
    }
  }

  return { bloqueado: porDecidir.length > 0, clientesPorDecidir: porDecidir };
}

// Passo (a): lê as faturas já emitidas no período e extrai, quando existir,
// o valor de ajuda de custo já preenchido manualmente na observação.
export async function extrairValoresDeObservacoesExistentes({ periodoInicio, periodoFim, dbClient, fetchVendasFn }) {
  const { faturas, semClienteCorrespondente } = await buscarFaturasVendasPeriodo({ periodoInicio, periodoFim, dbClient, fetchVendasFn });
  const comValorManual = faturas.map(f => ({ ...f, valorObservacaoManual: extrairValorObs(f.observacao) }));
  return { faturas: comValorManual, semClienteCorrespondente };
}

// Estados de receipt_validations reconhecidos como "recibo processado e
// utilizável" para o numerador da Fase 1. 'pago' foi confirmado (auditoria
// com o "Relatório de Recibos" oficial) como um recibo válido — a UI trata-o
// como qualquer "Válido", só denota que já foi reconciliado com um
// pagamento. 'aviso' também entra (o relatório oficial inclui-o). Fora ficam
// só 'erro'/'invalido' — recibos que a validação automática rejeitou mesmo.
const ESTADOS_VALIDOS = ['valido', 'pago', 'aviso'];

// worker_id e logs.workerId usam dois esquemas de prefixo diferentes
// consoante a era em que o trabalhador foi criado ('w<digitos>' vs
// 'worker_<digitos>') — para comparar se é o mesmo trabalhador entre as
// duas tabelas, reduz-se a um núcleo numérico comum.
// Exportado para reutilização em reconciliacao.js (verificarMesFechavel) —
// mesma normalização de worker_id/logs.workerId, nunca uma segunda cópia.
export function normalizarWorkerId(id) {
  const m = String(id || '').match(/\d+$/);
  return m ? m[0] : String(id || '');
}

// Passo (b) — MUDANÇA DE MÉTODO: o numerador já não vem de uma atribuição
// por horas em `logs` (distribuicaoHoras.js). Passa a vir do valor
// declarado na observação de cada fatura (calcularValoresPorClienteMes,
// valoresPorFatura.js), com rateio proporcional ao valor da fatura para as
// faturas sem valor declarado. Corre mês a mês, contínuo (não só no
// saneamento inicial) — ver DECISIONS.md.
//
// Resíduo CUMULATIVO: os meses são processados em ordem cronológica,
// mantendo um saldoAcumulado que persiste entre meses — um resíduo negativo
// isolado num mês não é uma anomalia; transporta-se para o mês seguinte até
// ser absorvido (ou não) por faturas sem valor declarado. Só um saldo
// negativo no FIM do período inteiro é uma anomalia real a investigar
// (`anomaliaSaldoFinalNegativo`).
//
// O mês mais recente do período, se cair no mês corrente (ou futuro) por
// via do duplo desvio M→M-1 (a fatura que declara o seu trabalho ainda não
// fechou), fica em `mesesComDadosInsuficientes` — não participa do fecho
// normal (não altera saldoAcumulado, não soma para totalReal).
//
// totalReal(periodo) = soma de valor_atribuido, SÓ das linhas cujo
// elegivel_na_data (snapshot do momento do cálculo) é true — mesmo
// critério de âmbito partilhado numerador/denominador de antes, só que
// aplicado por fatura em vez de por atribuição de horas.
//
// `semLogs`/`totalSemLogs`/`atribuicoesHistoricas`/`semWorkerId`/
// `totalSemWorkerId`/`naoElegivel`/`totalNaoElegivel` deixam de ter
// conteúdo — eram específicos do método antigo (distribuicaoHoras.js), que
// já não corre aqui. Mantidos na forma (arrays/números vazios) só para não
// partir chamadores que ainda desestruturem estes campos; nenhum ecrã os
// lê atualmente.
//
// O gate de completude (`mesesIncluidos`/`mesesExcluidos` — aviso quando um
// trabalhador tem horas no mês de referência `mes` sem NENHUM
// receipt_validations que reporte esse trabalho) usa agora o MESMO duplo
// desvio já validado no resto do módulo: um trabalhador com horas em `mes`
// (logs.date) só conta como "com recibo" se existir receipt_validations
// com mes = mesSeguinte(mes) — o recibo processado no mês seguinte é que
// reporta o trabalho de `mes`, não um receipt_validations com o mesmo mes.
export async function consolidarTotalReal({ periodoInicio, periodoFim, dbClient, fetchVendasFn }) {
  const meses = listarMesesEntre(periodoInicio, periodoFim);

  let totalReal = 0;
  let saldoAcumulado = 0;
  const linhasPorMes = [];
  const historicoSaldo = [];
  const mesesComDadosInsuficientes = [];

  for (const mes of meses) {
    const r = await calcularValoresPorClienteMes({ mes, dbClient, fetchVendasFn, saldoAcumuladoEntrada: saldoAcumulado });

    if (r.dadosInsuficientes) {
      mesesComDadosInsuficientes.push({ mes, mesFatura: r.mesFatura });
      continue; // não participa do fecho normal — saldoAcumulado não muda
    }

    saldoAcumulado = r.saldoAcumuladoSaida;
    historicoSaldo.push({
      mes, mesFatura: r.mesFatura, totalRealRecibos: r.totalRealRecibos, totalDeclarado: r.totalDeclarado,
      residuoBruto: r.residuoBruto, saldoAcumuladoSaida: r.saldoAcumuladoSaida,
    });

    const totalMesElegivel = r.linhas
      .filter(l => l.elegivel_na_data === true)
      .reduce((s, l) => s + l.valor_atribuido, 0);
    totalReal += totalMesElegivel;
    linhasPorMes.push(...r.linhas);
  }

  const [{ data: validations, error: errV }, { data: logs, error: errL }] = await Promise.all([
    dbClient.from('receipt_validations').select('worker_id, mes')
      .gte('mes', mesSeguinte(periodoInicio)).lte('mes', mesSeguinte(periodoFim)),
    dbClient.from('logs').select('workerId, date')
      .gte('date', `${periodoInicio}-01`).lte('date', `${periodoFim}-31`),
  ]);
  if (errV) throw errV;
  if (errL) throw errL;

  const workersDoMesNormalizado = new Map(); // mes (referência) -> Map(idNormalizado -> idOriginal)
  for (const l of logs || []) {
    if (!l.workerId || !l.date) continue;
    const mes = l.date.slice(0, 7);
    if (!workersDoMesNormalizado.has(mes)) workersDoMesNormalizado.set(mes, new Map());
    workersDoMesNormalizado.get(mes).set(normalizarWorkerId(l.workerId), l.workerId);
  }

  const idsComValidacaoPorMes = new Map(); // v.mes (mês do recibo, = mesSeguinte da referência) -> Set(idNormalizado)
  for (const v of validations || []) {
    if (!idsComValidacaoPorMes.has(v.mes)) idsComValidacaoPorMes.set(v.mes, new Set());
    idsComValidacaoPorMes.get(v.mes).add(normalizarWorkerId(v.worker_id));
  }

  const mesesIncluidos = [];
  const mesesExcluidos = [];

  for (const mes of meses) {
    const workersDoMes = workersDoMesNormalizado.get(mes) || new Map();
    // O recibo que reporta o trabalho de `mes` tem mes = mesSeguinte(mes) —
    // mesmo duplo desvio já usado em calcularValoresPorClienteMes.
    const idsValidados = idsComValidacaoPorMes.get(mesSeguinte(mes)) || new Set();
    const semRecibo = [...workersDoMes.entries()]
      .filter(([idNorm]) => !idsValidados.has(idNorm))
      .map(([, idOriginal]) => idOriginal);

    if (semRecibo.length > 0) {
      mesesExcluidos.push({
        mes,
        motivo: `${semRecibo.length} trabalhador(es) com horas registadas sem NENHUM receipt_validations processado (aviso — não remove o mês do total): ${semRecibo.join(', ')}`,
      });
    } else {
      mesesIncluidos.push(mes);
    }
  }

  return {
    totalReal,
    mesesIncluidos,
    mesesExcluidos,
    linhasPorMes,
    historicoSaldo,
    mesesComDadosInsuficientes,
    saldoAcumuladoFinal: saldoAcumulado,
    anomaliaSaldoFinalNegativo: saldoAcumulado < 0,
    // Campos do método antigo (distribuicaoHoras.js) — ver nota acima.
    semLogs: [],
    totalSemLogs: 0,
    atribuicoesHistoricas: [],
    semWorkerId: [],
    totalSemWorkerId: 0,
    naoElegivel: [],
    totalNaoElegivel: 0,
  };
}

// Filtra as faturas para o subconjunto de clientes elegíveis
// (elegivel_ajudas_custo === true). É este subconjunto, e só este, que
// deve alimentar totalFaturamento antes de chamar calcularPercentagemHistorica.
export function filtrarFaturasElegiveis(faturas) {
  return (faturas || []).filter(f => f.elegivel === true);
}

// Passo (d): rateia o total REAL (não o faturamento) por todas as faturas
// elegíveis do período, proporcionalmente ao valor de cada fatura — tenham
// ou não valor manual prévio na observação. Devolve linhas prontas para
// gravar em ajudas_estimativas_fatura (origem:'historico'); não grava.
export function ratearHistorico({ totalReal, faturasElegiveisDoPeriodo }) {
  const rateadas = ratearProporcional(totalReal, faturasElegiveisDoPeriodo);
  return rateadas.map(f => ({
    mes: f.mes,
    client_id: f.clientId,
    fatura_id: f.faturaId,
    valor_estimado_bruto: f.valorRateado,
    valor_final: f.valorRateado,
    valor_observacao_manual: f.valorObservacaoManual ?? null,
    origem: 'historico',
    status: 'historico',
  }));
}

// Passo (e): calcula a percentagem. totalFaturamento TEM de já vir filtrado
// por clientes elegíveis (filtrarFaturasElegiveis) — esta função não filtra
// nada, só divide.
export function calcularPercentagemHistorica({ totalReal, totalFaturamento }) {
  if (!(totalFaturamento > 0)) {
    return { percentagem: 0, totalAjudasReal: totalReal, totalBrutoReferencia: totalFaturamento };
  }
  return {
    percentagem: totalReal / totalFaturamento,
    totalAjudasReal: totalReal,
    totalBrutoReferencia: totalFaturamento,
  };
}

// Orquestrador usado pelo ecrã "Histórico": corre o gate primeiro; se
// bloqueado, devolve de imediato sem tocar nos passos seguintes. Se livre,
// corre os 4 passos e devolve tudo o que o ecrã precisa para a
// pré-visualização (nada é gravado por esta função).
export async function executarCalculoFase1({ periodoInicio, periodoFim, dbClient, fetchVendasFn }) {
  const { faturas, semClienteCorrespondente } = await buscarFaturasVendasPeriodo({ periodoInicio, periodoFim, dbClient, fetchVendasFn });

  const vistos = new Set();
  const porDecidir = [];
  for (const f of faturas) {
    if (f.elegivel == null && f.clientId && !vistos.has(f.clientId)) {
      vistos.add(f.clientId);
      porDecidir.push({ clientId: f.clientId, nome: f.clienteNome });
    }
  }
  if (porDecidir.length > 0) {
    return { bloqueado: true, clientesPorDecidir: porDecidir };
  }

  const faturasComObs = faturas.map(f => ({ ...f, valorObservacaoManual: extrairValorObs(f.observacao) }));
  const faturasElegiveisDoPeriodo = filtrarFaturasElegiveis(faturasComObs);

  const {
    totalReal, mesesIncluidos, mesesExcluidos, linhasPorMes,
    historicoSaldo, mesesComDadosInsuficientes, saldoAcumuladoFinal, anomaliaSaldoFinalNegativo,
    semLogs, totalSemLogs, atribuicoesHistoricas, semWorkerId, totalSemWorkerId,
    naoElegivel, totalNaoElegivel,
  } = await consolidarTotalReal({ periodoInicio, periodoFim, dbClient, fetchVendasFn });

  const totalFaturamento = faturasElegiveisDoPeriodo.reduce((s, f) => s + f.valor, 0);
  const { percentagem, totalAjudasReal, totalBrutoReferencia } = calcularPercentagemHistorica({ totalReal, totalFaturamento });

  const linhasHistoricas = ratearHistorico({ totalReal, faturasElegiveisDoPeriodo });
  const clientesElegiveis = [...new Set(faturasElegiveisDoPeriodo.map(f => f.clientId))];

  return {
    bloqueado: false,
    percentagem,
    totalAjudasReal,
    totalBrutoReferencia,
    mesesIncluidos,
    mesesExcluidos,
    clientesElegiveis,
    linhasHistoricas,
    semClienteCorrespondente,
    linhasPorMes,
    historicoSaldo,
    mesesComDadosInsuficientes,
    saldoAcumuladoFinal,
    anomaliaSaldoFinalNegativo,
    semLogs,
    totalSemLogs,
    atribuicoesHistoricas,
    semWorkerId,
    totalSemWorkerId,
    naoElegivel,
    totalNaoElegivel,
  };
}
