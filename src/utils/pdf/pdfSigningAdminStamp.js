import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { MM_TO_PT, drawRoundedRect, blobOrDataUrlToBytes, sanitizePdfText } from './pdfHelpers';
import { drawAdminStampClassic, drawAdminStampCorporate } from './pdfSigningAdminVariants';

export async function applyAdminStampToPage(pdfBlob, {
  companyName, responsibleName, responsibleRole, signedAt, signatureDataUrl,
  companyLogoBytes,
  ip = 'N/D',
  id,
  stampStyle = 'tech',
  xMm = 20, yMm = 30, page = 'last',
  stampWidthMm,
  stampHeightMm,
} = {}) {
  const isClassic = stampStyle === 'classic';
  const isCorporate = stampStyle === 'corporate';
  const isMirror = stampStyle === 'mirror';
  const finalW = stampWidthMm ?? (isClassic || isCorporate ? 95 : isMirror ? 100 : 70);
  const finalH = stampHeightMm ?? (isCorporate ? 38 : isClassic ? 30 : isMirror ? 30 : 25);

  try {
    const arrayBuffer = await (pdfBlob.arrayBuffer ? pdfBlob.arrayBuffer() : pdfBlob);
    const pdfDoc = await PDFDocument.load(arrayBuffer);

    const helv = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const helvBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const courier = await pdfDoc.embedFont(StandardFonts.Courier);

    let sigImage = null;
    let logoImage = null;
    if (companyLogoBytes) {
      try {
        logoImage = await pdfDoc.embedPng(companyLogoBytes);
      } catch (e) {
        console.warn('Falha ao embeber logo admin:', e);
      }
    }
    if (signatureDataUrl) {
      try {
        let finalDataUrl = signatureDataUrl;
        const inkColor = isCorporate ? '#0b1d3a' : isMirror ? '#0f172a' : '#0f3f87';
        if (typeof document !== 'undefined') {
          const img = new Image();
          await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
            img.src = signatureDataUrl;
          });
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0);
          ctx.globalCompositeOperation = 'source-in';
          ctx.fillStyle = inkColor;
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          finalDataUrl = canvas.toDataURL('image/png');
        }
        const base64Data = finalDataUrl.split(',')[1];
        if (base64Data) {
          const uint8Array = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
          sigImage = await pdfDoc.embedPng(uint8Array);
        }
      } catch (err) {
        console.warn('Falha ao embeber assinatura admin:', err);
      }
    }

    const x = xMm * MM_TO_PT;
    const y = yMm * MM_TO_PT;
    const w = finalW * MM_TO_PT;
    const h = finalH * MM_TO_PT;

    const pages = pdfDoc.getPages();
    let targetPages = [];
    if (page === 'first') targetPages = [pages[0]];
    else if (page === 'last') targetPages = [pages[pages.length - 1]];
    else if (page === 'all') targetPages = pages;
    if (targetPages.length === 0) targetPages = [pages[pages.length - 1]];

    for (const targetPage of targetPages) {
      if (isCorporate) {
        drawAdminStampCorporate(targetPage, {
          x, y, w, h,
          companyName, responsibleName, responsibleRole, signedAt,
          signatureImage: sigImage, logoImage,
          helv, helvBold, courier,
        });
      } else if (isClassic) {
        drawAdminStampClassic(targetPage, {
          x, y, w, h,
          responsibleName, responsibleRole, signedAt,
          signatureImage: sigImage, logoImage,
          helv, helvBold, courier,
        });
      } else if (isMirror) {
        drawAdminStampMirror(targetPage, {
          x, y, w, h,
          responsibleName, responsibleRole, signedAt, ip,
          signatureImage: sigImage, logoImage,
          helv, helvBold,
        });
      } else {
        drawAdminStamp(targetPage, {
          x, y, w, h,
          responsibleName, responsibleRole, signedAt, ip, id,
          signatureImage: sigImage, logoImage,
          helvBold, courier,
        });
      }
    }

    return await pdfDoc.save();
  } catch (err) {
    console.error('Erro ao aplicar carimbo administrativo:', err);
    throw err;
  }
}

