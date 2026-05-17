import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).href;

function parseMoeda(str) {
  return parseFloat(str.replace(/\./g, '').replace(',', '.').replace('€', '').trim());
}

async function extrairTextoPdf(file) {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
  const paginas = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    paginas.push(content.items.map(item => item.str).join(' '));
  }
  return paginas.join('\n');
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
