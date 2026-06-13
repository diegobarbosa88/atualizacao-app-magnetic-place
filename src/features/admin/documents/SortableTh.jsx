import React from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';

export default function SortableTh({ label, columnKey, sortKey, sortDir, onSort, className = '' }) {
  const active = sortKey === columnKey;
  return (
    <th
      onClick={() => onSort(columnKey)}
      className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest cursor-pointer select-none hover:text-slate-600 transition-colors ${className}`}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {active && (sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
      </span>
    </th>
  );
}
