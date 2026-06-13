export const STATUS_LABEL = {
  submitted:    { label: 'Submetido',  cls: 'bg-amber-100 text-amber-700' },
  under_review: { label: 'Em Revisão', cls: 'bg-indigo-100 text-indigo-700' },
  applied:      { label: 'Aplicado',   cls: 'bg-emerald-100 text-emerald-700' },
  rejected:     { label: 'Rejeitado',  cls: 'bg-rose-100 text-rose-700' },
};

export const TYPE_LABEL = {
  quick:            { label: 'Rápido',  cls: 'bg-blue-100 text-blue-700' },
  precision:        { label: 'Precisão', cls: 'bg-purple-100 text-purple-700' },
  creation_request: { label: 'Criação', cls: 'bg-amber-100 text-amber-700' },
};

export const ITEM_STATUS = {
  pending:  { label: 'Pendente',  cls: 'bg-slate-100 text-slate-600' },
  accepted: { label: 'Aceite',    cls: 'bg-emerald-100 text-emerald-700' },
  edited:   { label: 'Editado',   cls: 'bg-indigo-100 text-indigo-700' },
  rejected: { label: 'Rejeitado', cls: 'bg-rose-100 text-rose-700' },
};

export const KIND_LABEL = {
  new:    { label: '✚ Novo dia',    cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  remove: { label: '✖ Remover dia', cls: 'bg-rose-50 text-rose-700 border-rose-200' },
  edit:   { label: '✎ Ajuste',      cls: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
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
  n > 0 ? 'bg-emerald-100 text-emerald-700' : n < 0 ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-500';
