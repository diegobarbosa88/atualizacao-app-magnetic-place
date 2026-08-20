// Fase 2b da Calculadora de Ajudas de Custo — liga o fail-closed real ao
// fluxo de emissão de fatura (FaturarClienteModal.jsx → create-fatura.js).
// Ver documento de arquitetura secção 3, e DECISIONS.md (estado
// 'confirmado' como intermédio explícito, ANTES da chamada ao TOConline).
//
// Duas funções, porque a UI tem sempre dois passos separados por um clique
// humano: primeiro pré-visualiza (verificarEstimativaParaFatura, não grava
// nada), depois — só se o admin clicar "Confirmar e Emitir" — grava e
// chama create-fatura.js (confirmarEEmitirFatura).

import { calcularEstimativaMensal } from './estimativaMensal.js';

/**
 * Passo de pré-visualização — corre assim que o admin tem um valor final
 * de fatura calculado no modal (pós-edição, pós-desconto, pós-IVA). Nunca
 * escreve nada; só devolve a linha (bloqueada ou calculada) para a UI
 * decidir o que mostrar.
 *
 * `mesReferencia` tem de ser o mês do TRABALHO faturado (M), não o mês em
 * que a fatura está a ser emitida (M+1) — regra confirmada com dados reais
 * na Fase 2a. No FaturarClienteModal.jsx, isto é o `periodo` já existente
 * (já representa o mês de referência, não o mês de emissão).
 *
 * @param {object} params
 * @param {string} params.mesReferencia  'YYYY-MM' — mês do trabalho, não da emissão
 * @param {string} params.clientId
 * @param {number} params.valorFinalDoModal  valor definitivo já calculado no modal
 * @param {object} params.dbClient
 */
export async function verificarEstimativaParaFatura({ mesReferencia, clientId, valorFinalDoModal, dbClient }) {
  const resultado = await calcularEstimativaMensal({
    mes: mesReferencia,
    faturasDoMes: [{ clientId, faturaId: null, valorFaturado: valorFinalDoModal }],
    dbClient,
  });

  return {
    linha: resultado.linhas[0] ?? null,
    percentagemUsada: resultado.percentagemUsada,
    percentagemHistoricaId: resultado.percentagemHistoricaId,
    residuoOrigem: resultado.residuoOrigem,
  };
}

/**
 * Passo de confirmação — só chamado depois do admin clicar "Confirmar e
 * Emitir" no cartão. Nunca chamar com uma `linha` bloqueada.
 *
 * Ordem estrita (DECISIONS.md): grava 'confirmado' PRIMEIRO, só depois
 * chama `criarFaturaFn`. Se a API do TOConline falhar, o registo fica em
 * 'confirmado' — nunca regride para 'calculado' nem desaparece, porque já
 * houve confirmação humana explícita antes da falha técnica.
 *
 * `criarFaturaFn({ textoObservacaoAjudas, valorFinal })` é responsabilidade
 * do chamador (o modal já sabe montar o payload completo — descontos, IVA,
 * morada, etc.); esta função só injeta o texto de ajudas na chamada. Deve
 * devolver `{ faturaId }` em sucesso, ou lançar/devolver sem `faturaId` em
 * falha.
 *
 * Reaproveita um registo 'calculado'/'confirmado' já existente para o
 * mesmo mes/cliente (sem fatura_id ainda) em vez de duplicar — cobre o
 * caso de retry manual depois de uma falha na API.
 *
 * Em sucesso, também atualiza a tabela legada `ajudas_faturadas_clientes`
 * (ainda lida por AjudasCalculadora.jsx e outros ecrãs) com o valor NOVO —
 * esta é agora a ÚNICA fonte que escreve nessa tabela; o cálculo antigo
 * (FaturarClienteModal.jsx) deixou de o fazer, para as duas deixarem de
 * poder divergir (ver DECISIONS.md). Uma falha nesta escrita legada não é
 * fatal — a fatura já foi emitida e `ajudas_estimativas_fatura` (fonte de
 * verdade nova) já está correta — por isso é reportada em `erroLegado`
 * sem lançar.
 *
 * Também grava uma linha em `ajudas_valores_por_cliente_mes`
 * (origem='sistema') — a mesma tabela onde o backfill histórico gravou o
 * método declarado+rateio para o período de saneamento; daqui em diante é
 * este fluxo que a alimenta para faturas novas. Falha nesta escrita
 * também não é fatal (reportada em `erroValoresPorCliente`).
 *
 * @param {object} params
 * @param {string} params.mesReferencia
 * @param {string} params.clientId
 * @param {object} params.linha  a linha 'calculado' devolvida por verificarEstimativaParaFatura
 * @param {string|null} params.percentagemHistoricaId
 * @param {object} params.dbClient
 * @param {string} params.confirmadoPor
 * @param {function} params.criarFaturaFn
 * @param {number} [params.valorFaturaTotal]  valor final da fatura (pós-desconto/IVA) — gravado em ajudas_estimativas_fatura.valor_fatura, na coluna total_fatura da tabela legada, e em ajudas_valores_por_cliente_mes.valor_fatura
 */
