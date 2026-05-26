import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).href;

const MESES_MAP = {
  janeiro: '01', fevereiro: '02', 'marco': '03', março: '03', abril: '04',
  maio: '05', junho: '06', julho: '07', agosto: '08',
  setembro: '09', outubro: '10', novembro: '11', dezembro: '12',
};

function parseMoeda(str) {
  return parseFloat(str.replace(/\./g, '').replace(',', '.').replace('€', '').trim());
}

// Extrai o último valor em € de uma linha — em pdfjs, a coluna Abono aparece
// antes da coluna Desconto, por isso o último € é sempre o desconto real.
function ultimoEuroDaLinha(linha) {
  const matches = [...linha.matchAll(/([\d.,]+)€/g)];
  return matches.length > 0 ? parseMoeda(matches[matches.length - 1][1]) : 0;
}

export async function extrairTextoPdf(file) {
  const paginas = await extrairPaginasPdf(file);
  return paginas.join('\n');
}

// Retorna array de strings, uma por página.
// Cada página: uma linha por linha visual do PDF (agrupamento por coordenada Y).
// Isso preserva a ordem Abono→Desconto dentro de cada linha, necessária para
// extrair corretamente os descontos de SS e IRS.
export async function extrairPaginasPdf(file) {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
  const paginas = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();

    const items = content.items
      .filter(item => item.str?.trim())
      .map(item => ({ str: item.str, x: item.transform[4], y: item.transform[5] }))
      .sort((a, b) => b.y - a.y || a.x - b.x); // topo→fundo, esquerda→direita

    // Agrupa items com Y próximo (≤5px) na mesma linha
    const rows = [];
    for (const item of items) {
      const last = rows[rows.length - 1];
      if (last && Math.abs(item.y - last.y) < 5) {
        last.items.push(item);
      } else {
        rows.push({ y: item.y, items: [item] });
      }
    }

    paginas.push(rows.map(row => row.items.map(i => i.str).join(' ')).join('\n'));
  }
  return paginas;
}

