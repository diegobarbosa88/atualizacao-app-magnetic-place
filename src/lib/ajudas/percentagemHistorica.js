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
import { fetchTudoPaginado } from './paginacao.js';
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

  // Paginado (fetchTudoPaginado) — sem filtro de worker e sobre um período
  // potencialmente largo (até 12 meses), estas duas queries ultrapassam
  // facilmente o limite de 1000 linhas do PostgREST e truncavam
  // silenciosamente (mesmo bug confirmado em elegibilidade.js — ver
  // paginacao.js). Só afeta o gate de completude abaixo
  // (mesesIncluidos/mesesExcluidos, um aviso), nunca totalReal (calculado
  // acima, mês a mês, com queries já filtradas por mês).
  const [validations, logs] = await Promise.all([
    fetchTudoPaginado(() => dbClient.from('receipt_validations').select('worker_id, mes')
      .gte('mes', mesSeguinte(periodoInicio)).lte('mes', mesSeguinte(periodoFim))),
    fetchTudoPaginado(() => dbClient.from('logs').select('workerId, date')
      .gte('date', `${periodoInicio}-01`).lte('date', `${periodoFim}-31`)),
  ]);

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
        // workerIds estruturado (ids originais, ver normalizarWorkerId) para a
        // UI poder resolver nomes e oferecer um "marcar como revisto" sem
        // fazer parsing da string `motivo`. Registos antigos gravados antes
        // desta mudança não têm este campo — a UI faz fallback.
        workerIds: semRecibo,
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

// Investigação de 2026-08-20 (ver conversa): estas 8 faturas de junho/julho
// 2026 têm valor_observacao_manual preenchido, mas confirmado como
// placeholder aleatório (sem base em recibo real) — não são declarações
// genuínas como as outras 17 do período (março-maio, dispersão orgânica
// 45%-79%; estas 8 convergiam de forma suspeita para ~50-52%, coincidindo
// com a % que esteve ativa em produção nesses meses). Lista explícita e
// temporária (decisão consciente, não um mecanismo geral de deteção de
// placeholders — se isto se repetir no futuro, vale a pena reconsiderar
// um campo próprio na BD em vez de continuar a acumular listas destas).
// O valor_observacao_manual da fatura NÃO é apagado (mantém-se como
// registo histórico do que lá estava escrito) — só deixa de contar como
// declaração válida no cálculo da % e no rateio.
const FATURAS_VALOR_MANUAL_PLACEHOLDER = new Set([
  'c1775487604163|2026-06|FT 2026/36', // Caldereria Gurelan
  'c1775487604163|2026-07|FT 2026/40', // Caldereria Gurelan
  'c1775331179425|2026-06|FT 2026/34', // Caldereria Kortaberri
  'c1775331179425|2026-07|FT 2026/38', // Caldereria Kortaberri
  'c1775216152375|2026-06|FT 2026/32', // Ferrocal Steel
  'c1775216152375|2026-07|FT 2026/41', // Ferrocal Steel
  'c1775487391067|2026-06|FT 2026/33', // Grandes Mecanizados
  'c1775487391067|2026-07|FT 2026/37', // Grandes Mecanizados
]);

function ehValorManualPlaceholder(f) {
  return FATURAS_VALOR_MANUAL_PLACEHOLDER.has(`${f.clientId}|${f.mes}|${f.faturaId}`);
}

// Uma fatura com valor de ajuda de custo já escrito manualmente na sua
// observação está "resolvida" — o valor já está declarado no documento
// fiscal, não há nada para a % histórica calcular ou ratear para ela.
// Contá-la de novo no numerador/denominador seria dupla contagem: o valor
// já existe como declarado E entraria outra vez no total a distribuir.
// Exceção: faturas em FATURAS_VALOR_MANUAL_PLACEHOLDER têm o valor
// preenchido mas confirmado como não-genuíno — tratadas como SEM valor
// manual para efeitos de cálculo (entram no rateio normalmente).
// Usado tanto no cálculo da % (passo c/e) como no rateio retroativo
// (passo d) — nunca duas cópias do mesmo predicado.
function temValorManual(f) {
  if (ehValorManualPlaceholder(f)) return false;
  return (f.valorObservacaoManual || 0) > 0;
}

