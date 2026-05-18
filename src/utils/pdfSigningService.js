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
  } catch (_) { /* not PNG — trying JPG */ }
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

  // ---- 2. Caixa de assinatura (esquerda, paisagem ~36%×65%, centrada em Y) ----
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

  // ---- 3. Coluna direita ----
  const rightColX = sigBoxX + sigBoxW + 8;
  const rightEdge = x + w - pad - 2;
  const topY = y + h - pad - 4;
  const colCenter = (rightColX + rightEdge) / 2;

  // Cabeçalho centrado: badge verde com check + "VALIDAÇÃO DIGITAL"
  const headerText = 'VALIDAÇÃO DIGITAL';
  const headerTextSize = 7;
  const iconRadius = 4.5;
  const iconToTextOffset = 8; // distância do centro do ícone ao início do texto
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

  // ---- 6. Rodapé verde (centrado na coluna direita) ----
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

/**
 * Aplica o carimbo de aprovação do responsável da Magnetic Place ao PDF.
 * Aplicado em fluxo de 2 passos (após assinatura do trabalhador, admin aprova).
 *
 * @param {Blob|Uint8Array|ArrayBuffer} pdfInput
 * @param {Object} options
 * @param {string} options.companyName - Ex: "Magnetic Place"
 * @param {string} options.responsibleName
 * @param {string} options.responsibleRole - Ex: "Diretor", "Gestor de RH"
 * @param {string} options.signatureDataUrl - PNG/JPEG data URL da assinatura institucional
 * @param {string} options.signedAt - ISO date da aprovação
 * @param {number} options.xMm - Canto inferior-esquerdo X em mm
 * @param {number} options.yMm
 * @param {string} options.page - 'first' | 'last' | 'all'
 * @param {number} options.stampWidthMm - default 70
 * @param {number} options.stampHeightMm - default 25
 */
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
  // Defaults dependem do estilo
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

    // Embed recursos opcionais
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
  // Layout: [logo(transparente)+assinatura sobrepostos | dados texto] + footer
  const SLATE_100 = rgb(0.945, 0.953, 0.965);
  const SLATE_700 = rgb(0.200, 0.251, 0.333); // #334155
  const SLATE_500 = rgb(0.392, 0.455, 0.545); // #64748b
  const SLATE_900 = rgb(0.059, 0.090, 0.165); // #0f172a
  const INDIGO    = rgb(0.310, 0.275, 0.898); // #4f46e5
  const EMERALD   = rgb(0.063, 0.725, 0.506); // #10b981
  const WHITE     = rgb(1, 1, 1);
  const SLATE_50  = rgb(0.973, 0.980, 0.988);

  const FOOTER_H   = h * 0.15;
  const BODY_H     = h - FOOTER_H;
  const PAD_H      = w * 0.037;
  const GAP        = w * 0.037;
  const OVERLAY_W  = w * 0.395; // ~150/380

  // ── Fundo branco ─────────────────────────────────────────────────────────
  page.drawRectangle({ x, y, width: w, height: h, color: WHITE });

  // ── Footer ────────────────────────────────────────────────────────────────
  page.drawRectangle({ x, y, width: w, height: FOOTER_H, color: SLATE_50 });
  page.drawLine({ start: { x, y: y + FOOTER_H }, end: { x: x + w, y: y + FOOTER_H }, thickness: 0.4, color: SLATE_100 });
  page.drawCircle({ x: x + PAD_H + 2, y: y + FOOTER_H / 2, size: 1.5, color: EMERALD });
  page.drawText('DOCUMENTO AUTENTICADO ELETRONICAMENTE', {
    x: x + PAD_H + 6, y: y + FOOTER_H * 0.25, size: 3, font: helvBold, color: EMERALD,
  });

  // ── Corpo ─────────────────────────────────────────────────────────────────
  const bodyY = y + FOOTER_H;
  const overlayX = x + PAD_H;
  const overlayH = BODY_H - 6;
  const overlayY = bodyY + (BODY_H - overlayH) / 2;

  // Logo com opacidade baixa (fundo)
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

  // Assinatura por cima da logo
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

  // Dados do signatário (direita)
  const detailX = overlayX + OVERLAY_W + GAP;
  let dY = bodyY + BODY_H - 3;

  // Nome
  page.drawText(String(responsibleName || 'Responsável Legal'), {
    x: detailX, y: dY - 8, size: 8, font: helvBold, color: SLATE_900,
  });
  dY -= 10;

  // Cargo
  if (responsibleRole) {
    page.drawText(String(responsibleRole), {
      x: detailX, y: dY - 5, size: 6, font: helvBold, color: SLATE_700,
    });
    dY -= 7;
  }

  // Divisor
  dY -= 6;
  page.drawLine({ start: { x: detailX, y: dY }, end: { x: x + w - PAD_H, y: dY }, thickness: 0.3, color: SLATE_100 });
  dY -= 6;

  // Data
  if (signedAt) {
    const d = new Date(signedAt);
    const p = (n) => String(n).padStart(2, '0');
    const dateStr = `${p(d.getDate())}/${p(d.getMonth()+1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
    page.drawText(dateStr, { x: detailX, y: dY, size: 6, font: helvBold, color: SLATE_700 });
    dY -= 8;
  }

  // IP
  page.drawText(`IP ${String(ip || 'N/D')}`, { x: detailX, y: dY, size: 5.5, font: courier, color: SLATE_500 });
  dY -= 8;

  // ID
  if (id) {
    page.drawText(`ID: ${String(id)}`, { x: detailX, y: dY, size: 5, font: helvBold, color: INDIGO });
  }
}

function drawAdminStampMirror(page, {
  x, y, w, h,
  responsibleName, responsibleRole, signedAt, ip,
  signatureImage, logoImage,
  helv, helvBold,
}) {
  // Espelho do ValidationStamp do trabalhador — fundo branco, mesmas dimensões/layout
  const BLUE       = rgb(0.145, 0.306, 0.922);  // #2563eb
  const INDIGO_BDR = rgb(0.878, 0.898, 1.0);    // #e0e7ff
  const SLATE_900  = rgb(0.059, 0.090, 0.165);  // #0f172a
  const SLATE_600  = rgb(0.278, 0.337, 0.412);  // #475569
  const WHITE      = rgb(1, 1, 1);

  const PAD    = 5;
  const R      = 8;
  const SIG_W  = w * 0.37;  // ~37% para a caixa de assinatura (igual ao worker)

  // Fundo branco com borda indigo arredondada
  drawRoundedRect(page, { x, y, w, h, r: R, color: WHITE, borderColor: INDIGO_BDR, borderWidth: 1.2 });

  // ── Caixa de assinatura (sem contorno) ──────────────────────────────────
  const sigAreaX = x + PAD;
  const sigAreaY = y + PAD;
  const sigAreaW = SIG_W - PAD;
  const sigAreaH = h - PAD * 2;

  // Logo como marca de água (opacity ~0.08)
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

  // Assinatura desenhada por cima da marca de água
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

  // ── Área de dados (lado direito) ────────────────────────────────────────
  const dataX = x + SIG_W + PAD;
  const dataW = w - SIG_W - PAD * 2;
  let curY = y + h - PAD - 4;

  // Badge azul + título (igual ao worker mas azul)
  page.drawCircle({ x: dataX + 4, y: curY - 1.5, size: 4.5, color: BLUE });
  // checkmark simplificado via linha
  page.drawLine({ start: { x: dataX + 1.8, y: curY - 2.5 }, end: { x: dataX + 3.5, y: curY - 0.5 }, thickness: 1, color: WHITE });
  page.drawLine({ start: { x: dataX + 3.5, y: curY - 0.5 }, end: { x: dataX + 6.5, y: curY - 4 }, thickness: 1, color: WHITE });

  page.drawText('APROVACAO EMPRESARIAL', {
    x: dataX + 11, y: curY - 3.5, size: 5.8, font: helvBold, color: BLUE,
  });
  curY -= 11;

  // Campos
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

  // Rodapé azul (igual ao worker mas azul)
  const footerY = y + PAD;
  page.drawLine({ start: { x: dataX, y: footerY + 4 }, end: { x: dataX + dataW, y: footerY + 4 }, thickness: 0.4, color: INDIGO_BDR });
  page.drawText('DOCUMENTO APROVADO PELO REPRESENTANTE', {
    x: dataX, y: footerY, size: 4, font: helvBold, color: BLUE,
  });
}

function drawAdminStampClassic(page, {
  x, y, w, h,
  responsibleName, responsibleRole, signedAt,
  signatureImage, logoImage,
  helv, helvBold, courier,
}) {
  const INK_BLUE = rgb(0.059, 0.247, 0.529);  // #0f3f87
  const SLATE_200 = rgb(0.886, 0.910, 0.941); // #e2e8f0
  const SLATE_500 = rgb(0.392, 0.455, 0.545);
  const SLATE_600 = rgb(0.278, 0.337, 0.412);
  const SLATE_900 = rgb(0.059, 0.090, 0.165);
  const SLATE_50 = rgb(0.973, 0.980, 0.988);
  const WHITE = rgb(1, 1, 1);

  // Fundo branco + borda
  page.drawRectangle({ x, y, width: w, height: h, color: WHITE, borderColor: SLATE_200, borderWidth: 0.5 });
  // Barra superior azul tinta
  const TOP_BAR_H = 2;
  page.drawRectangle({ x, y: y + h - TOP_BAR_H, width: w, height: TOP_BAR_H, color: INK_BLUE });

  const PAD = 6;
  const headerY = y + h - TOP_BAR_H - 8;

  // Logo à esquerda
  if (logoImage) {
    const logoH = 10;
    const logoW = (logoImage.width / logoImage.height) * logoH;
    page.drawImage(logoImage, { x: x + PAD, y: headerY - 3, width: logoW, height: logoH });
  }

  // Label "ASSINATURA QUALIFICADA" à direita do header
  const labelText = 'ASSINATURA QUALIFICADA';
  const labelW = helvBold.widthOfTextAtSize(labelText, 4.5);
  page.drawText(labelText, {
    x: x + w - PAD - labelW, y: headerY + 1, size: 4.5, font: helvBold, color: SLATE_500,
  });

  // Linha divisória horizontal abaixo do header
  const divY = headerY - 6;
  page.drawLine({
    start: { x: x + PAD, y: divY },
    end: { x: x + w - PAD, y: divY },
    thickness: 0.3, color: SLATE_200,
  });

  // Marca d'água — logo grande e esmaecida no centro
  if (logoImage) {
    const wmH = h * 0.7;
    const wmW = (logoImage.width / logoImage.height) * wmH;
    page.drawImage(logoImage, {
      x: x + (w - wmW) / 2,
      y: y + (h - wmH) / 2,
      width: wmW,
      height: wmH,
      opacity: 0.06,
    });
  }

  // Assinatura desenhada (centro grande)
  if (signatureImage) {
    const sigAreaH = divY - (y + 14);
    const sigAreaW = w - PAD * 2;
    const aspect = signatureImage.width / signatureImage.height;
    let drawW, drawH;
    if (aspect > sigAreaW / sigAreaH) {
      drawW = sigAreaW;
      drawH = drawW / aspect;
    } else {
      drawH = sigAreaH;
      drawW = drawH * aspect;
    }
    page.drawImage(signatureImage, {
      x: x + (w - drawW) / 2,
      y: y + 14 + (sigAreaH - drawH) / 2,
      width: drawW,
      height: drawH,
    });
  }

  // Faixa inferior cinza com nome + data
  const footerH = 11;
  page.drawRectangle({ x, y, width: w, height: footerH, color: SLATE_50 });

  // Nome
  page.drawText(String(responsibleName || 'Responsável Legal'), {
    x: x + PAD, y: y + 5, size: 7, font: helvBold, color: SLATE_900,
  });
  // Cargo (italic emulado com Helvetica regular)
  if (responsibleRole) {
    const roleStr = String(responsibleRole);
    const nameW = helvBold.widthOfTextAtSize(String(responsibleName || ''), 7);
    page.drawText(`— ${roleStr}`, {
      x: x + PAD + nameW + 4, y: y + 5, size: 5, font: helv, color: SLATE_600,
    });
  }

  // Data à direita em mono
  let dateStr = '';
  if (signedAt) {
    const d = new Date(signedAt);
    const pad = (n) => String(n).padStart(2, '0');
    dateStr = `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  const dateW = courier.widthOfTextAtSize(dateStr, 5.5);
  page.drawText(dateStr, {
    x: x + w - PAD - dateW, y: y + 5, size: 5.5, font: courier, color: SLATE_600,
  });
}

