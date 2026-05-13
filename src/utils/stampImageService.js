// Gera uma imagem PNG (Uint8Array) com o "carimbo digital" para injetar no .docx
// via docxtemplater-image-module-free no sítio do placeholder {%signature_stamp}.

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function dataUrlToBytes(dataUrl) {
  const bin = atob(dataUrl.split(',')[1]);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function truncateToWidth(ctx, text, maxWidth) {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let lo = 0;
  let hi = text.length;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    const sub = text.slice(0, mid) + '…';
    if (ctx.measureText(sub).width <= maxWidth) lo = mid;
    else hi = mid - 1;
  }
  return text.slice(0, lo) + '…';
}

export async function generateStampImageBytes({
  workerName,
  signedAt,
  signedIp,
  serialLabel,
  qrDataUrl,
  signatureDataUrl,
} = {}) {
  const W = 500;
  const H = 280;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  // Fundo branco
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);

  // Borda indigo grossa
  ctx.strokeStyle = '#4f46e5';
  ctx.lineWidth = 3;
  ctx.strokeRect(2, 2, W - 4, H - 4);

  // Faixa indigo de header (36px de altura)
  ctx.fillStyle = '#4f46e5';
  ctx.fillRect(2, 2, W - 4, 34);

  // Título
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 16px Helvetica, Arial, sans-serif';
  ctx.textBaseline = 'middle';
  ctx.fillText('✓ ASSINADO DIGITALMENTE', 14, 19);

  // Trabalhador (logo abaixo do header)
  ctx.fillStyle = '#64748b';
  ctx.font = 'bold 9px Helvetica, Arial, sans-serif';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('TRABALHADOR', 14, 56);
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 13px Helvetica, Arial, sans-serif';
  ctx.fillText(
    truncateToWidth(ctx, workerName || 'Trabalhador', W - 28),
    14, 72
  );

  // Zona da assinatura desenhada (centro, dominante)
  const sigBoxX = 14;
  const sigBoxY = 86;
  const sigBoxW = W - 28;
  const sigBoxH = 110;
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(sigBoxX, sigBoxY, sigBoxW, sigBoxH);
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 1;
  ctx.strokeRect(sigBoxX, sigBoxY, sigBoxW, sigBoxH);

  if (signatureDataUrl) {
    try {
      const sigImg = await loadImage(signatureDataUrl);
      const maxW = sigBoxW - 16;
      const maxH = sigBoxH - 16;
      const ratio = Math.min(maxW / sigImg.width, maxH / sigImg.height, 1);
      const drawW = sigImg.width * ratio;
      const drawH = sigImg.height * ratio;
      const cx = sigBoxX + (sigBoxW - drawW) / 2;
      const cy = sigBoxY + (sigBoxH - drawH) / 2;
      ctx.drawImage(sigImg, cx, cy, drawW, drawH);
    } catch (err) {
      console.warn('[stampImageService] Falha a desenhar assinatura:', err);
    }
  } else {
    // Sem assinatura — placeholder discreto
    ctx.fillStyle = '#94a3b8';
    ctx.font = 'italic 11px Helvetica, Arial, sans-serif';
    ctx.textBaseline = 'middle';
    ctx.fillText('(sem assinatura manuscrita)', sigBoxX + sigBoxW / 2 - 80, sigBoxY + sigBoxH / 2);
    ctx.textBaseline = 'alphabetic';
  }

  // Linha "Assinatura" abaixo da caixa
  ctx.fillStyle = '#94a3b8';
  ctx.font = 'bold 8px Helvetica, Arial, sans-serif';
  ctx.fillText('ASSINATURA DO TRABALHADOR', 14, sigBoxY + sigBoxH + 12);

  // Metadata em baixo (data + serial)
  let metaY = sigBoxY + sigBoxH + 28;
  const hasQr = !!qrDataUrl;
  const metaMaxX = hasQr ? W - 92 : W - 14;

  const metaRow = (label, value) => {
    ctx.fillStyle = '#64748b';
    ctx.font = 'bold 8px Helvetica, Arial, sans-serif';
    ctx.fillText(label, 14, metaY);
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 11px Helvetica, Arial, sans-serif';
    const truncated = truncateToWidth(ctx, String(value ?? '—'), metaMaxX - 14);
    ctx.fillText(truncated, 14, metaY + 12);
    metaY += 28;
  };

  metaRow('DATA / HORA', signedAt ? new Date(signedAt).toLocaleString('pt-PT') : '—');
  metaRow('Nº SÉRIE  ·  IP', `${serialLabel || '—'}  ·  ${signedIp || 'desconhecido'}`);

  // QR no canto direito (alinhado com a metadata)
  if (hasQr) {
    try {
      const qrImg = await loadImage(qrDataUrl);
      const qrSize = 76;
      const qrX = W - qrSize - 14;
      const qrY = sigBoxY + sigBoxH + 16;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(qrX - 2, qrY - 2, qrSize + 4, qrSize + 4);
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 1;
      ctx.strokeRect(qrX - 2, qrY - 2, qrSize + 4, qrSize + 4);
      ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);
      ctx.fillStyle = '#94a3b8';
      ctx.font = 'bold 7px Helvetica, Arial, sans-serif';
      ctx.fillText('VERIFICAR', qrX + 18, qrY + qrSize + 10);
    } catch (err) {
      console.warn('[stampImageService] Falha a desenhar QR:', err);
    }
  }

  const dataUrl = canvas.toDataURL('image/png');
  return dataUrlToBytes(dataUrl);
}
