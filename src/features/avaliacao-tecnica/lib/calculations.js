/**
 * Funções numéricas puras (sem React) — fáceis de testar e de reaproveitar no backend.
 */

export function round(value, decimals = 2) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/**
 * Converte o que o candidato digitou em milímetros.
 * Aceita vírgula ou ponto decimal e separador de milhar:
 * "287,5" · "287.5" · "3.110,18" · "3,110.18" · "3.110" · "384 mm"
 */
export function parseMillimeters(raw) {
  let s = raw.trim().replace(/\s+/g, '').replace(/mm$/i, '');
  if (!s) return null;

  const hasComma = s.includes(',');
  const hasDot = s.includes('.');

  if (hasComma && hasDot) {
    // o último separador é o decimal
    s = s.lastIndexOf(',') > s.lastIndexOf('.') ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  } else if (hasComma) {
    if ((s.match(/,/g) ?? []).length > 1) return null;
    s = s.replace(',', '.');
  } else if (hasDot) {
    if (/^\d{1,3}(\.\d{3})+$/.test(s))
      s = s.replace(/\./g, ''); // "3.110" = três mil cento e dez
    else if ((s.match(/\./g) ?? []).length > 1) return null;
  }

  if (!/^\d+(\.\d+)?$/.test(s)) return null;
  const value = Number(s);
  return Number.isFinite(value) ? value : null;
}

export function shuffle(items, random = Math.random) {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
