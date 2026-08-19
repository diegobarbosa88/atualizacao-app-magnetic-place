// Fase 2a da Calculadora de Ajudas de Custo — Estimativa Mensal, em modo
// simulação (ver documento de arquitetura, secção 2 e secção 6). Esta
// versão NÃO escreve em ajudas_estimativas_fatura nem chama
// create-fatura.js — é só cálculo, devolvido para pré-visualização. A
// gravação e a ligação ao fail-closed de create-fatura.js ficam para a
// Fase 2b.
//
// Mudança de desenho: este módulo já NÃO lê faturação por si (nem via
// TOConline, nem recalculando horas×tarifa) — recebe `faturasDoMes` já
// calculado por quem chama. Isto evita duplicar (e divergir de) a fonte
// de verdade real do valor faturado, que é sempre decidida no momento da
// emissão (FaturarClienteModal.jsx, ver correção de tarifa histórica em
// src/lib/faturacao/tarifaHistorica.js). Reutiliza ratearProporcional
// (rateio.js) — nunca duplica a divisão proporcional.

import { ratearProporcional } from './rateio.js';
import { SALDO_ACUMULADO_INICIAL } from './reconciliacao.js';

/**
 * @param {object} params
 * @param {string} params.mes  'YYYY-MM'
 * @param {Array<{clientId: string, faturaId: string|null, valorFaturado: number}>} params.faturasDoMes
 *   Fornecido pelo chamador — Fase 2b: FaturarClienteModal, no momento da
 *   emissão; esta sessão (Fase 2a, UI de pré-visualização): aproximação via
 *   calcularFaturacaoCliente (horas × tarifa histórica), nunca um valor real.
 * @param {object} params.dbClient
 *   Fase 2b (emitirFaturaComAjudas.js): fornecido pelo FaturarClienteModal —
 *   é este mês, e não o mês de emissão da fatura, que representa o trabalho
 *   faturado (regra M→M-1: fatura criada em M+1 refere-se às horas de M).
 * @returns {Promise<{
 *   linhas: Array<{
 *     clientId: string, faturaId: string|null,
 *     valorEstimadoBruto: number, residuoAplicado: number, valorFinal: number,
 *     status: 'calculado' | 'bloqueado', motivoBloqueio: string | null,
 *   }>,
 *   percentagemUsada: number | null,
 *   percentagemHistoricaId: string | null,
 *   residuoOrigem: { mes: string|null, saldoAcumuladoDisponivel: number, semente?: true } | null,
 * }>}
 */
