// Leitura de faturas de venda reais do TOConline, resolvidas para clientId
// por correspondência de nome. Extraído de percentagemHistorica.js para um
// módulo neutro — valoresPorFatura.js (calcularValoresPorClienteMes) e
// percentagemHistorica.js (buscarFaturasVendasPeriodo, re-exportado de lá
// por compatibilidade) precisam ambos disto, e um não pode depender do
// outro sem criar um import circular (consolidarTotalReal, em
// percentagemHistorica.js, chama calcularValoresPorClienteMes).

import { authFetch } from '../../utils/authFetch.js';

// Tipos de documento de venda do TOConline que representam receita real de
// cliente. Exclui NC/ND (notas de crédito/débito) e GT/GR/ORC/PROJ/NAFT
// (guias, orçamentos, projetos, documentos não fiscais).
export const TOCONLINE_TIPOS_RECEITA = ['FT', 'FR', 'FS', 'FRS', 'VD'];

function normalizarNome(s) {
  return (s || '').toLowerCase().trim();
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
export async function buscarFaturasVendasPeriodo({ periodoInicio, periodoFim, dbClient, fetchVendasFn = fetchVendasTOConline }) {
  const { data: clientsData, error: errClients } = await dbClient
    .from('clients')
    .select('id, name, elegivel_ajudas_custo');
  if (errClients) throw errClients;
  const clientsAll = clientsData || [];

  // Bug corrigido: "${periodoFim}-31" é uma data inválida em qualquer mês
  // com menos de 31 dias (fev, abr, jun, set, nov) — a API do TOConline
  // rejeita com 500. Nunca se manifestava antes porque esta função só era
  // chamada com intervalos multi-mês a terminar tipicamente em meses de 31
  // dias; calcularValoresPorClienteMes (valoresPorFatura.js) passou a
  // chamar mês a mês, expondo o caso para qualquer mês curto.
  const [anoFim, mesFim] = periodoFim.split('-').map(Number);
  const ultimoDiaFim = new Date(anoFim, mesFim, 0).getDate();
  const dataDe = `${periodoInicio}-01`;
  const dataAte = `${periodoFim}-${String(ultimoDiaFim).padStart(2, '0')}`;
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
