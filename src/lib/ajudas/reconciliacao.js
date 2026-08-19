// Fase 3 da Calculadora de Ajudas de Custo — Reconciliação Mensal. Ver
// documento de arquitetura, secção 1.4, e DECISIONS.md.
//
// Regra central: a soma cumulativa de tudo o que é ESCRITO em faturas
// (ajudas_valores_por_cliente_mes, origem='sistema') nunca pode ultrapassar
// a soma cumulativa do REAL dos recibos — não só no fim do ano, mês a mês.
// Um saldo negativo ("já escrevemos mais do que o real disponível") reduz
// a estimativa dos meses seguintes até ser absorvido; nunca se ignora nem
// se força a zero um mês isolado.
//
// Reutiliza calcularValoresPorClienteMes (valoresPorFatura.js) — já com o
// duplo desvio M→M-1 validado — para determinar o total real atribuído a
// clientes elegíveis de um mês fechado. Nunca uma reconstrução paralela.

import { calcularValoresPorClienteMes, mesSeguinte } from './valoresPorFatura.js';
import { normalizarWorkerId } from './percentagemHistorica.js';

// Semente inicial do saldo acumulado — o saldo que a Fase 1 (saneamento
// 2025-12 a 2026-07) deixou por fechar no fim do período, gerado pela %
// ativa dd2245ef-ca88-4399-9212-06d969ee302a (50,191567%; ver notas
// completas em ajudas_percentagem_historica, registo ativo). Usada só
// quando NENHUM registo existe ainda em ajudas_reconciliacao_mensal — a
// partir do primeiro fecho, o `saldo_acumulado` gravado é sempre a fonte
// de verdade, esta semente nunca mais é lida. Também usada por
// estimativaMensal.js pelo mesmo motivo (nunca ignorar esta dívida já
// confirmada, mesmo antes do primeiro fecho da Fase 3).
export const SALDO_ACUMULADO_INICIAL = -7155.94;

// Mesmo critério de completude usado em consolidarTotalReal
// (percentagemHistorica.js): um trabalhador com horas em `mes` (logs.date)
// só conta como "com recibo" se existir receipt_validations com
// mes = mesSeguinte(mes) — o duplo desvio já validado. Versão de um único
// mês (consolidarTotalReal faz o mesmo em lote, para um período inteiro).
export async function verificarMesFechavel({ mes, dbClient }) {
  const mesRecibo = mesSeguinte(mes);
  const [{ data: logs, error: errL }, { data: validations, error: errV }] = await Promise.all([
    dbClient.from('logs').select('workerId, date').gte('date', `${mes}-01`).lte('date', `${mes}-31`),
    dbClient.from('receipt_validations').select('worker_id, mes').eq('mes', mesRecibo),
  ]);
  if (errL) throw errL;
  if (errV) throw errV;

  const idsComLogs = new Map(); // idNormalizado -> idOriginal
  for (const l of logs || []) {
    if (!l.workerId) continue;
    idsComLogs.set(normalizarWorkerId(l.workerId), l.workerId);
  }
  const idsValidados = new Set((validations || []).map(v => normalizarWorkerId(v.worker_id)));
  const semRecibo = [...idsComLogs.entries()]
    .filter(([idNorm]) => !idsValidados.has(idNorm))
    .map(([, idOriginal]) => idOriginal);

  if (semRecibo.length > 0) {
    return {
      fechavel: false,
      motivo: `${semRecibo.length} trabalhador(es) com horas registadas em ${mes} sem NENHUM receipt_validations processado (mes=${mesRecibo}): ${semRecibo.join(', ')}`,
    };
  }
  return { fechavel: true, motivo: null };
}