export async function calcularEstimativaMensal({ mes, faturasDoMes, dbClient }) {
  const { data: pctAtiva, error: errPct } = await dbClient
    .from('ajudas_percentagem_historica')
    .select('id, percentagem')
    .eq('ativo', true)
    .maybeSingle();
  if (errPct) throw errPct;

  const lista = faturasDoMes || [];
  const clientIds = [...new Set(lista.map(f => f.clientId))];

  let elegivelPorCliente = new Map();
  if (clientIds.length > 0) {
    const { data: clientsData, error: errC } = await dbClient
      .from('clients')
      .select('id, elegivel_ajudas_custo')
      .in('id', clientIds);
    if (errC) throw errC;
    elegivelPorCliente = new Map((clientsData || []).map(c => [c.id, c.elegivel_ajudas_custo]));
  }

  // elegivel === true → entra no rateio. elegivel === false → exclusão
  // legítima, nem aparece como linha. elegivel == null (ou cliente
  // desconhecido) → bloqueada, link para Elegibilidade — independentemente
  // de existir % ativa ou não.
  const elegiveis = [];
  const porDecidir = [];
  for (const f of lista) {
    const elegivel = elegivelPorCliente.get(f.clientId);
    if (elegivel === true) elegiveis.push(f);
    else if (elegivel !== false) porDecidir.push(f);
  }

  const linhaBloqueada = (f, motivoBloqueio) => ({
    clientId: f.clientId,
    faturaId: f.faturaId,
    valorEstimadoBruto: 0,
    residuoAplicado: 0,
    valorFinal: 0,
    status: 'bloqueado',
    motivoBloqueio,
  });

  // Passo (a): sem % ativa, TODAS as linhas do mês ficam bloqueadas — não
  // há nada para calcular, independentemente da elegibilidade de cada uma.
  if (!pctAtiva) {
    const linhas = [...elegiveis, ...porDecidir].map(f => linhaBloqueada(f, 'sem percentagem historica ativa'));
    return { linhas, percentagemUsada: null, percentagemHistoricaId: null, residuoOrigem: null };
  }

  const linhasPorDecidir = porDecidir.map(f => linhaBloqueada(f, 'cliente sem decisao de elegibilidade'));

  // Passo (d) — MUDANÇA (Fase 3): já não soma livremente um resíduo
  // pendente específico de mes_aplicacao=mes. Lê o saldoAcumulado mais
  // recente de ajudas_reconciliacao_mensal (o último fecho de mês —
  // cumulativo desde sempre, não um valor isolado por mês) e usa-o como
  // RESTRIÇÃO, nunca como soma livre: a estimativa do mês nunca excede o
  // que o saldo acumulado permite, nunca fica negativa. Sem nenhum
  // registo ainda, usa SALDO_ACUMULADO_INICIAL (reconciliacao.js) — a
  // dívida que a Fase 1 deixou por fechar não pode ser ignorada mesmo
  // antes do primeiro fecho da Fase 3.
  const { data: ultimoReconc, error: errReconc } = await dbClient
    .from('ajudas_reconciliacao_mensal')
    .select('mes, saldo_acumulado')
    .order('mes', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (errReconc) throw errReconc;
  const saldoAcumuladoDisponivel = ultimoReconc ? Number(ultimoReconc.saldo_acumulado) : SALDO_ACUMULADO_INICIAL;

  // Passo (c): Estimativa Bruta = faturamento elegível × %.
  const totalFaturadoElegivel = elegiveis.reduce((s, f) => s + (Number(f.valorFaturado) || 0), 0);
  const estimativaTotal = totalFaturadoElegivel * pctAtiva.percentagem;

  // estimativaTotalAjustada = max(0, estimativaTotal + saldoAcumuladoDisponivel).
  // Saldo negativo (já escrito mais do que o real disponível) REDUZ a
  // estimativa deste mês, nunca abaixo de 0 — mesmo que a dívida seja
  // maior do que a própria estimativa bruta. Saldo positivo (sobra real
  // por reconhecer) SOMA normalmente à estimativa bruta, sem teto — é
  // dinheiro real ainda não escrito em nenhuma fatura, não há razão para
  // o capar ao valor da estimativa bruta do mês.
  const estimativaTotalAjustada = Math.max(0, estimativaTotal + saldoAcumuladoDisponivel);
  const ajusteTotal = estimativaTotalAjustada - estimativaTotal;

  const elegiveisParaRateio = elegiveis.map(f => ({ ...f, valor: Number(f.valorFaturado) || 0 }));
  const brutoRateado = ratearProporcional(estimativaTotal, elegiveisParaRateio);
  const ajusteRateado = ratearProporcional(ajusteTotal, elegiveisParaRateio);

  const linhasCalculadas = elegiveis.map((f, i) => {
    const valorEstimadoBruto = brutoRateado[i].valorRateado;
    const residuoAplicado = ajusteRateado[i].valorRateado;
    return {
      clientId: f.clientId,
      faturaId: f.faturaId,
      valorEstimadoBruto,
      residuoAplicado,
      valorFinal: Math.max(0, valorEstimadoBruto + residuoAplicado),
      status: 'calculado',
      motivoBloqueio: null,
    };
  });

  return {
    linhas: [...linhasCalculadas, ...linhasPorDecidir],
    percentagemUsada: pctAtiva.percentagem,
    percentagemHistoricaId: pctAtiva.id,
    residuoOrigem: ultimoReconc
      ? { mes: ultimoReconc.mes, saldoAcumuladoDisponivel }
      : { mes: null, saldoAcumuladoDisponivel, semente: true },
  };
}
