import React, { useState } from 'react';
import { ChevronDown, ChevronUp, X, Save, Search, Loader2, Check } from 'lucide-react';
import { DEFAULT_GMAIL_CONFIG, configParaQuery } from './faturasUtils';
import { FT, SCALE } from '../../../styles/designTokens';

export default function GmailConfigPanel({
  cfg,
  onCfgChange,
  onSave,
  onImport,
  importing,
  importResult,
}) {
  const [mostrarConfig, setMostrarConfig] = useState(false);
  const [assuntoInput, setAssuntoInput] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [guardado, setGuardado] = useState(false);
  const query = configParaQuery(cfg);

  const handleGuardar = async () => {
    setGuardando(true);
    setGuardado(false);
    try {
      await onSave(cfg);
      setGuardado(true);
      setTimeout(() => setGuardado(false), 2500);
    } finally {
      setGuardando(false);
    }
  };

  const setCfgField = (field, val) => onCfgChange(prev => ({ ...prev, [field]: val }));

  const addAssunto = () => {
    const a = assuntoInput.trim();
    if (a && !cfg.assuntos.includes(a)) onCfgChange(prev => ({ ...prev, assuntos: [...prev.assuntos, a] }));
    setAssuntoInput('');
  };

  const removeAssunto = (a) => onCfgChange(prev => ({ ...prev, assuntos: prev.assuntos.filter(x => x !== a) }));

  return (
    <div className="bg-white rounded-[2rem] border border-[var(--border-soft)] shadow-sm p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-widest text-[var(--slate-dim)] mb-1">Pesquisa Gmail activa</p>
          <p className="text-xs font-mono text-[var(--slate-dim)] break-all">{query}</p>
        </div>
        <button onClick={() => setMostrarConfig(v => !v)}
          className="flex items-center gap-1 px-3 py-2 text-xs font-black uppercase tracking-widest text-[var(--slate-dim)] hover:text-indigo-600 transition-colors shrink-0">
          {mostrarConfig ? <ChevronUp size={14} /> : <ChevronDown size={14} />} Configurar
        </button>
      </div>

      {mostrarConfig && (
        <div className="border-t border-[var(--border-soft)] pt-4 space-y-4">
          <div className="space-y-1.5">
            <p className={`${SCALE.text.statLabel} text-[var(--slate-dim)]`}>Estado dos emails</p>
            <div className="flex gap-3 flex-wrap">
              {[{ key: 'naoLidos', label: 'Sem ler' }, { key: 'lidos', label: 'Lidos' }].map(({ key, label }) => (
                <label key={key} className="flex items-center gap-2 cursor-pointer select-none">
                  <input type="checkbox" checked={cfg[key]} onChange={e => setCfgField(key, e.target.checked)}
                    className="rounded border-[var(--border)] text-indigo-600 focus:ring-indigo-300 cursor-pointer" />
                  <span className="text-xs font-black uppercase tracking-widest text-[var(--ink-soft)]">{label}</span>
                </label>
              ))}
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input type="checkbox" checked={cfg.temAnexo} onChange={e => setCfgField('temAnexo', e.target.checked)}
                  className="rounded border-[var(--border)] text-indigo-600 focus:ring-indigo-300 cursor-pointer" />
                <span className="text-xs font-black uppercase tracking-widest text-[var(--ink-soft)]">Tem anexo</span>
              </label>
            </div>
          </div>

          <div className="space-y-1.5">
            <p className={`${SCALE.text.statLabel} text-[var(--slate-dim)]`}>Palavras no assunto</p>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {cfg.assuntos.map(a => (
                <span key={a} className="flex items-center gap-1 px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-lg text-xs font-semibold">
                  {a}
                  <button onClick={() => removeAssunto(a)} className="text-indigo-400 hover:text-indigo-700"><X size={11} /></button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input value={assuntoInput} onChange={e => setAssuntoInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addAssunto(); } }}
                placeholder="ex: recibo, nota de crédito..."
                className="flex-1 px-3 py-2 rounded-xl border border-[var(--border)] text-xs text-[var(--ink-mid)] focus:outline-none focus:ring-2 focus:ring-indigo-300" />
              <button onClick={addAssunto}
                className="px-3 py-2 bg-indigo-50 text-indigo-600 rounded-xl text-xs font-black hover:bg-indigo-100 transition-colors">
                Adicionar
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <p className={`${SCALE.text.statLabel} text-[var(--slate-dim)]`}>Remetente (from:)</p>
            <input value={cfg.remetente} onChange={e => setCfgField('remetente', e.target.value)}
              placeholder="ex: fornecedor@empresa.pt"
              className="w-full px-3 py-2 rounded-xl border border-[var(--border)] text-xs text-[var(--ink-mid)] focus:outline-none focus:ring-2 focus:ring-indigo-300" />
          </div>

          <div className="space-y-1.5">
            <p className={`${SCALE.text.statLabel} text-[var(--slate-dim)]`}>Outros filtros (sintaxe Gmail)</p>
            <input value={cfg.palavras} onChange={e => setCfgField('palavras', e.target.value)}
              placeholder='ex: larger:1M after:2024/01/01'
              className="w-full px-3 py-2 rounded-xl border border-[var(--border)] text-xs font-mono text-[var(--ink-mid)] focus:outline-none focus:ring-2 focus:ring-indigo-300" />
          </div>

          <div className="flex items-center gap-2 justify-end pt-1">
            <button onClick={() => onCfgChange(() => ({ ...DEFAULT_GMAIL_CONFIG }))}
              className="px-3 py-2 text-xs font-black uppercase tracking-widest text-[var(--slate-dim)] hover:text-[var(--ink-soft)] transition-colors">
              Repor padrão
            </button>
            <button onClick={handleGuardar} disabled={guardando}
              className="flex items-center gap-1.5 px-4 py-2 bg-[var(--orange)] text-[var(--navy-solid)] rounded-xl text-xs font-black uppercase tracking-widest hover:bg-[var(--orange-hover)] transition-all disabled:opacity-60">
              {guardando ? <Loader2 size={13} className="animate-spin" /> : guardado ? <Check size={13} /> : <Save size={13} />}
              {guardando ? 'A guardar...' : guardado ? 'Guardado' : 'Guardar'}
            </button>
          </div>
        </div>
      )}

      <div className="border-t border-[var(--border-soft)] pt-4 flex items-center gap-3 flex-wrap">
        <button onClick={onImport} disabled={importing}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all disabled:opacity-60 border-2 hover:bg-[var(--surface)]"
          style={{ borderColor: FT.slate, color: 'var(--navy)' }}>
          {importing ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
          Importar do Gmail
        </button>
        {importResult && (
          <span className={`text-xs font-semibold ${importResult.error ? 'text-red-600' : 'text-emerald-700'}`}>
            {importResult.error
              ? `Erro: ${importResult.error}`
              : `${importResult.processados} email(s) · ${importResult.ficheiros} ficheiro(s)${importResult.erros?.length ? ` · ${importResult.erros.length} erro(s)` : ''}`}
            {importResult.aviso && <span className="block text-amber-600 font-bold mt-0.5">{importResult.aviso}</span>}
          </span>
        )}
      </div>
    </div>
  );
}
