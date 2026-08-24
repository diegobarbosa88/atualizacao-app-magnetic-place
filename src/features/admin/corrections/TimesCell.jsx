import React from 'react';
import { isEmptyTimes, fmtTime } from './correctionsUtils';
import { SCALE } from '../../../styles/designTokens';

export default function TimesCell({ shape, placeholder }) {
  if (!shape || isEmptyTimes(shape)) {
    return <p className="text-xs text-[var(--slate-dim)] italic leading-tight">{placeholder || '—'}</p>;
  }
  return (
    <div className="text-xs leading-tight">
      <div className="font-mono font-bold text-[var(--ink-mid)]">{fmtTime(shape.startTime)} → {fmtTime(shape.endTime)}</div>
      <div className="font-mono text-[var(--slate-dim)]">Pausa: {fmtTime(shape.breakStart)}–{fmtTime(shape.breakEnd)}</div>
      <div className={`${SCALE.text.meta} text-[var(--slate-dim)] mt-0.5`}>{shape.hours ?? '—'}h</div>
    </div>
  );
}
