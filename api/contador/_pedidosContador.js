import * as XLSX from 'xlsx';
import { callGeminiJSON } from '../parse-fatura.js';

// Lógica partilhada da reescrita do fluxo de resposta a emails do contador —
// classificação de tipo de pedido, parsing do anexo "faturas em falta"
// (PDF ou Excel) e cruzamento com a tabela `faturas`. Usado por
// api/contador/index.js (handleGerar) e por api/gmail/import-faturas.js
// (classificação no momento da importação).

// ---------------------------------------------------------------------------
// Classificação do tipo de pedido (Fase A)
// ---------------------------------------------------------------------------

export const TIPOS_PEDIDO = ['faturas_em_falta', 'extratos_bancarios_em_falta', 'cobranca', 'outro'];

export function buildClassificacaoPrompt(assunto, texto) {
  return `Classifica o email abaixo, enviado pelo contabilista da empresa, num destes 4 tipos exatos:

- "faturas_em_falta": pede o envio de documentos/faturas de fornecedores que já constam no e-Fatura mas ainda não foram enviados para a contabilidade (normalmente com uma lista/relatório em anexo).
- "extratos_bancarios_em_falta": pede extratos ou movimentos bancários mensais em falta.
- "cobranca": o próprio contabilista está a cobrar um valor específico (honorários, um serviço prestado por ele).
- "outro": qualquer outra coisa que não encaixe claramente nas anteriores.

Responde APENAS com um objeto JSON no formato exato, sem markdown, sem texto antes ou depois:
{ "tipo": "faturas_em_falta" | "extratos_bancarios_em_falta" | "cobranca" | "outro" }

Assunto: ${assunto || '(sem assunto)'}

Texto do email:
${texto.slice(0, 3000)}`;
}

// Nunca assume 'cobranca' por omissão em caso de falha — 'outro' força revisão
// manual, que é o resultado seguro quando não há confiança na classificação.
export async function classificarTipoPedido(assunto, texto) {
  try {
    const { data } = await callGeminiJSON(buildClassificacaoPrompt(assunto, texto));
    if (TIPOS_PEDIDO.includes(data?.tipo)) return data.tipo;
  } catch { /* cai no fallback abaixo */ }
  return 'outro';
}

// ---------------------------------------------------------------------------
// Normalização e matching (Fase C, ponto 3)
// ---------------------------------------------------------------------------

// Mantém só os dígitos do número de documento — remove prefixos de série
// (ex: "F2 F43D/", "FR 2026-AA/"), barras e espaços. TOConline formata o
// número de forma diferente do que já guardamos em faturas.dados.numero_fatura
// (ex: "F2 F43D/4314117912" vs "4314117912" já na BD).
export function normalizarNumeroDocumento(raw) {
  if (!raw) return '';
  const digitos = String(raw).replace(/\D/g, '');
  return digitos.replace(/^0+/, '') || digitos;
}