// Passo de pré-visualização — calcula tudo, nunca escreve nada. Espelha o
// padrão já usado em emitirFaturaComAjudas.js (verificarEstimativaParaFatura
// / confirmarEEmitirFatura): a UI mostra este resultado num cartão e só
// grava depois de um clique humano explícito em "Fechar mês X".
export async function verificarFechoMes({ mes, dbClient, fetchVendasFn }) {
  const { fechavel, motivo } = await verificarMesFechavel({ mes, dbClient });
  if (!fechavel) {
    return { fechavel: false, motivo };
  }

  // Passo 2: total REAL atribuído a clientes elegíveis — mesma lógica de
  // declarado/distribuído, mesmo desvio, nunca uma reconstrução paralela.
  const resultado = await calcularValoresPorClienteMes({ mes, dbClient, fetchVendasFn });
  if (resultado.dadosInsuficientes) {
    return { fechavel: false, motivo: `Dados insuficientes: mesFatura (${resultado.mesFatura}) ainda não fechou.` };
  }
  const totalReal = resultado.linhas
    .filter(l => l.elegivel_na_data === true)
    .reduce((s, l) => s + l.valor_atribuido, 0);

  // Passo 3: total já ESCRITO nas faturas reais desse mês. Lido de
  // ajudas_valores_por_cliente_mes (origem='sistema') — a mesma tabela
  // onde confirmarEEmitirFatura (emitirFaturaComAjudas.js) grava no
  // momento da emissão; é a fonte canónica para "o que já foi escrito",
  // preferida a reconstruir a partir de ajudas_estimativas_fatura
  // (status='faturado'), que tem o mesmo dado mas moldado para outro fim
  // (auditoria da Fase 2b, não o ledger unificado por cliente/mês).
  const { data: escritas, error: errEscritas } = await dbClient
    .from('ajudas_valores_por_cliente_mes')
    .select('valor_atribuido, elegivel_na_data')
    .eq('mes', mes)
    .eq('origem', 'sistema');
  if (errEscritas) throw errEscritas;
  const totalEscrito = (escritas || [])
    .filter(l => l.elegivel_na_data === true)
    .reduce((s, l) => s + (Number(l.valor_atribuido) || 0), 0);

  // Passo 4
  const residuoDoMes = totalReal - totalEscrito;

  // Passo 5: saldo acumulado mais recente (o último fecho, por mes desc) —
  // ou a semente inicial se este for o primeiro fecho de sempre.
  const { data: ultimoRegisto, error: errUltimo } = await dbClient
    .from('ajudas_reconciliacao_mensal')
    .select('mes, saldo_acumulado')
    .order('mes', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (errUltimo) throw errUltimo;
  const saldoAcumuladoAnterior = ultimoRegisto ? Number(ultimoRegisto.saldo_acumulado) : SALDO_ACUMULADO_INICIAL;

  // Passo 6
  const novoSaldoAcumulado = saldoAcumuladoAnterior + residuoDoMes;

  return {
    fechavel: true,
    mes,
    totalReal,
    totalEscrito,
    residuoDoMes,
    saldoAcumuladoAnterior,
    saldoAcumuladoAnteriorEraSemente: !ultimoRegisto,
    novoSaldoAcumulado,
    linhaParaGravar: {
      mes,
      total_real: totalReal,
      total_estimado: totalEscrito,
      residuo: residuoDoMes,
      saldo_acumulado: novoSaldoAcumulado,
      status: 'pendente',
      mes_aplicacao: mesSeguinte(mes),
    },
  };
}

// Passo de confirmação — só chamado depois do clique humano em "Fechar mês
// X". Recalcula (verificarFechoMes é barato, sem escrita) e grava a
// linha. `mes` tem UNIQUE em ajudas_reconciliacao_mensal — fechar o mesmo
// mês duas vezes falha com violação de unicidade em vez de sobrescrever
// silenciosamente (um duplo fecho seria um bug, não uma correção).
export async function fecharReconciliacaoMes({ mes, dbClient, fetchVendasFn }) {
  const preview = await verificarFechoMes({ mes, dbClient, fetchVendasFn });
  if (!preview.fechavel) {
    return preview;
  }

  const { data: inserido, error } = await dbClient
    .from('ajudas_reconciliacao_mensal')
    .insert(preview.linhaParaGravar)
    .select()
    .single();
  if (error) throw error;

  return { ...preview, gravado: true, registoId: inserido.id };
}
