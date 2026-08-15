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
import { authFetch } from '../../utils/authFetch.js';

// Tipos de documento de venda do TOConline que representam receita real de
// cliente. Exclui NC/ND (notas de crédito/débito) e GT/GR/ORC/PROJ/NAFT
// (guias, orçamentos, projetos, documentos não fiscais).
export const TOCONLINE_TIPOS_RECEITA = ['FT', 'FR', 'FS', 'FRS', 'VD'];

function normalizarNome(s) {
  return (s || '').toLowerCase().trim();
}

function _parseMonetario(s) {
  s = (s || '').replace(/\s/g, '');
  if (!s) return null;
  const lastDot = s.lastIndexOf('.');
  const lastComma = s.lastIndexOf(',');
  if (lastDot >= 0 && lastComma >= 0) {
    const dec = Math.max(lastDot, lastComma);
    s = s.slice(0, dec).replace(/[.,]/g, '') + '.' + s.slice(dec + 1);
  } else if (lastComma >= 0) {
    s = s.replace(/\./g, '').replace(',', '.');
  } else if ((s.match(/\./g) || []).length > 1) {
    s = s.replace(/\./g, '');
  }
  const v = parseFloat(s);
  return isNaN(v) || v <= 0 ? null : v;
}

// Idêntico a extrairValorObs em AjudasCalculadora.jsx — prioriza o padrão
// "€X.XXX,XX" sobre o fallback numérico genérico, para não divergir da
// extração já usada noutro sítio do projeto.
export function extrairValorObs(obs) {
  if (!obs) return null;
  const str = String(obs);
  const mEuro = str.match(/€\s*([\d][\d.,]*)/);
  if (mEuro) return _parseMonetario(mEuro[1]);
  const m = str.match(/\d[\d.,]*\d|\d/);
  if (!m) return null;
  return _parseMonetario(m[0]);
}

function getAttrsToc(item) {
  return item?.attributes || item || {};
}

function getObservacaoToc(attrs) {
  return attrs.notes || attrs.observations || attrs.observation || attrs.remarks || attrs.memo || attrs.description || null;
}

function ehFaturaReceita(attrs) {
  const tipo = attrs.document_type_name || attrs.document_type || '';
  return TOCONLINE_TIPOS_RECEITA.includes(String(tipo).toUpperCase());
}

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

// Implementação real (não usada nos testes — os testes injetam fetchVendasFn).
// Pagina o endpoint /api/toconline/relatorio?tipo=vendas até esgotar
// meta.total_pages, devolve a lista completa e achatada de itens brutos.
export async function fetchVendasTOConline({ dataDe, dataAte }) {
  const itens = [];
  let page = 1;
  let totalPages = 1;
  do {
    const params = new URLSearchParams({ tipo: 'vendas', data_de: dataDe, data_ate: dataAte, page: String(page) });
    const res = await authFetch(`/api/toconline/relatorio?${params}`);
    if (!res.ok) throw new Error(`Erro ao consultar faturas TOConline (página ${page}): ${res.status}`);
    const data = await res.json();
    itens.push(...(data.data || []));
    totalPages = data.meta?.total_pages || 1;
    page += 1;
  } while (page <= totalPages);
  return itens;
}

