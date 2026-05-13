import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

const INDIGO = rgb(0.31, 0.275, 0.898);
const INDIGO_BG_SOFT = rgb(0.973, 0.98, 1.0);
const INDIGO_BORDER_SOFT = rgb(0.886, 0.91, 0.96);
const SLATE_900 = rgb(0.059, 0.09, 0.165);
const SLATE_600 = rgb(0.39, 0.455, 0.545);
const SLATE_400 = rgb(0.58, 0.639, 0.722);
const SLATE_300 = rgb(0.796, 0.835, 0.882);
const SLATE_100 = rgb(0.945, 0.965, 0.976);
const EMERALD = rgb(0.063, 0.725, 0.506);

/**
 * Gera um SVG path de rectângulo com cantos arredondados, com origem
 * em (0, 0) e altura `h` em SVG (eixo Y descendente).
 *
 * Para o posicionar corretamente em PDF com pdf-lib, usa o wrapper
 * drawRoundedRect que compensa o flip Y aplicado por drawSvgPath.
 */
function roundedRectPath(w, h, r) {
  return `M ${r},0 L ${w - r},0 Q ${w},0 ${w},${r} L ${w},${h - r} Q ${w},${h} ${w - r},${h} L ${r},${h} Q 0,${h} 0,${h - r} L 0,${r} Q 0,0 ${r},0 Z`;
}

/**
 * Desenha um rectângulo arredondado em coordenadas PDF (x, y = canto
 * inferior-esquerdo). Trata o Y-flip que pdf-lib aplica em drawSvgPath
 * por defeito, traduzindo a origem do path para PDF (x, y + h).
 */
function drawRoundedRect(page, { x, y, w, h, r, color, borderColor, borderWidth = 0 }) {
  page.drawSvgPath(roundedRectPath(w, h, r), {
    x,
    y: y + h,
    color,
    borderColor,
    borderWidth,
  });
}

async function blobOrDataUrlToBytes(input) {
  if (!input) return null;
  if (input instanceof Blob) return new Uint8Array(await input.arrayBuffer());
  if (typeof input === 'string' && input.startsWith('data:')) {
    const res = await fetch(input);
    return new Uint8Array(await res.arrayBuffer());
  }
  if (input instanceof ArrayBuffer) return new Uint8Array(input);
  if (input instanceof Uint8Array) return input;
  throw new Error('Tipo de entrada não suportado.');
}

async function tryEmbedImage(pdfDoc, bytes) {
  if (!bytes) return null;
  try {
    return await pdfDoc.embedPng(bytes);
  } catch (_) { }
  try {
    return await pdfDoc.embedJpg(bytes);
  } catch (err) {
    console.warn('[pdfSigningService] Imagem não suportada (não é PNG nem JPG).');
    return null;
  }
}