// Passo (d): rateia SÓ o resíduo ainda por resolver — totalAjudasRealAjustado
// (já sem o que está declarado manualmente) — pelas faturas elegíveis SEM
// valor manual na observação. As faturas COM valor manual ficam de fora do
// rateio (o valor delas não é recalculado, é o próprio valor declarado),
// mas continuam no relatório (origem:'historico', status:'historico') para
// a auditoria do período ficar completa. Devolve linhas prontas para
// gravar em ajudas_estimativas_fatura; não grava.
export function ratearHistorico({ totalAjudasRealAjustado, faturasElegiveisDoPeriodo }) {
  const comValorManual = (faturasElegiveisDoPeriodo || []).filter(temValorManual);
  const semValorManual = (faturasElegiveisDoPeriodo || []).filter(f => !temValorManual(f));

  const rateadas = ratearProporcional(totalAjudasRealAjustado, semValorManual);
  const linhasRateadas = rateadas.map(f => ({
    mes: f.mes,
    client_id: f.clientId,
    fatura_id: f.faturaId,
    valor_fatura: f.valor,
    valor_estimado_bruto: f.valorRateado,
    valor_final: f.valorRateado,
    valor_observacao_manual: f.valorObservacaoManual ?? null,
    origem: 'historico',
    status: 'historico',
  }));

  // Nunca recalculado — o valor_final é o próprio valor já declarado na
  // observação da fatura, tal como está.
  const linhasComValorManual = comValorManual.map(f => ({
    mes: f.mes,
    client_id: f.clientId,
    fatura_id: f.faturaId,
    valor_fatura: f.valor,
    valor_estimado_bruto: f.valorObservacaoManual,
    valor_final: f.valorObservacaoManual,
    valor_observacao_manual: f.valorObservacaoManual,
    origem: 'historico',
    status: 'historico',
  }));

  return [...linhasRateadas, ...linhasComValorManual];
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

  // Passo (c) — correção metodológica: faturas elegíveis que já têm valor
  // de ajuda de custo declarado manualmente na observação já estão
  // "resolvidas" — não entram no numerador nem no denominador da %, e não
  // participam do rateio (passo d). Sem isto, esse valor seria contado
  // duas vezes: uma vez como já declarado na fatura, outra vez implícito
  // no total real distribuído pela % a todas as faturas elegíveis.
  const faturasComValorManual = faturasElegiveisDoPeriodo.filter(temValorManual);
  const faturasSemValorManual = faturasElegiveisDoPeriodo.filter(f => !temValorManual(f));
  const valorManualTotal = faturasComValorManual.reduce((s, f) => s + f.valorObservacaoManual, 0);

  // Caso limite fail-closed: mais valor já declarado manualmente do que o
  // total real confirmado pelos recibos não é calculável sem decisão
  // humana — totalAjudasRealAjustado ficaria negativo. Nunca se assume
  // silenciosamente qual dos dois números está errado (recibo em falta,
  // valor manual incorreto, etc.) — bloqueia e devolve os números para o
  // admin decidir, no mesmo padrão de `clientesPorDecidir` acima.
  if (valorManualTotal > totalReal) {
    return {
      bloqueado: true,
      motivoBloqueio: 'valor_manual_excede_total_real',
      valorManualTotal,
      totalAjudasRealComRecibos: totalReal,
      faturasComValorManualCount: faturasComValorManual.length,
    };
  }

  const totalAjudasRealAjustado = totalReal - valorManualTotal;
  const totalFaturamentoAjustado = faturasSemValorManual.reduce((s, f) => s + f.valor, 0);
  const { percentagem, totalAjudasReal, totalBrutoReferencia } = calcularPercentagemHistorica({
    totalReal: totalAjudasRealAjustado, totalFaturamento: totalFaturamentoAjustado,
  });

  const linhasHistoricas = ratearHistorico({ totalAjudasRealAjustado, faturasElegiveisDoPeriodo });
  const clientesElegiveis = [...new Set(faturasElegiveisDoPeriodo.map(f => f.clientId))];

  return {
    bloqueado: false,
    percentagem,
    totalAjudasReal,
    totalBrutoReferencia,
    valorManualTotal,
    totalAjudasRealComRecibos: totalReal,
    faturasComValorManualCount: faturasComValorManual.length,
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