export async function confirmarEEmitirFatura({
  mesReferencia, clientId, linha, percentagemHistoricaId, dbClient, confirmadoPor, criarFaturaFn, valorFaturaTotal,
}) {
  if (!linha || linha.status !== 'calculado') {
    throw new Error('confirmarEEmitirFatura só pode ser chamada com uma linha calculada — nunca bloqueada.');
  }

  const agora = new Date().toISOString();

  const { data: existente, error: errBusca } = await dbClient
    .from('ajudas_estimativas_fatura')
    .select('id')
    .eq('mes', mesReferencia)
    .eq('client_id', clientId)
    .is('fatura_id', null)
    .in('status', ['calculado', 'confirmado'])
    .maybeSingle();
  if (errBusca) throw errBusca;

  const camposConfirmado = {
    percentagem_historica_id: percentagemHistoricaId,
    residuo_mes_anterior_aplicado: linha.residuoAplicado,
    valor_fatura: valorFaturaTotal ?? null,
    valor_estimado_bruto: linha.valorEstimadoBruto,
    valor_final: linha.valorFinal,
    status: 'confirmado',
    confirmado_por: confirmadoPor,
    confirmado_em: agora,
  };

  let estimativaId;
  if (existente) {
    const { error } = await dbClient.from('ajudas_estimativas_fatura').update(camposConfirmado).eq('id', existente.id);
    if (error) throw error;
    estimativaId = existente.id;
  } else {
    const { data: inserido, error } = await dbClient
      .from('ajudas_estimativas_fatura')
      .insert({ mes: mesReferencia, client_id: clientId, fatura_id: null, origem: 'estimativa', ...camposConfirmado })
      .select('id')
      .single();
    if (error) throw error;
    estimativaId = inserido.id;
  }

  // Formato PT (vírgula decimal, separador de milhares) — mesmo padrão já
  // usado em AjudasCustoAdmin.jsx (fmtEur). Escrever com ponto ("€91.86")
  // funcionava para o parser de releitura (_parseMonetario aceita ambos),
  // mas produzia texto incorreto na fatura fiscal em si — corrigido aqui,
  // na origem, não só na leitura.
  const valorFinalFormatado = linha.valorFinal.toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const textoObservacaoAjudas = `Estão incluídas nesta fatura €${valorFinalFormatado} referentes a ajudas de custo.`;

  let resultadoCriacao;
  try {
    resultadoCriacao = await criarFaturaFn({ textoObservacaoAjudas, valorFinal: linha.valorFinal });
  } catch (e) {
    // Falha na API — mantém 'confirmado', não regride, não perde o registo
    // da confirmação humana já gravado acima.
    return { confirmado: true, faturado: false, estimativaId, textoObservacaoAjudas, erro: e.message };
  }

  if (!resultadoCriacao?.faturaId) {
    return {
      confirmado: true, faturado: false, estimativaId, textoObservacaoAjudas,
      erro: resultadoCriacao?.error || 'Falha ao criar fatura — sem ID devolvido pelo TOConline.',
    };
  }

  const { error: errUpdate } = await dbClient
    .from('ajudas_estimativas_fatura')
    .update({ status: 'faturado', fatura_id: resultadoCriacao.faturaId })
    .eq('id', estimativaId);
  if (errUpdate) throw errUpdate;

  let erroLegado = null;
  try {
    const { error } = await dbClient.from('ajudas_faturadas_clientes').upsert(
      {
        mes: mesReferencia,
        client_id: clientId,
        valor_ajudas: parseFloat(linha.valorFinal.toFixed(2)),
        total_fatura: valorFaturaTotal != null ? parseFloat(Number(valorFaturaTotal).toFixed(2)) : null,
        confirmado: true,
      },
      { onConflict: 'mes,client_id' }
    );
    if (error) erroLegado = error.message;
  } catch (e) {
    erroLegado = e.message;
  }

  // Alimenta ajudas_valores_por_cliente_mes com origem='sistema' — daqui
  // em diante, toda a nova emissão de fatura (Fase 2b) escreve aqui, tal
  // como o backfill histórico (origem 'declarado'/'distribuido') já
  // escreveu as faturas anteriores. 'sistema' é uma terceira origem: nem
  // declarado manualmente no passado, nem distribuído por resíduo do
  // saneamento — é o próprio sistema, via % histórica ativa, a decidir e
  // escrever no momento da emissão. Não fatal se falhar — a fatura já foi
  // emitida e ajudas_estimativas_fatura (fonte de verdade da Fase 2b) já
  // está correta.
  let erroValoresPorCliente = null;
  if (valorFaturaTotal == null) {
    erroValoresPorCliente = 'valorFaturaTotal não fornecido — linha não gravada em ajudas_valores_por_cliente_mes (valor_fatura é NOT NULL).';
  } else {
    try {
      const { data: clienteData, error: errCliente } = await dbClient
        .from('clients')
        .select('elegivel_ajudas_custo')
        .eq('id', clientId)
        .maybeSingle();
      if (errCliente) throw errCliente;

      const { error } = await dbClient.from('ajudas_valores_por_cliente_mes').upsert(
        {
          mes: mesReferencia,
          client_id: clientId,
          fatura_id: resultadoCriacao.faturaId,
          valor_fatura: Number(valorFaturaTotal),
          valor_declarado: null,
          valor_atribuido: linha.valorFinal,
          origem: 'sistema',
          elegivel_na_data: clienteData?.elegivel_ajudas_custo ?? null,
        },
        { onConflict: 'mes,client_id,fatura_id' }
      );
      if (error) erroValoresPorCliente = error.message;
    } catch (e) {
      erroValoresPorCliente = e.message;
    }
  }

  return {
    confirmado: true, faturado: true, estimativaId, faturaId: resultadoCriacao.faturaId, textoObservacaoAjudas,
    erroLegado, erroValoresPorCliente,
  };
}
