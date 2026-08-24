import React from 'react';
import { STATUS } from '../constants';
import { SCALE } from '../../../styles/designTokens';

const MonthStatusBadge = ({ corrections }) => {
  if (!corrections || corrections.length === 0) {
    return <span className={`${SCALE.text.meta} px-3 py-1 rounded-md bg-slate-100 text-slate-500`}>Sem reportes</span>;
  }
  const open = corrections.find((c) => c.status === 'submitted' || c.status === 'under_review');
  if (open) return <span className={`${SCALE.text.meta} px-3 py-1 rounded-md ${STATUS[open.status].cls}`}>{STATUS[open.status].label}</span>;
  const last = corrections[0];
  return <span className={`${SCALE.text.meta} px-3 py-1 rounded-md ${STATUS[last.status]?.cls || ''}`}>{STATUS[last.status]?.label}</span>;
};

export default MonthStatusBadge;
