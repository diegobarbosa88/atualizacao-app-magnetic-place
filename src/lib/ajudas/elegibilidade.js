// Pré-requisito bloqueante da Calculadora de Ajudas de Custo (ver
// DECISIONS.md e o documento de arquitetura, secção 2 — "elegibilidade.js").
//
// sugerirElegibilidade() é uma função pura de leitura: cruza
// receipt_validations (ajudas de custo já extraídas dos recibos reais) com
// logs (horas por trabalhador/cliente/dia) para atribuir cada ajuda de
// custo aos clientes de cada trabalhador, proporcionalmente às horas
// desse mês. Não filtra candidatos por nenhum limiar mínimo (decisão da
// v1 — ver documento, secção 7: o limiar automático fica para uma versão
// futura, depois de haver uma primeira ronda real de evidência para
// analisar).
//
// Comportamento deliberado: esta função nunca lê `clients` e não sabe
// nada sobre decisões de elegibilidade já tomadas. Um cliente que já
// tenha `elegivel_ajudas_custo` definido continua a aparecer normalmente
// na evidência devolvida — a decisão anterior não escondemos dados, para
// permitir ao admin rever/corrigir uma decisão já tomada. Esconder
// candidatos já decididos é uma preocupação da UI (secção 4 do
// documento), não deste módulo.
//
// A distribuição proporcional por horas está em distribuicaoHoras.js,
// partilhada com percentagemHistorica.js (consolidarTotalReal) — nunca
// duplicar esta divisão.

import { distribuirAjudaPorCliente } from './distribuicaoHoras.js';

/**
 * @param {object} params
 * @param {string} params.periodoInicio  'YYYY-MM'
 * @param {string} params.periodoFim     'YYYY-MM'
 * @param {object} params.dbClient       cliente Supabase (injetado, nunca uma global)
 * @returns {Promise<Array<{
 *   clientId: string,
 *   evidencia: Array<{
 *     mes: string,
 *     workerId: string,
 *     horasCliente: number,
 *     horasTotalTrabalhadorNoMes: number,
 *     pctHorasCliente: number,
 *     ajudaCustoDoMes: number,
 *     ajudaAtribuidaProporcional: number,
 *   }>
 * }>>}  candidatos ordenados por pctHorasCliente (do topo da sua própria
 *       evidência) decrescente; cada `evidencia` vem também ordenada por
 *       pctHorasCliente decrescente.
 */
export async function sugerirElegibilidade({ periodoInicio, periodoFim, dbClient }) {
  const { data: validations, error: errValidations } = await dbClient
    .from('receipt_validations')
    .select('worker_id, mes, ajudas_custo_extraidas')
    .gte('mes', periodoInicio)
    .lte('mes', periodoFim)
    .gt('ajudas_custo_extraidas', 0);
  if (errValidations) throw errValidations;

  const validacoesComAjuda = (validations || []).filter(
    v => v.worker_id && v.mes && (Number(v.ajudas_custo_extraidas) || 0) > 0
  );
  if (validacoesComAjuda.length === 0) return [];

  const workerIds = [...new Set(validacoesComAjuda.map(v => v.worker_id))];

  const { data: logs, error: errLogs } = await dbClient
    .from('logs')
    .select('workerId, clientId, date, hours')
    .in('workerId', workerIds)
    .gte('date', `${periodoInicio}-01`)
    .lte('date', `${periodoFim}-31`);
  if (errLogs) throw errLogs;

  const { atribuicoes } = distribuirAjudaPorCliente({ validacoes: validacoesComAjuda, logs: logs || [] });

  // candidatesByClient: clientId → evidencia[]
  const candidatesByClient = new Map();
  for (const a of atribuicoes) {
    if (!candidatesByClient.has(a.clientId)) candidatesByClient.set(a.clientId, []);
    candidatesByClient.get(a.clientId).push(a);
  }

  const candidatos = [...candidatesByClient.entries()].map(([clientId, evidencia]) => ({
    clientId,
    evidencia: [...evidencia].sort((a, b) => b.pctHorasCliente - a.pctHorasCliente),
  }));

  candidatos.sort((a, b) => (b.evidencia[0]?.pctHorasCliente ?? 0) - (a.evidencia[0]?.pctHorasCliente ?? 0));

  return candidatos;
}
