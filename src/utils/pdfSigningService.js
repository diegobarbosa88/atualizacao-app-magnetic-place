import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

const INDIGO = rgb(0.31, 0.275, 0.898);
const SLATE_900 = rgb(0.059, 0.09, 0.165);
const SLATE_600 = rgb(0.39, 0.455, 0.545);
const SLATE_400 = rgb(0.58, 0.639, 0.722);
const SLATE_100 = rgb(0.945, 0.965, 0.976);
const EMERALD = rgb(0.063, 0.725, 0.506);

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
  } catch (_) {}
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
    end:   { x: width - margin, y: cursorY },
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
      borderColor: SLATE_400,
      borderWidth: 0.5,
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

export function formatSerialLabel(serial, prefix = 'MGN') {
  if (serial === null || serial === undefined) return null;
  const year = new Date().getFullYear();
  return `${prefix}-${year}-${String(serial).padStart(6, '0')}`;
}