export async function addSignatureProtocolPage(pdfInput, {
  workerName = 'Trabalhador',
  signatureDataUrl,
  signedAt,
  signedIp,
  documentId,
  documentTitle,
  serialLabel,
  qrDataUrl,
  companyLogoBytes,
}) {
  const pdfBytes = await blobOrDataUrlToBytes(pdfInput);
  const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const page = pdfDoc.addPage([595.28, 841.89]);
  const { width, height } = page.getSize();
  const margin = 50;

  page.drawRectangle({
    x: 0, y: height - 90, width, height: 90,
    color: rgb(0.953, 0.957, 0.984),
  });

  const logoImage = await tryEmbedImage(pdfDoc, await blobOrDataUrlToBytes(companyLogoBytes));
  let titleX = margin;
  if (logoImage) {
    const logoMaxH = 40;
    const logoRatio = logoImage.width / logoImage.height;
    const logoH = Math.min(logoMaxH, logoImage.height);
    const logoW = logoH * logoRatio;
    page.drawImage(logoImage, {
      x: margin, y: height - 65,
      width: logoW, height: logoH,
    });
    titleX = margin + logoW + 16;
  }

  page.drawText('PROTOCOLO DE ASSINATURA ELETRÓNICA', {
    x: titleX, y: height - 50,
    size: 15, font: helveticaBold, color: INDIGO,
  });
  page.drawText('Documento validado com integridade digital', {
    x: titleX, y: height - 68,
    size: 9, font: helvetica, color: SLATE_600,
  });

  let cursorY = height - 130;

  const drawRow = (label, value, valueColor = SLATE_900) => {
    page.drawText(label, {
      x: margin, y: cursorY,
      size: 9, font: helveticaBold, color: SLATE_400,
    });
    page.drawText(String(value ?? '—'), {
      x: margin + 120, y: cursorY,
      size: 10, font: helvetica, color: valueColor,
    });
    cursorY -= 22;
  };

  if (documentTitle) drawRow('DOCUMENTO', documentTitle);
  drawRow('TRABALHADOR', workerName);
  drawRow('DATA / HORA', signedAt ? new Date(signedAt).toLocaleString('pt-PT') : '—');
  drawRow('ENDEREÇO IP', signedIp || 'Desconhecido');
  if (serialLabel) drawRow('Nº DE SÉRIE', serialLabel, INDIGO);
  if (documentId) drawRow('ID DO DOCUMENTO', String(documentId));

  cursorY -= 10;
  page.drawLine({
    start: { x: margin, y: cursorY },
    end: { x: width - margin, y: cursorY },
    thickness: 0.5, color: SLATE_400,
  });
  cursorY -= 24;

  page.drawText('ASSINATURA DO TRABALHADOR', {
    x: margin, y: cursorY,
    size: 9, font: helveticaBold, color: SLATE_400,
  });
  cursorY -= 16;

  const qrImage = await tryEmbedImage(pdfDoc, await blobOrDataUrlToBytes(qrDataUrl));
  const qrSize = 70;
  const sigBoxX = margin;
  const sigBoxY = cursorY - 110;
  const sigBoxW = (width - margin * 2) - (qrImage ? qrSize + 16 : 0);
  const sigBoxH = 110;

  page.drawRectangle({
    x: sigBoxX, y: sigBoxY, width: sigBoxW, height: sigBoxH,
    color: SLATE_100, borderColor: SLATE_400, borderWidth: 0.5,
  });

  if (signatureDataUrl) {
    try {
      const sigBytes = await blobOrDataUrlToBytes(signatureDataUrl);
      const sigImage = await pdfDoc.embedPng(sigBytes);
      const targetW = Math.min(250, sigBoxW - 20);
      const ratio = sigImage.height / sigImage.width;
      const drawW = targetW;
      const drawH = targetW * ratio;
      const cx = sigBoxX + sigBoxW / 2 - drawW / 2;
      const cy = sigBoxY + sigBoxH / 2 - drawH / 2;
      page.drawImage(sigImage, { x: cx, y: cy, width: drawW, height: drawH });
    } catch (err) {
      console.warn('[pdfSigningService] Falha a desenhar assinatura:', err);
    }
  }

  if (qrImage) {
    const qrX = width - margin - qrSize;
    const qrY = sigBoxY + (sigBoxH - qrSize) / 2;
    page.drawRectangle({
      x: qrX - 4, y: qrY - 4, width: qrSize + 8, height: qrSize + 8,
      color: rgb(1, 1, 1), borderColor: SLATE_400, borderWidth: 0.5,
    });
    page.drawImage(qrImage, { x: qrX, y: qrY, width: qrSize, height: qrSize });
    page.drawText('VERIFICAR', {
      x: qrX + qrSize / 2 - 18, y: qrY - 10,
      size: 6, font: helveticaBold, color: SLATE_400,
    });
  }

  cursorY = sigBoxY - 26;

  page.drawCircle({
    x: margin + 6, y: cursorY + 4, size: 6, color: EMERALD,
  });
  page.drawText('Documento validado eletronicamente', {
    x: margin + 18, y: cursorY,
    size: 10, font: helveticaBold, color: EMERALD,
  });

  cursorY -= 30;
  const disclaimer = [
    'Este documento foi preenchido a partir do template original e convertido para PDF.',
    'A assinatura aqui aposta tem valor probatório, registando o consentimento do trabalhador',
    'no momento e endereço IP indicados acima. O documento original Word foi processado',
    'pelo sistema Magnetic Place e armazenado de forma íntegra após esta assinatura.',
  ];
  for (const line of disclaimer) {
    page.drawText(line, { x: margin, y: cursorY, size: 9, font: helvetica, color: SLATE_600 });
    cursorY -= 14;
  }

  page.drawText(`Gerado em ${new Date().toLocaleString('pt-PT')}`, {
    x: margin, y: 40,
    size: 8, font: helvetica, color: SLATE_400,
  });

  return await pdfDoc.save();
}

