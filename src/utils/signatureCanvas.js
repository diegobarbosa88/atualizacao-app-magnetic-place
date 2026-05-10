export function cropSignatureCanvas(canvas, opts = {}) {
  if (!canvas) return null;
  const { padding = 8, targetWidth, targetHeight } = typeof opts === 'number' ? { padding: opts } : opts;
  const { width, height } = canvas;
  if (!width || !height) return canvas.toDataURL('image/png');

  const ctx = canvas.getContext('2d');
  const { data } = ctx.getImageData(0, 0, width, height);

  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] > 10) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX < 0) return canvas.toDataURL('image/png');

  minX = Math.max(0, minX - padding);
  minY = Math.max(0, minY - padding);
  maxX = Math.min(width - 1, maxX + padding);
  maxY = Math.min(height - 1, maxY + padding);

  const cropW = maxX - minX + 1;
  const cropH = maxY - minY + 1;

  const out = document.createElement('canvas');

  if (targetWidth && targetHeight) {
    out.width = targetWidth;
    out.height = targetHeight;
    const scale = Math.min(targetWidth / cropW, targetHeight / cropH);
    const drawW = cropW * scale;
    const drawH = cropH * scale;
    const offsetX = (targetWidth - drawW) / 2;
    const offsetY = (targetHeight - drawH) / 2;
    out.getContext('2d').drawImage(canvas, minX, minY, cropW, cropH, offsetX, offsetY, drawW, drawH);
  } else {
    out.width = cropW;
    out.height = cropH;
    out.getContext('2d').drawImage(canvas, minX, minY, cropW, cropH, 0, 0, cropW, cropH);
  }

  return out.toDataURL('image/png');
}