// Compara por sufixo em vez de igualdade exata — números muito curtos (<4
// dígitos) são ignorados para evitar falsos positivos (ex: "12" bateria com
// qualquer número terminado em "12").
export function documentosBatem(a, b) {
  const na = normalizarNumeroDocumento(a);
  const nb = normalizarNumeroDocumento(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  const minLen = Math.min(na.length, nb.length);
  if (minLen < 4) return false;
  return na.endsWith(nb) || nb.endsWith(na);
}

const SUFIXOS_LEGAIS = /\b(s\.?a\.?|s\.?l\.?l?\.?|lda\.?|unipessoal|limited|ltd|inc)\b/gi;

function palavrasFornecedor(nome) {
  return String(nome || '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(SUFIXOS_LEGAIS, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 1);
}

// Similaridade de Jaccard sobre o conjunto de palavras (0..1) — suficiente
// para desempatar entre candidatos com o mesmo número de documento, sem
// precisar de uma biblioteca de fuzzy-matching dedicada.
export function similaridadeFornecedor(a, b) {
  const wa = new Set(palavrasFornecedor(a));
  const wb = new Set(palavrasFornecedor(b));
  if (wa.size === 0 || wb.size === 0) return 0;
  let intersecao = 0;
  for (const w of wa) if (wb.has(w)) intersecao++;
  const uniao = new Set([...wa, ...wb]).size;
  return uniao === 0 ? 0 : intersecao / uniao;
}

// ---------------------------------------------------------------------------
// Parsing do anexo "faturas em falta" (Fase C, pontos 1-2)
// ---------------------------------------------------------------------------

const PALAVRAS_CHAVE_DOC = ['número do documento', 'numero do documento', 'nº documento', 'documento do fornecedor', 'número', 'numero', 'nº'];
const PALAVRAS_CHAVE_VALOR = ['valor líquido', 'valor liquido', 'total do documento', 'valor'];

function pareceNif(v) {
  return /^\d{9}$/.test(String(v || '').trim());
}

function paraNumero(v) {
  if (v == null || v === '') return null;
  const s = String(v).trim().replace(/\s/g, '');
  if (!s) return null;
  // Só assume formato PT (milhar com ponto, decimal com vírgula) se houver
  // vírgula presente — senão o ponto já é o separador decimal (é o que o
  // SheetJS devolve com raw:false para o ficheiro real da Fiscomelres).
  const normalizado = s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s;
  const n = parseFloat(normalizado);
  return isNaN(n) ? null : n;
}

// Parsing determinístico do .xlsx — sem passar por IA, já que é um relatório
// tabular estruturado. Estrutura CONFIRMADA contra o ficheiro real recebido
// da Fiscomelres ("Faturas em falta.xlsx", 11/08/2026): folha única "Dados",
// tabela plana de colunas NIF | Nome | Número | Data | Total do documento —
// fornecedor repetido em cada linha, SEM agrupamento (ao contrário do que a
// versão em PDF do mesmo relatório sugeria visualmente). Mantém-se como
// segundo caminho (fallback) o formato agrupado — para o caso de o
// contabilista voltar a exportar num formato diferente — mas o caminho
// principal agora é o plano, validado contra dados reais.
export function parseXlsxFaturasEmFalta(buffer) {
  const wb = XLSX.read(buffer, { type: 'buffer' });
  const linhas = [];

  for (const sheetName of wb.SheetNames) {
    const sheet = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, raw: false });

    let colNif = -1, colNome = -1, colDoc = -1, colData = -1, colValor = -1, headerRowIdx = -1;
    rows.forEach((row, i) => {
      if (headerRowIdx !== -1) return;
      const norm = row.map(c => String(c || '').toLowerCase().trim());
      const iDoc = norm.findIndex(c => PALAVRAS_CHAVE_DOC.some(k => c.includes(k)));
      if (iDoc === -1) return;
      colDoc = iDoc;
      colNif = norm.findIndex(c => c === 'nif' || c.includes('nif fornecedor') || c.includes('nif do fornecedor'));
      colNome = norm.findIndex(c => c === 'nome' || c.includes('fornecedor') || c.includes('entidade'));
      colData = norm.findIndex(c => c.includes('data') && !c.includes('lanc'));
      colValor = norm.findIndex(c => PALAVRAS_CHAVE_VALOR.some(k => c.includes(k)));
      headerRowIdx = i;
    });

    if (headerRowIdx === -1) continue; // folha sem o formato esperado — ignora

    let fornecedorAtual = null; // só usado no fallback (formato agrupado)
    for (let i = headerRowIdx + 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.every(c => c === null || c === '')) continue;

      // Caminho principal (confirmado): NIF e Nome em colunas próprias,
      // preenchidos em todas as linhas.
      if (colNif >= 0 && colNome >= 0) {
        const numeroDoc = colDoc >= 0 ? String(row[colDoc] ?? '').trim() : '';
        if (!numeroDoc) continue;
        linhas.push({
          fornecedor: String(row[colNome] ?? '').trim() || null,
          nif_fornecedor: String(row[colNif] ?? '').trim() || null,
          numero_documento: numeroDoc,
          data: colData >= 0 ? (row[colData] || null) : null,
          valor: colValor >= 0 ? paraNumero(row[colValor]) : null,
        });
        continue;
      }

      // Fallback: formato agrupado (linha "NIF Nome" isolada, seguida de
      // linhas de documento sem NIF/Nome próprios) — não confirmado contra
      // nenhum ficheiro real ainda, mantido por segurança.
      const col0 = String(row[0] ?? '').trim();
      const col1 = String(row[1] ?? '').trim();
      const numPreenchidas = row.filter(c => c !== null && c !== '').length;

      if (pareceNif(col0) && col1 && numPreenchidas <= 3) {
        fornecedorAtual = { nif: col0, nome: col1 };
        continue;
      }

      const numeroDoc = colDoc >= 0 ? String(row[colDoc] ?? '').trim() : '';
      if (!numeroDoc) continue;

      linhas.push({
        fornecedor: fornecedorAtual?.nome || null,
        nif_fornecedor: fornecedorAtual?.nif || null,
        numero_documento: numeroDoc,
        data: colData >= 0 ? (row[colData] || null) : null,
        valor: colValor >= 0 ? paraNumero(row[colValor]) : null,
      });
    }
  }
  return linhas;
}