export async function applyQrToAllPages(pdfInput, qrDataUrl, { verifyLabel = 'VERIFICAR', qrSize = 56, margin = 24 } = {}) {
  const pdfBytes = await blobOrDataUrlToBytes(pdfInput);
  const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });

  const qrBytes = await blobOrDataUrlToBytes(qrDataUrl);
  const qrImage = await tryEmbedImage(pdfDoc, qrBytes);
  if (!qrImage) {
    console.warn('[pdfSigningService] QR não disponível — pulando overlay.');
    return await pdfDoc.save();
  }

  const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const pages = pdfDoc.getPages();

  for (const page of pages) {
    const { width } = page.getSize();
    const labelH = 10;
    const boxPad = 4;
    const boxX = width - qrSize - margin - boxPad;
    const boxY = margin;
    const boxW = qrSize + boxPad * 2;
    const boxH = qrSize + boxPad * 2 + labelH;

    page.drawRectangle({
      x: boxX, y: boxY, width: boxW, height: boxH,
      color: rgb(1, 1, 1),
    });
    page.drawImage(qrImage, {
      x: boxX + boxPad, y: boxY + boxPad + labelH,
      width: qrSize, height: qrSize,
    });
    const labelWidth = font.widthOfTextAtSize(verifyLabel, 6);
    page.drawText(verifyLabel, {
      x: boxX + boxW / 2 - labelWidth / 2,
      y: boxY + boxPad,
      size: 6,
      font,
      color: SLATE_400,
    });
  }

  return await pdfDoc.save();
}

// Conversão mm para pontos PDF (1 mm = 2.83465 pt)
const MM_TO_PT = 2.83465;

/**
 * Aplica o carimbo de assinatura digital no PDF, desenhado vetorialmente.
 *
 * @param {Blob|Uint8Array|ArrayBuffer} pdfInput
 * @param {Object} options
 * @param {string} options.workerName
 * @param {string} options.signatureDataUrl - PNG/JPEG data URL da assinatura desenhada
 * @param {string} options.signedAt - ISO date
 * @param {string} options.signedIp
 * @param {string} options.serialLabel
 * @param {number} options.xMm - Canto inferior-esquerdo X em mm
 * @param {number} options.yMm - Canto inferior-esquerdo Y em mm
 * @param {string} options.page - 'first' | 'last' | 'all'
 * @param {number} options.stampWidthMm - default 70
 * @param {number} options.stampHeightMm - default 25
 */
export async function applyStampToPage(pdfInput, {
  workerName = '',
  signatureDataUrl = null,
  signedAt = null,
  signedIp = '',
  serialLabel = '',
  xMm = 130,
  yMm = 30,
  page = 'last',
  stampWidthMm = 70,
  stampHeightMm = 25,
} = {}) {
  const pdfBytes = await blobOrDataUrlToBytes(pdfInput);
  const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });

  const helv = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helvBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  let signatureImage = null;
  if (signatureDataUrl) {
    const sigBytes = await blobOrDataUrlToBytes(signatureDataUrl);
    signatureImage = await tryEmbedImage(pdfDoc, sigBytes);
  }

  const x = xMm * MM_TO_PT;
  const y = yMm * MM_TO_PT;
  const w = stampWidthMm * MM_TO_PT;
  const h = stampHeightMm * MM_TO_PT;

  const pages = pdfDoc.getPages();
  let targetPages = [];
  if (page === 'first') targetPages = [pages[0]];
  else if (page === 'last') targetPages = [pages[pages.length - 1]];
  else if (page === 'all') targetPages = pages;

  for (const targetPage of targetPages) {
    drawWorkerStamp(targetPage, {
      x, y, w, h,
      workerName, signatureImage, signedAt, signedIp, serialLabel,
      helv, helvBold,
    });
  }

  return await pdfDoc.save();
}

