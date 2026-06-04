import React from 'react';
import { Tag } from 'lucide-react';

const COR_MAP = {
  violet:  { bg: 'bg-violet-100',  text: 'text-violet-700',  ring: 'ring-violet-400',  dot: 'bg-violet-500'  },
  emerald: { bg: 'bg-emerald-100', text: 'text-emerald-700', ring: 'ring-emerald-400', dot: 'bg-emerald-500' },
  blue:    { bg: 'bg-blue-100',    text: 'text-blue-700',    ring: 'ring-blue-400',    dot: 'bg-blue-500'    },
  orange:  { bg: 'bg-orange-100',  text: 'text-orange-700',  ring: 'ring-orange-400',  dot: 'bg-orange-500'  },
  slate:   { bg: 'bg-slate-100',   text: 'text-slate-600',   ring: 'ring-slate-400',   dot: 'bg-slate-500'   },
  rose:    { bg: 'bg-rose-100',    text: 'text-rose-700',    ring: 'ring-rose-400',    dot: 'bg-rose-500'    },
  amber:   { bg: 'bg-amber-100',   text: 'text-amber-700',   ring: 'ring-amber-400',   dot: 'bg-amber-500'   },
  indigo:  { bg: 'bg-indigo-100',  text: 'text-indigo-700',  ring: 'ring-indigo-400',  dot: 'bg-indigo-500'  },
  cyan:    { bg: 'bg-cyan-100',    text: 'text-cyan-700',    ring: 'ring-cyan-400',    dot: 'bg-cyan-500'    },
  gray:    { bg: 'bg-gray-100',    text: 'text-gray-600',    ring: 'ring-gray-400',    dot: 'bg-gray-400'    },
};

export default function TagBadge({ nome, cor }) {
  const c = COR_MAP[cor] || COR_MAP.gray;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest ${c.bg} ${c.text}`}>
      <Tag size={9} /> {nome}
    </span>
  );
}
