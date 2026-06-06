export const DEFAULT_GMAIL_CONFIG = {
  lidos: true,
  naoLidos: true,
  temAnexo: true,
  assuntos: ['fatura', 'invoice', 'FT'],
  remetente: '',
  palavras: '',
};

export function configParaQuery(cfg) {
  const parts = [];
  if (cfg.naoLidos && !cfg.lidos) parts.push('is:unread');
  if (cfg.lidos && !cfg.naoLidos) parts.push('is:read');
  if (cfg.temAnexo) parts.push('has:attachment');
  if (cfg.assuntos.length) {
    const s = cfg.assuntos.map(a => `subject:${a}`).join(' ');
    parts.push(cfg.assuntos.length > 1 ? `{${s}}` : s);
  }
  if (cfg.remetente.trim()) parts.push(`from:${cfg.remetente.trim()}`);
  if (cfg.palavras.trim()) parts.push(cfg.palavras.trim());
  return parts.join(' ') || 'has:attachment';
}