function drawAdminStampCorporate(page, {
  x, y, w, h,
  companyName, responsibleName, responsibleRole, signedAt,
  signatureImage, logoImage,
  helv, helvBold, courier,
}) {
  // Palette
  const NAVY = rgb(0.043, 0.114, 0.227);     // #0b1d3a
  const NAVY_SOFT = rgb(0.078, 0.165, 0.322); // #142a52
  const GOLD = rgb(0.788, 0.635, 0.294);      // #c9a24b
  const GOLD_DEEP = rgb(0.627, 0.494, 0.173); // #a07e2c
  const PAPER = rgb(0.980, 0.980, 0.969);     // #fafaf7
  const SLATE = rgb(0.278, 0.337, 0.412);
  const SLATE_SOFT = rgb(0.580, 0.639, 0.722);
  const INK = rgb(0.059, 0.090, 0.165);
  const WHITE = rgb(1, 1, 1);

  // Fundo paper + borda marinho
  page.drawRectangle({ x, y, width: w, height: h, color: PAPER, borderColor: NAVY_SOFT, borderWidth: 0.5 });

  // Cabeçalho marinho (top band)
  const HEADER_H = 12;
  const headerY = y + h - HEADER_H;
  page.drawRectangle({ x, y: headerY, width: w, height: HEADER_H, color: NAVY });

  // Linha dourada de separação
  page.drawRectangle({ x, y: headerY - 0.8, width: w, height: 0.8, color: GOLD });

  const PAD = 5;

  // Logo (caixa branca à esquerda do header)
  const logoBoxH = HEADER_H - 3;
  const logoBoxW = logoBoxH;
  if (logoImage) {
    page.drawRectangle({ x: x + PAD, y: headerY + 1.5, width: logoBoxW, height: logoBoxH, color: WHITE });
    const inset = 1;
    const innerW = logoBoxW - inset * 2;
    const innerH = logoBoxH - inset * 2;
    const aspect = logoImage.width / logoImage.height;
    let lw = innerW, lh = innerH;
    if (aspect > innerW / innerH) lh = lw / aspect;
    else lw = lh * aspect;
    page.drawImage(logoImage, {
      x: x + PAD + inset + (innerW - lw) / 2,
      y: headerY + 1.5 + inset + (innerH - lh) / 2,
      width: lw,
      height: lh,
    });
  }

  // Nome da empresa
  const titleX = x + PAD + logoBoxW + 4;
  const titleStr = String(companyName || 'MAGNETIC PLACE').toUpperCase();
  page.drawText(titleStr, {
    x: titleX, y: headerY + 6, size: 8, font: helvBold, color: WHITE,
  });
  page.drawText('GLOBAL WORKFORCE SOLUTIONS', {
    x: titleX, y: headerY + 1.5, size: 3.5, font: helvBold, color: GOLD,
  });

  // Selo circular CERTIFIED (canto direito do header)
  const sealR = (HEADER_H - 2) / 2;
  const sealCx = x + w - PAD - sealR;
  const sealCy = headerY + HEADER_H / 2;
  page.drawCircle({ x: sealCx, y: sealCy, size: sealR, borderColor: GOLD, borderWidth: 0.5 });
  const certStr = 'CERTIFIED';
  const certW = helvBold.widthOfTextAtSize(certStr, 2.5);
  page.drawText(certStr, {
    x: sealCx - certW / 2, y: sealCy + 0.5, size: 2.5, font: helvBold, color: GOLD,
  });
  const origStr = 'ORIGINAL';
  const origW = helvBold.widthOfTextAtSize(origStr, 2.2);
  page.drawText(origStr, {
    x: sealCx - origW / 2, y: sealCy - 2.5, size: 2.2, font: helvBold, color: GOLD,
  });

  // Watermark logo grande no corpo
  if (logoImage) {
    const bodyH = h - HEADER_H - 11; // 11 = footer
    const wmH = bodyH * 0.95;
    const wmW = (logoImage.width / logoImage.height) * wmH;
    page.drawImage(logoImage, {
      x: x + w - wmW - 2,
      y: y + 11 + (bodyH - wmH) / 2,
      width: wmW,
      height: wmH,
      opacity: 0.05,
    });
  }

  // Brasão monogram (círculo) à esquerda do corpo
  const bodyMidY = y + 11 + (h - HEADER_H - 11) / 2;
  if (logoImage) {
    const mr = 6;
    page.drawCircle({ x: x + PAD + mr, y: bodyMidY, size: mr, color: WHITE, borderColor: NAVY_SOFT, borderWidth: 0.4 });
    const mInner = mr * 1.3;
    const aspect = logoImage.width / logoImage.height;
    let mw = mInner, mh = mInner;
    if (aspect > 1) mh = mw / aspect;
    else mw = mh * aspect;
    page.drawImage(logoImage, {
      x: x + PAD + mr - mw / 2,
      y: bodyMidY - mh / 2,
      width: mw,
      height: mh,
      opacity: 0.85,
    });
  }

  // Caixa rectangular 2:1 para a assinatura
  const availX = x + PAD + 16;
  const availY = y + 12;
  const availW = w - PAD * 2 - 18;
  const availH = h - HEADER_H - 14;
  // Box com proporção 2:1 (largura : altura) que cabe na zona disponível
  let boxW = availW;
  let boxH = boxW / 2;
  if (boxH > availH) {
    boxH = availH;
    boxW = boxH * 2;
  }
  const boxX = availX + (availW - boxW) / 2;
  const boxY = availY + (availH - boxH) / 2;
  page.drawRectangle({
    x: boxX, y: boxY, width: boxW, height: boxH,
    color: WHITE, borderColor: NAVY_SOFT, borderWidth: 0.3,
  });

  // Assinatura dentro da caixa, mantendo aspect
  if (signatureImage) {
    const innerPad = 1.5;
    const innerW = boxW - innerPad * 2;
    const innerH = boxH - innerPad * 2;
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
      x: boxX + (boxW - drawW) / 2,
      y: boxY + (boxH - drawH) / 2,
      width: drawW,
      height: drawH,
    });
  }

  // Rodapé (linha + texto)
  const footerH = 10;
  page.drawLine({
    start: { x: x + PAD, y: y + footerH + 0.5 },
    end: { x: x + w - PAD, y: y + footerH + 0.5 },
    thickness: 0.3, color: NAVY_SOFT,
  });

  // Nome (serif emulado com bold)
  const nameStr = String(responsibleName || 'Responsável Legal');
  page.drawText(nameStr, {
    x: x + PAD, y: y + 5, size: 6.5, font: helvBold, color: INK,
  });
  if (responsibleRole) {
    const nameW = helvBold.widthOfTextAtSize(nameStr, 6.5);
    page.drawText(`· ${String(responsibleRole).toUpperCase()}`, {
      x: x + PAD + nameW + 3, y: y + 5, size: 4, font: helvBold, color: SLATE,
    });
  }
  page.drawText('Lisboa · Porto · Madrid', {
    x: x + PAD, y: y + 1.5, size: 3.2, font: helv, color: SLATE_SOFT,
  });

  // Direita: AUTHENTICATED + data + serial
  const authStr = 'AUTHENTICATED';
  const authW = helvBold.widthOfTextAtSize(authStr, 3.2);
  page.drawText(authStr, {
    x: x + w - PAD - authW, y: y + 7, size: 3.2, font: helvBold, color: GOLD_DEEP,
  });
  let dateStr = '';
  if (signedAt) {
    const d = new Date(signedAt);
    const pad = (n) => String(n).padStart(2, '0');
    dateStr = `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  const dateW = courier.widthOfTextAtSize(dateStr, 4.5);
  page.drawText(dateStr, {
    x: x + w - PAD - dateW, y: y + 3, size: 4.5, font: courier, color: SLATE,
  });
  const serial = (signedAt || '').replace(/[^0-9]/g, '').slice(0, 14);
  const serialStr = `SN · ${serial}`;
  const serialW = courier.widthOfTextAtSize(serialStr, 3);
  page.drawText(serialStr, {
    x: x + w - PAD - serialW, y: y + 0.5, size: 3, font: courier, color: SLATE_SOFT,
  });
}

export function formatSerialLabel(serial, prefix = 'MGN') {
  if (serial === null || serial === undefined) return null;
  const year = new Date().getFullYear();
  return `${prefix}-${year}-${String(serial).padStart(6, '0')}`;
}
