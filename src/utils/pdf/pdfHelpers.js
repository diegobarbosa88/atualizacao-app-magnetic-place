import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

export const INDIGO = rgb(0.31, 0.275, 0.898);
export const INDIGO_BG_SOFT = rgb(0.973, 0.98, 1.0);
export const INDIGO_BORDER_SOFT = rgb(0.886, 0.91, 0.96);
export const SLATE_900 = rgb(0.059, 0.09, 0.165);
export const SLATE_600 = rgb(0.39, 0.455, 0.545);
export const SLATE_400 = rgb(0.58, 0.639, 0.722);
export const SLATE_300 = rgb(0.796, 0.835, 0.882);
export const SLATE_100 = rgb(0.945, 0.965, 0.976);
export const EMERALD = rgb(0.063, 0.725, 0.506);

// 1 mm = 2.83465 pontos PDF
export const MM_TO_PT = 2.83465;

export function roundedRectPath(w, h, r) {
  return `M ${r},0 L ${w - r},0 Q ${w},0 ${w},${r} L ${w},${h - r} Q ${w},${h} ${w - r},${h} L ${r},${h} Q 0,${h} 0,${h - r} L 0,${r} Q 0,0 ${r},0 Z`;
}

export function drawRoundedRect(page, { x, y, w, h, r, color, borderColor, borderWidth = 0 }) {
  page.drawSvgPath(roundedRectPath(w, h, r), {
    x,
    y: y + h,
    color,
    borderColor,
    borderWidth,
  });
}

export async function blobOrDataUrlToBytes(input) {
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

export async function tryEmbedImage(pdfDoc, bytes) {
  if (!bytes) return null;
  try {
    return await pdfDoc.embedPng(bytes);
  } catch (_) { /* not PNG — trying JPG */ }
  try {
    return await pdfDoc.embedJpg(bytes);
  } catch {
    console.warn('[pdfSigningService] Imagem não suportada (não é PNG nem JPG).');
    return null;
  }
}

export function sanitizePdfText(str) {
  return String(str || 'N/D').replace(/[^\x20-\x7E\s]/g, '').substring(0, 100);
}

export function formatSerialLabel(serial, prefix = 'MGN') {
  if (serial === null || serial === undefined) return null;
  const year = new Date().getFullYear();
  return `${prefix}-${year}-${String(serial).padStart(6, '0')}`;
}