// Extrai nome do trabalhador e mês a partir do texto do PDF TOConline
export function extrairMetadadosTOConline(text) {
  // Normalizar texto: remover acentos diacríticos (NFD) para lidar com PDF que extrai "Marco" em vez de "Março"
  const textoNorm = (text || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  // Mês: "De 1 de Abril 2026" (TOConline) ou "Mês: 04" + "Ano: 2026" (Skia/outros)
  const mesMatch = textoNorm.match(/De \d+ de (\w+) (\d{4})/i);
  const mes = mesMatch
    ? `${mesMatch[2]}-${MESES_MAP[mesMatch[1].toLowerCase()] ?? '??'}`
    : (() => {
        const m = text.match(/M[eê]s:\s*(\d{1,2})/i)?.[1];
        const a = text.match(/Ano:\s*(\d{4})/i)?.[1];
        return m && a ? `${a}-${String(m).padStart(2, '0')}` : null;
      })();

  // Nome: prioridade para a secção "Identificação do funcionário" (Skia/PDF),
  // fallback para o primeiro "Nome:" na página (TOConline — sem secção de empresa)
  let nome = null;
  const nomeSecção = text.match(/Identifica[cç][aã]o do funcion[aá]rio[\s\S]{0,200}?Nome:\s*([^\n]+)/i);
  const nomePrimeiro = text.match(/Nome:\s*([^\n]+)/);
  const nomeMatch = nomeSecção ?? nomePrimeiro;
  if (nomeMatch) {
    const raw = nomeMatch[1].split(/Nome:/)[0].trim();
    if (raw) nome = raw;
  }

  return { nome, mes };
}

export function parseReciboTOConline(text, brutoPlataforma, tolerancias = {}) {
  const toleranciaValido = tolerancias.valido ?? 0.77;
  const toleranciaAviso  = tolerancias.aviso  ?? 10;

  if (!text.includes('Emitido por TOConline')) {
    return {
      sucesso: false,
      valido: false,
      abonosExtraidos: null,
      descontosExtraidos: null,
      liquidoExtraido: null,
      divergencia: null,
      mensagem: 'Documento não reconhecido: frase "Emitido por TOConline" não encontrada.',
    };
  }

  // Totais reais do TOConline: labels numa linha, valores na linha seguinte (ORIGINAL + DUPLICADO)
  // "Total Abonos  Total Descontos  Total a Receber  Total Abonos  Total Descontos  Total a Receber"
  // "3.708,00€  213,64€  3.494,36€  3.708,00€  213,64€  3.494,36€"
  const totaisMatch = text.match(/Total Abonos.*?Total a Receber.*?([\d.,]+€).*?([\d.,]+€).*?([\d.,]+€)/s);

  if (!totaisMatch) {
    return {
      sucesso: false,
      valido: false,
      abonosExtraidos: null,
      ssExtraido: null,
      irsExtraido: null,
      liquidoExtraido: null,
      divergencia: null,
      mensagem: 'Não foi possível extrair os totais do recibo. Verifique o formato do PDF.',
      _textoExtraido: text,
    };
  }

  const abonosExtraidos = parseMoeda(totaisMatch[1]); // 1º valor = Total Abonos
  const liquidoExtraido = parseMoeda(totaisMatch[3]); // 3º valor = Total a Receber

  // SS: encontra a linha com "Segurança Social" e extrai o último € (= coluna Desconto)
  const ssLinha = text.match(/^.*Segurança Social.*$/m)?.[0] ?? '';
  const ssExtraido = ultimoEuroDaLinha(ssLinha);

  // IRS: encontra a linha com "IRS" e extrai o último € (= coluna Desconto)
  // Quando taxa=0%, a linha não contém €, logo irsExtraido fica 0.
  // O pdfjs coloca o valor da coluna Abono antes do Desconto, por isso
  // o último € é sempre o desconto de IRS e não a base tributável.
  const irsLinha = text.match(/^.*\bIRS\b.*$/m)?.[0] ?? '';
  const irsExtraido = ultimoEuroDaLinha(irsLinha);

  // Validação: apenas SS e IRS entram no cálculo; outros descontos são ignorados
const liquidoCalculado = (brutoPlataforma && brutoPlataforma > 0)
    ? brutoPlataforma - ssExtraido - irsExtraido
    : null;
  const divergenciaAbs = liquidoCalculado != null
    ? Math.abs(liquidoCalculado - liquidoExtraido)
    : null;
  const divergenciaSinal = divergenciaAbs != null
    ? parseFloat((liquidoExtraido - liquidoCalculado).toFixed(2))
    : null;

  const temBasePlataforma = brutoPlataforma && brutoPlataforma > 0;
  const validoRaw  = temBasePlataforma && divergenciaAbs != null ? divergenciaAbs <= toleranciaValido : true;
  const avisoRaw   = temBasePlataforma && divergenciaAbs != null ? (!validoRaw && divergenciaAbs <= toleranciaAviso) : false;

  const divStr  = divergenciaAbs != null ? divergenciaAbs.toFixed(2) : null;
  const calcStr = liquidoCalculado != null ? liquidoCalculado.toFixed(2) : null;

  return {
    sucesso: true,
    valido:  validoRaw,
    aviso:   avisoRaw,
    abonosExtraidos,
    ssExtraido,
    irsExtraido,
    liquidoExtraido,
    divergencia:      validoRaw ? 0 : parseFloat(divStr ?? '0'),
    divergenciaSinal,
    mensagem: !temBasePlataforma
      ? `Bruto plataforma não disponível — aceitei valor do PDF (${liquidoExtraido}€).`
      : validoRaw
        ? `Recibo válido. ${brutoPlataforma}€ - SS ${ssExtraido}€ - IRS ${irsExtraido}€ = ${liquidoExtraido}€.`
        : avisoRaw
          ? `Aviso: divergência de ${divStr}€ (margem tolerada). Esperado ${calcStr}€, recibo tem ${liquidoExtraido}€.`
          : `Divergência de ${divStr}€. Esperado ${calcStr}€, recibo tem ${liquidoExtraido}€.`,
  };
}

// file: objeto File (de um <input type="file"> ou drag-and-drop)
// brutoPlataforma: número float (ex: 3249.00)
export async function validarReciboTOConline(file, brutoPlataforma) {
  try {
    const text = await extrairTextoPdf(file);
    return parseReciboTOConline(text, brutoPlataforma);
  } catch (err) {
    return {
      sucesso: false,
      valido: false,
      abonosExtraidos: null,
      descontosExtraidos: null,
      liquidoExtraido: null,
      divergencia: null,
      mensagem: `Erro técnico: ${err.message}`,
    };
  }
}