function drawWorkerStamp(page, {
  x, y, w, h,
  workerName, signatureImage, signedAt, signedIp, serialLabel,
  helv, helvBold,
}) {
  // ---- 1. Cartão exterior (cantos arredondados, fundo azul super claro) ----
  drawRoundedRect(page, {
    x, y, w, h, r: 6,
    color: INDIGO_BG_SOFT,
    borderColor: INDIGO_BORDER_SOFT,
    borderWidth: 0.8,
  });

  const pad = 5;

  // ---- 2. Caixa de assinatura (esquerda, ~28% da largura) ----
  const sigBoxW = Math.min(50, w * 0.28);
  const sigBoxH = h - pad * 2;
  const sigBoxX = x + pad;
  const sigBoxY = y + pad;

  drawRoundedRect(page, {
    x: sigBoxX, y: sigBoxY, w: sigBoxW, h: sigBoxH, r: 4,
    color: rgb(1, 1, 1),
    borderColor: INDIGO_BORDER_SOFT,
    borderWidth: 0.6,
  });

  if (signatureImage) {
    const imgPad = 3;
    const innerW = sigBoxW - imgPad * 2;
    const innerH = sigBoxH - imgPad * 2;
    const aspect = signatureImage.width / signatureImage.height;
    let drawW, drawH;
    if (aspect > innerW / innerH) {
      drawW = innerW;
      drawH = drawW / aspect;
    } else {
      drawH = innerH;
      drawW = drawH * aspect;
    }
    page.drawImage(signatureImage, {
      x: sigBoxX + (sigBoxW - drawW) / 2,
      y: sigBoxY + (sigBoxH - drawH) / 2,
      width: drawW,
      height: drawH,
    });
  } else {
    const placeholder = 'Assinatura';
    const tw = helv.widthOfTextAtSize(placeholder, 5);
    page.drawText(placeholder, {
      x: sigBoxX + (sigBoxW - tw) / 2,
      y: sigBoxY + sigBoxH / 2 - 1.5,
      size: 5, font: helv, color: SLATE_400,
    });
  }

  // ---- 3. Coluna direita ----
  const rightColX = sigBoxX + sigBoxW + 8;
  const rightEdge = x + w - pad - 2;
  const topY = y + h - pad - 4;

  // Badge verde com check branco
  const cx = rightColX + 4;
  const cy = topY - 2.5;
  page.drawCircle({ x: cx, y: cy, size: 4.5, color: EMERALD });
  page.drawLine({
    start: { x: cx - 2, y: cy - 0.3 },
    end: { x: cx - 0.5, y: cy - 1.8 },
    thickness: 1.1, color: rgb(1, 1, 1),
  });
  page.drawLine({
    start: { x: cx - 0.5, y: cy - 1.8 },
    end: { x: cx + 2.3, y: cy + 1.4 },
    thickness: 1.1, color: rgb(1, 1, 1),
  });

  page.drawText('VALIDAÇÃO DIGITAL', {
    x: cx + 8,
    y: topY - 4,
    size: 7,
    font: helvBold,
    color: INDIGO,
  });

  // ---- 4. Linhas de dados (label esq · valor direita-alinhado) ----
  let dateStr = '—';
  if (signedAt) {
    const d = new Date(signedAt);
    const dPart = d.toLocaleDateString('pt-PT');
    const tPart = d.toLocaleTimeString('pt-PT', {
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
    dateStr = `${dPart}, ${tPart}`;
  }

  const fields = [];
  if (workerName) fields.push({ label: 'Nome:', value: workerName, color: SLATE_900 });
  fields.push({ label: 'Data/Hora:', value: dateStr, color: SLATE_900 });
  fields.push({ label: 'IP:', value: signedIp || '—', color: SLATE_900 });
  if (serialLabel) fields.push({ label: 'ID:', value: serialLabel, color: INDIGO });

  const labelSize = 5.5;
  const valueSize = 5.5;
  const rowHeight = fields.length > 3 ? 8.5 : 10.5;
  let currentY = topY - 16;

  for (const f of fields) {
    // Label à esquerda
    page.drawText(f.label, {
      x: rightColX, y: currentY,
      size: labelSize, font: helv, color: SLATE_600,
    });

    // Valor alinhado à direita (com truncagem se necessário)
    let valStr = f.value;
    const labelWidth = helv.widthOfTextAtSize(f.label, labelSize);
    const maxValWidth = rightEdge - rightColX - labelWidth - 6;

    let valWidth = helvBold.widthOfTextAtSize(valStr, valueSize);
    while (valWidth > maxValWidth && valStr.length > 3) {
      valStr = valStr.slice(0, -2) + '…';
      valWidth = helvBold.widthOfTextAtSize(valStr, valueSize);
    }

    page.drawText(valStr, {
      x: rightEdge - valWidth, y: currentY,
      size: valueSize, font: helvBold, color: f.color,
    });

    currentY -= rowHeight;
  }

  // ---- 5. Separador tracejado ----
  const lineY = y + 13;
  page.drawLine({
    start: { x: rightColX, y: lineY },
    end: { x: rightEdge, y: lineY },
    thickness: 0.5,
    color: SLATE_300,
    dashArray: [2, 2],
  });

  // ---- 6. Rodapé verde ----
  page.drawText('DOCUMENTO VALIDADO ELETRONICAMENTE', {
    x: rightColX,
    y: lineY - 6.5,
    size: 4.5,
    font: helvBold,
    color: EMERALD,
  });
}

export function formatSerialLabel(serial, prefix = 'MGN') {
  if (serial === null || serial === undefined) return null;
  const year = new Date().getFullYear();
  return `${prefix}-${year}-${String(serial).padStart(6, '0')}`;
}