// Busca as faturas de venda do período, filtra só tipos de receita, resolve
// client_id por correspondência de nome (o relatório TOConline não devolve
// client_id, só o nome do cliente), e cruza com elegivel_ajudas_custo.
//
// Devolve também `semClienteCorrespondente`: faturas cujo nome de cliente
// não bateu com nenhum registo em `clients` — não entram em nenhum cálculo
// (não há como determinar elegibilidade sem um registo correspondente),
// mas ficam visíveis para o admin resolver a divergência de nome.
async function buscarFaturasVendasPeriodo({ periodoInicio, periodoFim, dbClient, fetchVendasFn = fetchVendasTOConline }) {
  const { data: clientsData, error: errClients } = await dbClient
    .from('clients')
    .select('id, name, elegivel_ajudas_custo');
  if (errClients) throw errClients;
  const clientsAll = clientsData || [];

  const dataDe = `${periodoInicio}-01`;
  const dataAte = `${periodoFim}-31`;
  const itensBrutos = await fetchVendasFn({ dataDe, dataAte });

  const faturas = [];
  const semClienteCorrespondente = [];

  for (const item of itensBrutos || []) {
    const attrs = getAttrsToc(item);
    if (!ehFaturaReceita(attrs)) continue;

    const valor = Number(attrs.gross_total ?? attrs.total_amount ?? attrs.total_value ?? 0) || 0;
    if (valor <= 0) continue;

    const nome = attrs.customer_business_name || attrs.customer_name || '';
    const cliente = clientsAll.find(c => normalizarNome(c.name) === normalizarNome(nome));
    const data = attrs.date || null;
    const mes = data ? String(data).slice(0, 7) : null;
    const faturaId = attrs.document_number || attrs.document_no || (item?.id != null ? String(item.id) : null);
    const observacao = getObservacaoToc(attrs);

    const registo = {
      faturaId,
      clientId: cliente?.id ?? null,
      clienteNome: nome,
      valor,
      observacao,
      mes,
      elegivel: cliente?.elegivel_ajudas_custo ?? null,
    };

    if (!cliente) { semClienteCorrespondente.push(registo); continue; }
    faturas.push(registo);
  }

  return { faturas, semClienteCorrespondente, clientsAll };
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

// Passo (b): soma o total real de ajudas de custo (receipt_validations) no
// período, excluindo meses com dados incompletos.
//
// "Mês incompleto" = existe pelo menos um trabalhador com horas registadas
// em `logs` nesse mês (ou seja, trabalhou) sem uma receipt_validations
// correspondente com estado='valido'. Deliberadamente NÃO se usa
// workers.status='ativo' (o status atual do trabalhador, não o histórico
// de quem estava ativo naquele mês específico) — usar horas registadas
// nesse mês é o sinal mais fiável de que se esperava uma validação.
export async function consolidarTotalReal({ periodoInicio, periodoFim, dbClient }) {
  const [{ data: validations, error: errV }, { data: logs, error: errL }] = await Promise.all([
    dbClient.from('receipt_validations').select('worker_id, mes, ajudas_custo_extraidas, estado')
      .gte('mes', periodoInicio).lte('mes', periodoFim),
    dbClient.from('logs').select('workerId, date')
      .gte('date', `${periodoInicio}-01`).lte('date', `${periodoFim}-31`),
  ]);
  if (errV) throw errV;
  if (errL) throw errL;

  const workersPorMes = new Map(); // mes -> Set(workerId)
  for (const l of logs || []) {
    if (!l.workerId || !l.date) continue;
    const mes = l.date.slice(0, 7);
    if (!workersPorMes.has(mes)) workersPorMes.set(mes, new Set());
    workersPorMes.get(mes).add(l.workerId);
  }

  const validPorChave = new Map(); // `${workerId}|${mes}` -> validation
  for (const v of validations || []) {
    validPorChave.set(`${v.worker_id}|${v.mes}`, v);
  }

  const meses = listarMesesEntre(periodoInicio, periodoFim);
  const mesesIncluidos = [];
  const mesesExcluidos = [];
  let totalReal = 0;

  for (const mes of meses) {
    const workersDoMes = workersPorMes.get(mes) || new Set();
    const faltantes = [];
    for (const workerId of workersDoMes) {
      const v = validPorChave.get(`${workerId}|${mes}`);
      if (!v || v.estado !== 'valido') faltantes.push(workerId);
    }

    if (faltantes.length > 0) {
      mesesExcluidos.push({
        mes,
        motivo: `${faltantes.length} trabalhador(es) com horas registadas sem receipt_validations válida: ${faltantes.join(', ')}`,
      });
      continue;
    }

    mesesIncluidos.push(mes);
    for (const workerId of workersDoMes) {
      const v = validPorChave.get(`${workerId}|${mes}`);
      totalReal += Number(v.ajudas_custo_extraidas) || 0;
    }
  }

  return { totalReal, mesesIncluidos, mesesExcluidos };
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

  const { totalReal, mesesIncluidos, mesesExcluidos } = await consolidarTotalReal({ periodoInicio, periodoFim, dbClient });

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
  };
}