function drawAdminStamp(page, {
  x, y, w, h,
  responsibleName, responsibleRole, signedAt, ip, id,
  signatureImage, logoImage,
  helvBold, courier,
}) {
  const SLATE_100 = rgb(0.945, 0.953, 0.965);
  const SLATE_700 = rgb(0.200, 0.251, 0.333);
  const SLATE_500 = rgb(0.392, 0.455, 0.545);
  const SLATE_900 = rgb(0.059, 0.090, 0.165);
  const INDIGO    = rgb(0.310, 0.275, 0.898);
  const EMERALD   = rgb(0.063, 0.725, 0.506);
  const WHITE     = rgb(1, 1, 1);
  const SLATE_50  = rgb(0.973, 0.980, 0.988);

  const FOOTER_H   = h * 0.15;
  const BODY_H     = h - FOOTER_H;
  const PAD_H      = w * 0.037;
  const GAP        = w * 0.037;
  const OVERLAY_W  = w * 0.395;

  page.drawRectangle({ x, y, width: w, height: h, color: WHITE });

  page.drawRectangle({ x, y, width: w, height: FOOTER_H, color: SLATE_50 });
  page.drawLine({ start: { x, y: y + FOOTER_H }, end: { x: x + w, y: y + FOOTER_H }, thickness: 0.4, color: SLATE_100 });
  page.drawCircle({ x: x + PAD_H + 2, y: y + FOOTER_H / 2, size: 1.5, color: EMERALD });
  page.drawText('DOCUMENTO AUTENTICADO ELETRONICAMENTE', {
    x: x + PAD_H + 6, y: y + FOOTER_H * 0.25, size: 3, font: helvBold, color: EMERALD,
  });

  const bodyY = y + FOOTER_H;
  const overlayX = x + PAD_H;
  const overlayH = BODY_H - 6;
  const overlayY = bodyY + (BODY_H - overlayH) / 2;

  if (logoImage) {
    const aspect = logoImage.width / logoImage.height;
    const lh = overlayH;
    const lw = Math.min(OVERLAY_W, lh * aspect);
    page.drawImage(logoImage, {
      x: overlayX + (OVERLAY_W - lw) / 2,
      y: overlayY,
      width: lw, height: lh,
      opacity: 0.18,
    });
  }

  if (signatureImage) {
    const aspect = signatureImage.width / signatureImage.height;
    const imgH = overlayH;
    const imgW = Math.min(OVERLAY_W, imgH * aspect);
    page.drawImage(signatureImage, {
      x: overlayX + (OVERLAY_W - imgW) / 2,
      y: overlayY,
      width: imgW, height: imgH,
      opacity: 0.88,
    });
  }

  const detailX = overlayX + OVERLAY_W + GAP;
  let dY = bodyY + BODY_H - 3;

  page.drawText(String(responsibleName || 'Responsável Legal'), {
    x: detailX, y: dY - 8, size: 8, font: helvBold, color: SLATE_900,
  });
  dY -= 10;

  if (responsibleRole) {
    page.drawText(String(responsibleRole), {
      x: detailX, y: dY - 5, size: 6, font: helvBold, color: SLATE_700,
    });
    dY -= 7;
  }

  dY -= 6;
  page.drawLine({ start: { x: detailX, y: dY }, end: { x: x + w - PAD_H, y: dY }, thickness: 0.3, color: SLATE_100 });
  dY -= 6;

  if (signedAt) {
    const d = new Date(signedAt);
    const p = (n) => String(n).padStart(2, '0');
    const dateStr = `${p(d.getDate())}/${p(d.getMonth()+1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
    page.drawText(dateStr, { x: detailX, y: dY, size: 6, font: helvBold, color: SLATE_700 });
    dY -= 8;
  }

  page.drawText(`IP ${sanitizePdfText(ip)}`, { x: detailX, y: dY, size: 5.5, font: courier, color: SLATE_500 });
  dY -= 8;

  if (id) {
    page.drawText(`ID: ${sanitizePdfText(id)}`, { x: detailX, y: dY, size: 5, font: helvBold, color: INDIGO });
  }
}

function drawAdminStampMirror(page, {
  x, y, w, h,
  responsibleName, responsibleRole, signedAt, ip,
  signatureImage, logoImage,
  helv, helvBold,
}) {
  const BLUE       = rgb(0.145, 0.306, 0.922);
  const INDIGO_BDR = rgb(0.878, 0.898, 1.0);
  const SLATE_900  = rgb(0.059, 0.090, 0.165);
  const SLATE_600  = rgb(0.278, 0.337, 0.412);
  const WHITE      = rgb(1, 1, 1);

  const PAD    = 5;
  const R      = 8;
  const SIG_W  = w * 0.37;

  drawRoundedRect(page, { x, y, w, h, r: R, color: WHITE, borderColor: INDIGO_BDR, borderWidth: 1.2 });

  const sigAreaX = x + PAD;
  const sigAreaY = y + PAD;
  const sigAreaW = SIG_W - PAD;
  const sigAreaH = h - PAD * 2;

  if (logoImage) {
    const logoAspect = logoImage.width / logoImage.height;
    const logoH = sigAreaH * 0.85;
    const logoW = logoH * logoAspect;
    page.drawImage(logoImage, {
      x: sigAreaX + (sigAreaW - logoW) / 2,
      y: sigAreaY + (sigAreaH - logoH) / 2,
      width: logoW,
      height: logoH,
      opacity: 0.08,
    });
  }

  if (signatureImage) {
    const aspect = signatureImage.width / signatureImage.height;
    const imgH = Math.min(sigAreaH - 4, (sigAreaW - 4) / aspect);
    const imgW = imgH * aspect;
    page.drawImage(signatureImage, {
      x: sigAreaX + (sigAreaW - imgW) / 2,
      y: sigAreaY + (sigAreaH - imgH) / 2,
      width: imgW,
      height: imgH,
    });
  }

  const dataX = x + SIG_W + PAD;
  const dataW = w - SIG_W - PAD * 2;
  let curY = y + h - PAD - 4;

  page.drawCircle({ x: dataX + 4, y: curY - 1.5, size: 4.5, color: BLUE });
  page.drawLine({ start: { x: dataX + 1.8, y: curY - 2.5 }, end: { x: dataX + 3.5, y: curY - 0.5 }, thickness: 1, color: WHITE });
  page.drawLine({ start: { x: dataX + 3.5, y: curY - 0.5 }, end: { x: dataX + 6.5, y: curY - 4 }, thickness: 1, color: WHITE });

  page.drawText('APROVACAO EMPRESARIAL', {
    x: dataX + 11, y: curY - 3.5, size: 5.8, font: helvBold, color: BLUE,
  });
  curY -= 11;

  const labelSize = 5;
  const valueSize = 5.5;
  const rowGap = 6;

  const drawRow = (label, value) => {
    page.drawText(label, { x: dataX, y: curY, size: labelSize, font: helv, color: SLATE_600 });
    const valW = helvBold.widthOfTextAtSize(String(value), valueSize);
    page.drawText(String(value), { x: dataX + dataW - valW, y: curY, size: valueSize, font: helvBold, color: SLATE_900 });
    curY -= rowGap;
  };

  drawRow('Nome:', responsibleName || '—');
  if (responsibleRole) drawRow('Cargo:', responsibleRole);

  let dateStr = '—';
  if (signedAt) {
    const d = new Date(signedAt);
    const pad = (n) => String(n).padStart(2, '0');
    dateStr = `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}, ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  drawRow('Data/Hora:', dateStr);
  drawRow('IP:', ip || 'N/D');

  const footerY = y + PAD;
  page.drawLine({ start: { x: dataX, y: footerY + 4 }, end: { x: dataX + dataW, y: footerY + 4 }, thickness: 0.4, color: INDIGO_BDR });
  page.drawText('DOCUMENTO APROVADO PELO REPRESENTANTE', {
    x: dataX, y: footerY, size: 4, font: helvBold, color: BLUE,
  });
}
