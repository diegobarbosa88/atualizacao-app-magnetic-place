import React, { useState } from 'react';
import { Clock, ChevronDown } from 'lucide-react';
import { STATUS } from '../constants';

const HistoryItem = ({ correction, items }) => {
  const [open, setOpen] = useState(false);
  const myItems = items.filter((i) => i.correction_id === correction.id);
  return (
    <div className="border border-slate-100 rounded-2xl bg-white">
      <button onClick={() => setOpen(!open)} className="w-full p-4 flex items-center gap-3 text-left">
        <div className="w-10 h-10 bg-slate-50 text-slate-400 rounded-xl flex items-center justify-center">
          <Clock size={18} />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-slate-800 text-sm">{correction.month}</span>
            <span className="text-[10px] font-mono text-slate-400">{correction.type}</span>
            <span className={`text-[10px] font-black px-2 py-0.5 rounded-md ${STATUS[correction.status]?.cls}`}>{STATUS[correction.status]?.label}</span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">{myItems.length} alteração(ões) • submetido {correction.submitted_at?.slice(0, 10)}</p>
        </div>
        <ChevronDown size={16} className={`text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-2">
          {correction.justification && (
            <p className="text-xs text-slate-600 italic border-l-2 border-slate-200 pl-2">"{correction.justification}"</p>
          )}
          {myItems.map((it) => (
            <div key={it.id} className="text-xs flex items-center justify-between border-t border-slate-50 pt-2">
              <span className="font-bold text-slate-700">{it.worker_name} • {it.date}</span>
              <span className={`text-[10px] font-black px-2 py-0.5 rounded-md ${STATUS[correction.status]?.cls}`}>{it.item_status}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default HistoryItem;
