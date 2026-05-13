// Gera uma imagem PNG (Uint8Array) com o "carimbo digital" para injetar no .docx
// via docxtemplater-image-module-free no sítio do placeholder {signature_stamp}.

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

export async function generateStampImageBytes({
  workerName,
  signedAt,
  signedIp,
  serialLabel,
  qrDataUrl,
} = {}) {
  const W = 400;
  const H = 200;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);

  ctx.strokeStyle = '#4f46e5';
  ctx.lineWidth = 3;
  ctx.strokeRect(2, 2, W - 4, H - 4);

  ctx.fillStyle = '#4f46e5';
  ctx.fillRect(2, 2, W - 4, 34);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 16px Helvetica, Arial, sans-serif';
  ctx.textBaseline = 'middle';
  ctx.fillText('✓ ASSINADO DIGITALMENTE', 12, 19);

  const hasQr = !!qrDataUrl;
  const metaRight = hasQr ? W - 90 : W - 16;

  let y = 56;
  const row = (label, value) => {
    ctx.fillStyle = '#64748b';
    ctx.font = 'bold 9px Helvetica, Arial, sans-serif';
    ctx.fillText(label, 12, y);
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 12px Helvetica, Arial, sans-serif';
    const truncated = truncateToWidth(ctx, String(value ?? '—'), metaRight - 12);
    ctx.fillText(truncated, 12, y + 14);
    y += 30;
  };

  row('TRABALHADOR', workerName || 'Trabalhador');
  row('DATA / HORA', signedAt ? new Date(signedAt).toLocaleString('pt-PT') : '—');
  row('Nº SÉRIE', serialLabel || '—');

  if (hasQr) {
    try {
      const qrImg = await loadImage(qrDataUrl);
      ctx.drawImage(qrImg, W - 78, 50, 68, 68);
      ctx.fillStyle = '#94a3b8';
      ctx.font = 'bold 7px Helvetica, Arial, sans-serif';
      ctx.fillText('VERIFICAR', W - 70, 128);
    } catch (err) {
      console.warn('[stampImageService] Falha a desenhar QR:', err);
    }
  }

  ctx.fillStyle = '#94a3b8';
  ctx.font = '9px Helvetica, Arial, sans-serif';
  ctx.fillText(`IP ${signedIp || 'desconhecido'} · MAGNETIC PLACE`, 12, H - 12);

  const dataUrl = canvas.toDataURL('image/png');
  return dataUrlToBytes(dataUrl);
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
