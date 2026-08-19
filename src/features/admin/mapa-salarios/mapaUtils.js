// Constantes de design e helpers partilhados por todos os layouts do Mapa de Salários

export const NAVY      = '#1B3A57';
export const ORANGE    = '#EB8D00';
export const SLATE_A   = '#869AAF';
export const BORDER    = '#E3E7EC';
export const VAL_NAVY  = '#1B3A57';   // valores principais
export const VAL_NEUT  = '#647587';   // SS / IRS — neutro, não alerta
export const SURFACE2  = '#EEF1F5';
export const MONO      = "'Roboto Mono', 'Courier New', monospace";

/**
 * Formata número como "1 234,56" (sem símbolo €).
 * `null` explícito → "—" (nenhum dado disponível, nem log nem recibo — ver
 * useMapaSalarios.js, fallback para receipt_validations); `undefined` (todas
 * as linhas com dados) continua a cair em 0, comportamento inalterado.
 */
export const n2 = (v) =>
  v === null ? '—' : (v ?? 0).toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
