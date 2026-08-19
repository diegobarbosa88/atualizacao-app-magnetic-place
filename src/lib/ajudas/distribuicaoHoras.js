// Motor partilhado de distribuição de ajuda de custo por cliente,
// proporcional às horas de cada trabalhador em `logs` nesse mês. Extraído
// de elegibilidade.js (onde nasceu) para ser reutilizado também em
// percentagemHistorica.js — nunca duplicar esta divisão em dois sítios,
// como já aconteceu antes com _calcReciboComMapa (ver DECISIONS.md).

/**
 * @param {Array<{worker_id: string, mes: string, ajudas_custo_extraidas: number}>} validacoes
 * @param {Array<{workerId: string, clientId: string, date: string, hours: number}>} logs
 * @returns {{
 *   atribuicoes: Array<{
 *     workerId: string, mes: string, clientId: string,
 *     horasCliente: number, horasTotalTrabalhadorNoMes: number,
 *     pctHorasCliente: number, ajudaCustoDoMes: number, ajudaAtribuidaProporcional: number,
 *   }>,
 *   semLogs: Array<{ workerId: string, mes: string, ajudaCustoDoMes: number }>,
 * }}
 *   `atribuicoes` — uma linha por (worker, mês, cliente) com a fatia de
 *   ajuda de custo atribuída a esse cliente, proporcional às horas.
 *   `semLogs` — validações com ajuda > 0, worker_id presente e mes válido,
 *   cujo worker não tem NENHUMA hora lançada em `logs` nesse mês (ou só
 *   horas sem clientId) — não há como atribuir a nenhum cliente por esta
 *   via (ex: pago por duodécimos, ou trabalhador isento de validação
 *   automática).
 *   `semWorkerId` — validações com ajuda > 0 mas SEM worker_id (nulo/vazio)
 *   — problema de qualidade de dados diferente de `semLogs`: aqui nem se
 *   sabe a que trabalhador o recibo pertence, portanto não há sequer por
 *   onde começar a procurar `logs`.
 *   Nenhum dos três grupos é somado nem descartado silenciosamente pelo
 *   próprio motor — a decisão de incluir/excluir é de quem chama.
 */
export function distribuirAjudaPorCliente({ validacoes, logs }) {
  const horasPorWorkerMes = new Map(); // `${workerId}|${mes}` -> Map(clientId -> horas)
  for (const l of logs || []) {
    if (!l.clientId || !l.date || !l.workerId) continue;
    const mes = l.date.slice(0, 7);
    const key = `${l.workerId}|${mes}`;
    if (!horasPorWorkerMes.has(key)) horasPorWorkerMes.set(key, new Map());
    const porCliente = horasPorWorkerMes.get(key);
    porCliente.set(l.clientId, (porCliente.get(l.clientId) || 0) + (Number(l.hours) || 0));
  }

  const atribuicoes = [];
  const semLogs = [];
  const semWorkerId = [];

  for (const v of validacoes || []) {
    const workerId = v.worker_id;
    const mes = v.mes;
    const ajudaCustoDoMes = Number(v.ajudas_custo_extraidas) || 0;
    if (!mes || ajudaCustoDoMes <= 0) continue;
    if (!workerId) { semWorkerId.push({ mes, ajudaCustoDoMes }); continue; }

    const porCliente = horasPorWorkerMes.get(`${workerId}|${mes}`);
    if (!porCliente || porCliente.size === 0) {
      semLogs.push({ workerId, mes, ajudaCustoDoMes });
      continue;
    }

    const horasTotalTrabalhadorNoMes = [...porCliente.values()].reduce((s, h) => s + h, 0);
    if (horasTotalTrabalhadorNoMes <= 0) {
      semLogs.push({ workerId, mes, ajudaCustoDoMes });
      continue;
    }

    for (const [clientId, horasCliente] of porCliente) {
      const pctHorasCliente = horasCliente / horasTotalTrabalhadorNoMes;
      atribuicoes.push({
        workerId,
        mes,
        clientId,
        horasCliente,
        horasTotalTrabalhadorNoMes,
        pctHorasCliente,
        ajudaCustoDoMes,
        ajudaAtribuidaProporcional: ajudaCustoDoMes * pctHorasCliente,
      });
    }
  }

  return { atribuicoes, semLogs, semWorkerId };
}

// Determina se TODO o histórico de logs de um trabalhador, até (e incluindo)
// `ateData`, está ligado a um único cliente — sem exceção, nem que seja só
// 1 hora num segundo cliente. Usado (em percentagemHistorica.js) para
// atribuir meses sem logs (ex: pago por duodécimos, trabalhador isento de
// validação automática) a um cliente, quando há evidência forte e
// inequívoca — regra validada manualmente numa auditoria real (Dez 2025-Jul
// 2026, 15 casos, 113.091,96€).
//
// Devolve o clientId único, ou `null` se: não houver logs nenhuns com
// clientId até `ateData`, ou houver 2+ clientes distintos no histórico
// (mesmo que a divisão seja 99%/1%) — nesses casos não há atribuição
// automática possível, o caso mantém-se em `semLogs`.
//
// `ateData` é sempre o fim de periodoFim, nunca a data de execução —
// logs de um worker DEPOIS do período em análise (ex: mudança de cliente
// posterior) nunca podem contaminar a atribuição de um período já fechado.
//
// `logsHistoricoWorker` já deve vir filtrado ao worker em causa (por quem
// chama, tipicamente sem limite de data inferior — "desde o registo mais
// antigo disponível"); esta função só aplica o corte por `ateData`.
export function clienteUnicoNoHistorico({ logsHistoricoWorker, ateData }) {
  const relevantes = (logsHistoricoWorker || []).filter(l => l.clientId && l.date && l.date <= ateData);
  if (relevantes.length === 0) return null;
  const clientIds = new Set(relevantes.map(l => l.clientId));
  if (clientIds.size !== 1) return null;
  return [...clientIds][0];
}
