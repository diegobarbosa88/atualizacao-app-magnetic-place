import React, { useState, useEffect, useRef } from 'react';
import { CNP_PROFISSOES } from '../data/cnpProfissoes';

export default function CnpCombobox({
  initialQuery = '',
  onSelect,
  inputClassName,
  placeholder = 'Pesquisar profissão…',
  formatSelected = (item) => `${item.codigo} — ${item.nome}`,
  workerKey,
}) {
  const [query, setQuery] = useState(initialQuery);
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    setQuery(initialQuery);
  }, [workerKey]);

  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = query.trim().length >= 1
    ? CNP_PROFISSOES.filter(p =>
        p.nome.toLowerCase().includes(query.toLowerCase()) ||
        p.codigo.startsWith(query.trim())
      ).slice(0, 12)
    : [];

  return (
    <div className="relative" ref={containerRef}>
      <input
        type="text"
        value={query}
        onChange={e => { setQuery(e.target.value); setOpen(true); }}
        onFocus={() => { if (query.trim().length >= 1) setOpen(true); }}
        className={inputClassName}
        placeholder={placeholder}
        autoComplete="off"
      />
      {open && filtered.length > 0 && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-xl max-h-56 overflow-y-auto">
          {filtered.map(item => (
            <button
              key={item.codigo}
              type="button"
              className="w-full text-left px-3 py-2 text-xs hover:bg-indigo-50 transition-colors border-b border-slate-50 last:border-0"
              onMouseDown={e => {
                e.preventDefault();
                setQuery(formatSelected(item));
                setOpen(false);
                onSelect?.(item);
              }}
            >
              <span className="font-mono text-[10px] text-slate-400 mr-2">{item.codigo}</span>
              <span className="font-semibold text-slate-800">{item.nome}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
