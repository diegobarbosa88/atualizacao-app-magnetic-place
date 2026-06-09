import React, { useState, useEffect } from 'react';
import { ChevronDown, ChevronUp, Link2, Link2Off, Loader2, Download } from 'lucide-react';
import { useApp } from '../../../context/AppContext';

const TIPOS = [
  { key: 'vendas',  label: 'Faturas de vendas' },
  { key: 'compras', label: 'Faturas de compras' },
  { key: 'recibos', label: 'Recibos de venda' },
];

export default function TOConlinePanel({ onImportDone, importing, setImporting, importResult, setImportResult }) {
  const { supabase } = useApp();
  const [ligado, setLigado] = useState(false);
  const [ligando, setLigando] = useState(false);
  const [mostrarConfig, setMostrarConfig] = useState(false);
  const [tipos, setTipos] = useState(['vendas', 'compras', 'recibos']);
  const [dataDe, setDataDe] = useState('');
  const [dataAte, setDataAte] = useState('');

  useEffect(() => {
    // Verificar resultado do redirect OAuth (apenas uma vez, sem precisar de supabase)
    const params = new URLSearchParams(window.location.search);
    if (params.get('toconline_connected')) {
      setLigado(true);
      window.history.replaceState({}, '', window.location.pathname);
    }
    if (params.get('toconline_error')) {
      setImportResult({ error: decodeURIComponent(params.get('toconline_error')) });
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  useEffect(() => {
    if (!supabase) return;
    supabase
      .from('system_settings')
      .select('toconline_access_token')
      .eq('id', 1)
      .maybeSingle()
      .then(({ data }) => setLigado(!!data?.toconline_access_token));
  }, [supabase]);

  const handleLigar = async () => {
    setLigando(true);
    try {
      const res = await fetch('/api/toconline/auth-init');
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      // Redireciona a página atual — o callback devolve para cá com ?toconline_connected=1
      window.location.href = data.authUrl;
    } catch (e) {
      setImportResult({ error: e.message });
      setLigando(false);
    }
  };

  const handleDesligar = async () => {
    if (!confirm('Desligar o TOConline? Os documentos já importados ficam guardados.')) return;
    await supabase.from('system_settings').update({
      toconline_access_token: null,
      toconline_refresh_token: null,
      toconline_token_expires_at: null,
    }).eq('id', 1);
    setLigado(false);
    setImportResult(null);
  };

  const handleImportar = async () => {
    setImporting(true);
    setImportResult(null);
    try {
      const res = await fetch('/api/toconline/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipos, data_de: dataDe || undefined, data_ate: dataAte || undefined }),
      });
      const data = await res.json();
      setImportResult(data);
      if (!data.error) onImportDone?.();
    } catch (e) {
      setImportResult({ error: e.message });
    } finally {
      setImporting(false);
    }
  };

  const toggleTipo = (key) =>
    setTipos(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);

  return (
    <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-2 h-2 rounded-full ${ligado ? 'bg-emerald-500' : 'bg-slate-300'}`} />
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-slate-400 mb-0.5">TOConline</p>
            <p className="text-xs text-slate-500">{ligado ? 'Ligado — pronto a importar' : 'Não ligado'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {ligado ? (
            <>
              <button onClick={handleDesligar}
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-black uppercase tracking-widest text-slate-400 hover:text-red-500 transition-colors">
                <Link2Off size={13} /> Desligar
              </button>
              <button onClick={() => setMostrarConfig(v => !v)}
                className="flex items-center gap-1 px-3 py-2 text-xs font-black uppercase tracking-widest text-slate-500 hover:text-indigo-600 transition-colors">
                {mostrarConfig ? <ChevronUp size={14} /> : <ChevronDown size={14} />} Configurar
              </button>
            </>
          ) : (
            <button onClick={handleLigar} disabled={ligando}
              className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-blue-700 transition-all disabled:opacity-60">
              {ligando ? <Loader2 size={13} className="animate-spin" /> : <Link2 size={13} />}
              Ligar TOConline
            </button>
          )}
        </div>
      </div>

      {mostrarConfig && ligado && (
        <div className="border-t border-slate-100 pt-4 space-y-4">
          <div className="space-y-1.5">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Tipos de documentos</p>
            <div className="flex gap-3 flex-wrap">
              {TIPOS.map(({ key, label }) => (
                <label key={key} className="flex items-center gap-2 cursor-pointer select-none">
                  <input type="checkbox" checked={tipos.includes(key)} onChange={() => toggleTipo(key)}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-300 cursor-pointer" />
                  <span className="text-xs font-black uppercase tracking-widest text-slate-600">{label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex gap-3">
            <div className="space-y-1 flex-1">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Data de</p>
              <input type="date" value={dataDe} onChange={e => setDataDe(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
            <div className="space-y-1 flex-1">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Data até</p>
              <input type="date" value={dataAte} onChange={e => setDataAte(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
          </div>
        </div>
      )}

      {ligado && (
        <div className="border-t border-slate-100 pt-4 flex items-center gap-3 flex-wrap">
          <button onClick={handleImportar} disabled={importing || tipos.length === 0}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-blue-700 transition-all shadow-md shadow-blue-100 disabled:opacity-60">
            {importing ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
            Importar do TOConline
          </button>
          {importResult && (
            <span className={`text-xs font-semibold ${importResult.error ? 'text-red-600' : 'text-emerald-700'}`}>
              {importResult.error
                ? `Erro: ${importResult.error}`
                : `Vendas: ${importResult.vendas ?? 0} · Compras: ${importResult.compras ?? 0} · Recibos: ${importResult.recibos ?? 0}${importResult.duplicados ? ` · ${importResult.duplicados} duplicados ignorados` : ''}${importResult.erros?.length ? ` · ${importResult.erros.length} erro(s)` : ''}`}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
