import React, { useRef, useEffect } from 'react';
import { Check, X, Pencil } from 'lucide-react';

export default function CelEditTd({
  fatura,
  campo,
  valor,
  className = '',
  tipo = 'text',
  celEdit,
  celValor,
  salvandoCell,
  onOpen,
  onValorChange,
  onSave,
  onCancel,
}) {
  const inputRef = useRef(null);
  const editando = celEdit?.id === fatura.id && celEdit?.campo === campo;

  useEffect(() => {
    if (editando) inputRef.current?.focus();
  }, [editando]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') onSave();
    if (e.key === 'Escape') onCancel();
  };

  if (editando) {
    return (
      <td className="px-2 py-2" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-1">
          <input ref={inputRef} type={tipo} value={celValor} onChange={e => onValorChange(e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-full px-2 py-1 rounded-lg border border-indigo-300 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white"
            style={{ minWidth: 80 }} />
          <button onClick={onSave} disabled={salvandoCell}
            className="p-1 text-emerald-600 hover:text-emerald-700 disabled:opacity-50"><Check size={13} /></button>
          <button onClick={onCancel} className="p-1 text-slate-400 hover:text-slate-600"><X size={13} /></button>
        </div>
      </td>
    );
  }

  return (
    <td className={`px-4 py-3 group relative ${className}`} onClick={e => e.stopPropagation()}
      onDoubleClick={e => onOpen(e, fatura, campo, valor)}>
      <span className="cursor-default">
        {valor !== null && valor !== undefined && valor !== ''
          ? valor
          : <span className="text-slate-300">—</span>}
      </span>
      <button onClick={e => onOpen(e, fatura, campo, valor)}
        className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity p-1 text-slate-300 hover:text-indigo-500">
        <Pencil size={11} />
      </button>
    </td>
  );
}
