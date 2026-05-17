import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).href;

const MESES_MAP = {
  janeiro: '01', fevereiro: '02', março: '03', abril: '04',
  maio: '05', junho: '06', julho: '07', agosto: '08',
  setembro: '09', outubro: '10', novembro: '11', dezembro: '12',
};

function parseMoeda(str) {
  return parseFloat(str.replace(/\./g, '').replace(',', '.').replace('€', '').trim());
}

export async function extrairTextoPdf(file) {
  const paginas = await extrairPaginasPdf(file);
  return paginas.join('\n');
}

// Retorna array de strings, uma por página — permite processar PDFs com múltiplos recibos
export async function extrairPaginasPdf(file) {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
  const paginas = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    paginas.push(content.items.map(item => item.str).join(' '));
  }
  return paginas;
}

// Extrai nome do trabalhador e mês a partir do texto do PDF TOConline
export function extrairMetadadosTOConline(text) {
  // Mês: "De 1 de Abril 2026"
  const mesMatch = text.match(/De \d+ de (\w+) (\d{4})/i);
  const mes = mesMatch
    ? `${mesMatch[2]}-${MESES_MAP[mesMatch[1].toLowerCase()] ?? '??'}`
    : null;

  // Nome: entre número de 9+ dígitos (NIS/NIF) e valor monetário
  // Texto real: "317734083 EDILSON SOUSA DO NASCIMENTO 1.000,00€"
  const nomeMatch = text.match(/\d{9,}\s+([A-ZÁÀÂÃÉÊÍÓÔÕÚÇÜÑ][A-ZÁÀÂÃÉÊÍÓÔÕÚÇÜÑ\s]+?)\s+[\d.,]+€/);
  const nome = nomeMatch ? nomeMatch[1].trim() : null;

  return { nome, mes };
}

export function parseReciboTOConline(text, brutoPlataforma) {
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

  // Padrão real TOConline: "Total Descontos  136,99€  Total Abonos  3.249,00€   3.112,01€"
  const regex = /Total Descontos\s+([\d.,]+€)\s+Total Abonos\s+([\d.,]+€)\s+([\d.,]+€)/;
  const match = text.match(regex);

  if (!match) {
    return {
      sucesso: false,
      valido: false,
      abonosExtraidos: null,
      descontosExtraidos: null,
      liquidoExtraido: null,
      divergencia: null,
      mensagem: 'Não foi possível extrair os totais do recibo. Verifique o formato do PDF.',
      _textoExtraido: text,
    };
  }

  const descontosExtraidos = parseMoeda(match[1]);
  const abonosExtraidos    = parseMoeda(match[2]);
  const liquidoExtraido    = parseMoeda(match[3]);

  const liquidoCalculado = brutoPlataforma - descontosExtraidos;
  const divergencia      = Math.abs(liquidoCalculado - liquidoExtraido);
  const valido           = divergencia <= 0.02;

  return {
    sucesso: true,
    valido,
    abonosExtraidos,
    descontosExtraidos,
    liquidoExtraido,
    divergencia: valido ? 0 : parseFloat(divergencia.toFixed(2)),
    mensagem: valido
      ? `Recibo válido. Bruto ${brutoPlataforma}€ - Descontos ${descontosExtraidos}€ = Líquido ${liquidoExtraido}€.`
      : `Divergência de ${divergencia.toFixed(2)}€. Esperado líquido ${liquidoCalculado.toFixed(2)}€, recibo tem ${liquidoExtraido}€.`,
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
