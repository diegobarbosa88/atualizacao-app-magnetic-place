export const STATUS_LABEL = {
  submitted:    { label: 'Submetido',  cls: 'bg-[var(--tone-amber-bg)] text-[var(--tone-amber)]' },
  under_review: { label: 'Em Revisão', cls: 'bg-[var(--tone-indigo-bg)] text-[var(--tone-indigo)]' },
  applied:      { label: 'Aplicado',   cls: 'bg-[var(--tone-emerald-bg)] text-[var(--tone-emerald)]' },
  rejected:     { label: 'Rejeitado',  cls: 'bg-[var(--tone-rose-bg)] text-[var(--tone-rose)]' },
};

export const TYPE_LABEL = {
  quick:            { label: 'Rápido',  cls: 'bg-blue-100 text-blue-700' },
  precision:        { label: 'Precisão', cls: 'bg-purple-100 text-purple-700' },
  creation_request: { label: 'Criação', cls: 'bg-amber-100 text-amber-700' },
};

export const ITEM_STATUS = {
  pending:  { label: 'Pendente',  cls: 'bg-slate-100 text-slate-600' },
  accepted: { label: 'Aceite',    cls: 'bg-[var(--tone-emerald-bg)] text-[var(--tone-emerald)]' },
  edited:   { label: 'Editado',   cls: 'bg-[var(--tone-indigo-bg)] text-[var(--tone-indigo)]' },
  rejected: { label: 'Rejeitado', cls: 'bg-[var(--tone-rose-bg)] text-[var(--tone-rose)]' },
};

export const KIND_LABEL = {
  new:    { label: '✚ Novo dia',    cls: 'bg-[var(--tone-emerald-bg)] text-[var(--tone-emerald)] border-[var(--tone-emerald-border)]' },
  remove: { label: '✖ Remover dia', cls: 'bg-[var(--tone-rose-bg)] text-[var(--tone-rose)] border-[var(--tone-rose-border)]' },
  edit:   { label: '✎ Ajuste',      cls: 'bg-[var(--tone-indigo-bg)] text-[var(--tone-indigo)] border-[var(--tone-indigo-border)]' },
};

export const isEmptyTimes = (shape) => {
  if (!shape) return true;
  const noTimes = !shape.startTime && !shape.endTime && !shape.breakStart && !shape.breakEnd;
  const zero = shape.hours === 0 || shape.hours === '0' || shape.hours === null || shape.hours === undefined;
  return noTimes && zero;
};

export const detectKind = (item) => {
  if (!item.before || (item.before && !item.before.startTime && !item.before.endTime)) return 'new';
  if (isEmptyTimes(item.proposed)) return 'remove';
  return 'edit';
};

export const fmtTime = (t) => (t && t !== '--:--' ? t : '—');

export const itemDelta = (item) => {
  const beforeH = Number(item.before?.hours || 0);
  const finalH = item.item_status === 'rejected' ? beforeH : Number((item.final || item.proposed)?.hours || 0);
  return Number((finalH - beforeH).toFixed(2));
};

export const fmtDelta = (n) => {
  if (!n) return '0h';
  const sign = n > 0 ? '+' : '';
  return `${sign}${Number(n.toFixed(2))}h`;
};

export const deltaClass = (n) =>
  n > 0 ? 'bg-[var(--tone-emerald-bg)] text-[var(--tone-emerald)]' : n < 0 ? 'bg-[var(--tone-rose-bg)] text-[var(--tone-rose)]' : 'bg-slate-100 text-slate-500';
