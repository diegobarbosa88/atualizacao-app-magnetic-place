import React from 'react';
import { isEmptyTimes, fmtTime } from './correctionsUtils';

export default function TimesCell({ shape, placeholder }) {
  if (!shape || isEmptyTimes(shape)) {
    return <p className="text-xs text-slate-400 italic leading-tight">{placeholder || '—'}</p>;
  }
  return (
    <div className="text-xs leading-tight">
      <div className="font-mono font-bold text-slate-700">{fmtTime(shape.startTime)} → {fmtTime(shape.endTime)}</div>
      <div className="font-mono text-slate-400">Pausa: {fmtTime(shape.breakStart)}–{fmtTime(shape.breakEnd)}</div>
      <div className="text-[10px] font-black text-slate-500 mt-0.5">{shape.hours ?? '—'}h</div>
    </div>
  );
}