// Extração via Gemini para a versão PDF do mesmo relatório — texto extraído
// de PDF tabular perde a estrutura de colunas, por isso aqui não há forma
// determinística fiável; usa-se IA para reconstituir a lista.
export function buildFaturasEmFaltaPdfPrompt(texto) {
  return `O texto abaixo é um relatório de faturas de fornecedores em falta (ex: "Mapa de conferência e-Fatura" do TOConline), enviado pelo contabilista. Extrai TODAS as linhas de documentos listados.

Devolve um array JSON, um item por documento, no formato exato:
[
  { "fornecedor": "nome do fornecedor", "nif_fornecedor": "NIF de 9 dígitos ou null", "numero_documento": "número do documento tal como aparece", "data": "YYYY-MM-DD ou null", "valor": número decimal ou null },
  ...
]

Regras:
- O nome do fornecedor normalmente aparece numa linha de cabeçalho de grupo (com o NIF antes do nome), seguida de várias linhas de documentos desse fornecedor — associa cada documento ao fornecedor do grupo a que pertence.
- numero_documento: usa o valor tal como aparece na coluna "Número do documento", sem o reinterpretares.
- Ignora linhas de subtotal, cabeçalhos de coluna e rodapés.
- Responde APENAS com o array JSON, sem markdown, sem texto antes ou depois.

Texto do relatório:
${texto.slice(0, 12000)}`;
}

export async function extrairLinhasFaturasEmFalta({ kind, buffer, textoPdf }) {
  if (kind === 'xlsx') return parseXlsxFaturasEmFalta(buffer);
  if (kind === 'pdf' && textoPdf) {
    const { data } = await callGeminiJSON(buildFaturasEmFaltaPdfPrompt(textoPdf));
    return Array.isArray(data) ? data : [];
  }
  return [];
}

// ---------------------------------------------------------------------------
// Cruzamento com a tabela `faturas` (Fase C, pontos 3-4)
// ---------------------------------------------------------------------------

export async function cruzarFaturasEmFalta(supabase, linhas) {
  const { data: faturas, error } = await supabase
    .from('faturas')
    .select('id, filename, storage_path, mime_type, dados, entidade');
  if (error) throw new Error(`Erro ao carregar faturas para cruzamento: ${error.message}`);

  const encontradas = [];
  const emFalta = [];

  for (const linha of linhas) {
    const candidatos = (faturas || []).filter(f => documentosBatem(linha.numero_documento, f.dados?.numero_fatura));

    if (candidatos.length === 0) {
      emFalta.push({ ...linha, motivo: 'sem_correspondencia' });
      continue;
    }

    if (candidatos.length === 1) {
      encontradas.push({ ...linha, fatura: candidatos[0] });
      continue;
    }

    // Múltiplos candidatos com o mesmo número normalizado — desempata por
    // similaridade do nome do fornecedor. Sem vencedor claro, NÃO adivinha.
    const pontuados = candidatos
      .map(f => ({ fatura: f, score: similaridadeFornecedor(linha.fornecedor, f.dados?.fornecedor || f.entidade) }))
      .sort((a, b) => b.score - a.score);

    const [melhor, segundo] = pontuados;
    if (melhor.score >= 0.5 && (!segundo || melhor.score - segundo.score >= 0.2)) {
      encontradas.push({ ...linha, fatura: melhor.fatura });
    } else {
      emFalta.push({ ...linha, motivo: 'ambiguo', candidatos: candidatos.length });
    }
  }

  return { encontradas, emFalta };
}

// ---------------------------------------------------------------------------
// Extratos bancários em falta (Fase D) — SEM tabela fiável de "já enviámos
// este extrato ao contabilista". `movimentos_bancarios` existe mas é o feed
// de transações ao vivo via Powens AIS (conta bancária própria), não um
// registo de documentos entregues à contabilidade — cruzar contra essa
// tabela daria uma falsa confirmação. Por isso este fluxo só classifica e
// lista o que percebeu do pedido, nunca afirma "já enviado".
// ---------------------------------------------------------------------------

export function buildExtratosBancariosPrompt(texto) {
  return `O texto abaixo é um email do contabilista a pedir extratos ou movimentos bancários mensais em falta. Identifica, se possível, os bancos e/ou meses mencionados.

Devolve APENAS um objeto JSON no formato exato, sem markdown, sem texto antes ou depois:
{
  "pedidos": [ { "banco": "nome do banco ou null", "mes_referencia": "YYYY-MM ou null" } ],
  "texto_livre": "resumo curto em português do que está a ser pedido, preenchido apenas se não for possível identificar banco/mês estruturadamente"
}

Se não conseguires identificar nenhum banco/mês específico, devolve "pedidos": [] e preenche "texto_livre".

Texto do email:
${texto.slice(0, 3000)}`;
}

export async function extrairPedidoExtratosBancarios(texto) {
  try {
    const { data } = await callGeminiJSON(buildExtratosBancariosPrompt(texto));
    return { pedidos: Array.isArray(data?.pedidos) ? data.pedidos : [], texto_livre: data?.texto_livre || null };
  } catch {
    return { pedidos: [], texto_livre: null };
  }
}
