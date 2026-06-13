import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import {
  INDIGO, INDIGO_BG_SOFT, INDIGO_BORDER_SOFT,
  SLATE_900, SLATE_600, SLATE_400, SLATE_300, EMERALD,
  MM_TO_PT, drawRoundedRect, blobOrDataUrlToBytes, tryEmbedImage,
} from './pdfHelpers';

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
  drawRoundedRect(page, {
    x, y, w, h, r: 6,
    color: INDIGO_BG_SOFT,
    borderColor: INDIGO_BORDER_SOFT,
    borderWidth: 0.8,
  });

  const pad = 5;

  const sigBoxW = w * 0.36;
  const sigBoxH = h * 0.65;
  const sigBoxX = x + pad;
  const sigBoxY = y + (h - sigBoxH) / 2;

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

  const rightColX = sigBoxX + sigBoxW + 8;
  const rightEdge = x + w - pad - 2;
  const topY = y + h - pad - 4;
  const colCenter = (rightColX + rightEdge) / 2;

  const headerText = 'VALIDAÇÃO DIGITAL';
  const headerTextSize = 7;
  const iconRadius = 4.5;
  const iconToTextOffset = 8;
  const headerTextW = helvBold.widthOfTextAtSize(headerText, headerTextSize);
  const headerGroupW = iconRadius + iconToTextOffset + headerTextW;
  const headerGroupStartX = colCenter - headerGroupW / 2;
  const cx = headerGroupStartX + iconRadius;
  const cy = topY - 2.5;

  page.drawCircle({ x: cx, y: cy, size: iconRadius, color: EMERALD });
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

  page.drawText(headerText, {
    x: cx + iconToTextOffset,
    y: topY - 4,
    size: headerTextSize,
    font: helvBold,
    color: INDIGO,
  });

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
    page.drawText(f.label, {
      x: rightColX, y: currentY,
      size: labelSize, font: helv, color: SLATE_600,
    });

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

  const lineY = y + 13;
  page.drawLine({
    start: { x: rightColX, y: lineY },
    end: { x: rightEdge, y: lineY },
    thickness: 0.5,
    color: SLATE_300,
    dashArray: [2, 2],
  });

  const footerText = 'DOCUMENTO VALIDADO ELETRONICAMENTE';
  const footerSize = 4.5;
  const footerW = helvBold.widthOfTextAtSize(footerText, footerSize);
  page.drawText(footerText, {
    x: colCenter - footerW / 2,
    y: lineY - 6.5,
    size: footerSize,
    font: helvBold,
    color: EMERALD,
  });
}
