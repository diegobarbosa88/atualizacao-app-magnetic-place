import React, { useState, useEffect } from 'react';
import { FileText, Download, Loader2, RefreshCw, ExternalLink, Trash2, Search, Save, ChevronDown, ChevronUp } from 'lucide-react';
import { useApp } from '../../context/AppContext';

const DEFAULT_QUERY = 'is:unread has:attachment {subject:fatura subject:invoice subject:FT}';
const STORAGE_KEY = 'faturas_gmail_query';

export default function FaturasAdmin() {
  const { supabase } = useApp();
  const [faturas, setFaturas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState(null);
  const [apagando, setApagando] = useState(null);

  // Query config
  const [query, setQuery] = useState(() => localStorage.getItem(STORAGE_KEY) || DEFAULT_QUERY);
  const [queryEditando, setQueryEditando] = useState(query);
  const [mostrarConfig, setMostrarConfig] = useState(false);

  // Import
  const [importando, setImportando] = useState(false);
  const [importResult, setImportResult] = useState(null);

  const guardarQuery = () => {
    const q = queryEditando.trim() || DEFAULT_QUERY;
    setQuery(q);
    setQueryEditando(q);
    localStorage.setItem(STORAGE_KEY, q);
    setMostrarConfig(false);
  };

  const resetQuery = () => {
    setQueryEditando(DEFAULT_QUERY);
  };

  const carregar = async () => {
    setLoading(true);
    setErro(null);
    try {
      const { data, error } = await supabase
        .from('faturas')
        .select('*')
        .order('importado_em', { ascending: false });
      if (error) throw error;
      setFaturas(data || []);
    } catch (e) {
      setErro(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleImportar = async () => {
    setImportando(true);
    setImportResult(null);
    try {
      const res = await fetch('/api/gmail/import-faturas', {
        method: 'POST',
        headers: {
          'x-import-secret': import.meta.env.VITE_GMAIL_IMPORT_SECRET || '',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query }),
      });
      const data = await res.json();
      setImportResult(data);
      if (!data.error) carregar();
    } catch (e) {
      setImportResult({ error: e.message });
    } finally {
      setImportando(false);
    }
  };

  useEffect(() => { carregar(); }, []);

  const formatBytes = (bytes) => {
    if (!bytes) return '—';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (iso) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const handleApagar = async (fatura) => {
    if (!confirm(`Apagar "${fatura.filename}"?`)) return;
    setApagando(fatura.id);
    try {
      await supabase.storage.from('faturas').remove([fatura.storage_path]);
      await supabase.from('faturas').delete().eq('id', fatura.id);
      setFaturas(prev => prev.filter(f => f.id !== fatura.id));
    } catch (e) {
      alert(`Erro ao apagar: ${e.message}`);
    } finally {
      setApagando(null);
    }
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6">

      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl sm:text-2xl font-black flex items-center gap-2">
          <FileText size={22} className="text-emerald-600" />
          Faturas Importadas
        </h2>
        <button
          onClick={carregar}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 text-slate-600 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-200 transition-all disabled:opacity-50"
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          Atualizar
        </button>
      </div>

      {/* Painel de importação + config */}
      <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-slate-400 mb-1">Pesquisa Gmail activa</p>
            <p className="text-sm font-mono text-slate-600 break-all">{query}</p>
          </div>
          <button
            onClick={() => { setMostrarConfig(v => !v); setQueryEditando(query); }}
            className="flex items-center gap-1 px-3 py-2 text-xs font-black uppercase tracking-widest text-slate-500 hover:text-indigo-600 transition-colors shrink-0"
          >
            {mostrarConfig ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            Editar
          </button>
        </div>

        {mostrarConfig && (
          <div className="border-t border-slate-100 pt-4 space-y-3">
            <p className="text-xs text-slate-400 font-semibold">
              A query usa a sintaxe de pesquisa do Gmail. Exemplos de termos: <span className="font-mono">subject:fatura</span>, <span className="font-mono">from:fornecedor@empresa.pt</span>, <span className="font-mono">has:attachment</span>, <span className="font-mono">is:unread</span>.
            </p>
            <textarea
              value={queryEditando}
              onChange={e => setQueryEditando(e.target.value)}
              rows={3}
              className="w-full px-4 py-3 rounded-2xl border border-slate-200 text-sm font-mono text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none"
              placeholder="is:unread has:attachment {subject:fatura subject:invoice}"
            />
            <div className="flex items-center gap-2 justify-end">
              <button
                onClick={resetQuery}
                className="px-3 py-2 text-xs font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 transition-colors"
              >
                Repor padrão
              </button>
              <button
                onClick={guardarQuery}
                className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-indigo-700 transition-all"
              >
                <Save size={13} /> Guardar
              </button>
            </div>
          </div>
        )}

        <div className="border-t border-slate-100 pt-4 flex items-center gap-3 flex-wrap">
          <button
            onClick={handleImportar}
            disabled={importando}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-emerald-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-md shadow-emerald-100 disabled:opacity-60"
          >
            {importando ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
            Importar do Gmail
          </button>
          {importResult && (
            <span className={`text-xs font-semibold ${importResult.error ? 'text-red-600' : 'text-emerald-700'}`}>
              {importResult.error
                ? `Erro: ${importResult.error}`
                : `${importResult.processados} email(s) · ${importResult.ficheiros} ficheiro(s)${importResult.erros?.length ? ` · ${importResult.erros.length} erro(s)` : ''}`
              }
            </span>
          )}
        </div>
      </div>

      {/* Erros */}
      {erro && (
        <div className="bg-red-50 text-red-700 px-4 py-3 rounded-2xl text-sm font-semibold">
          Erro: {erro}
        </div>
      )}

      {/* Tabela */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 size={32} className="animate-spin text-slate-300" />
        </div>
      ) : faturas.length === 0 ? (
        <div className="text-center py-16 text-slate-400 text-sm font-semibold">
          Nenhuma fatura importada ainda.
        </div>
      ) : (
        <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Ficheiro</th>
                  <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Nº Fatura</th>
                  <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Fornecedor</th>
                  <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">NIF</th>
                  <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Data</th>
                  <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Total</th>
                  <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">IVA</th>
                  <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Ações</th>
                </tr>
              </thead>
              <tbody>
                {faturas.map((f, i) => {
                  const d = f.dados || {};
                  return (
                  <tr key={f.id} className={`border-b border-slate-50 hover:bg-slate-50 transition-colors ${i % 2 === 0 ? '' : 'bg-slate-50/40'}`}>
                    <td className="px-4 py-3 max-w-[160px]">
                      <p className="text-xs font-semibold text-slate-700 truncate" title={f.filename}>{f.filename}</p>
                      <p className="text-[10px] text-slate-400">{formatDate(f.importado_em)}</p>
                    </td>
                    <td className="px-4 py-3 text-xs font-mono text-slate-600">{d.numero_fatura || <span className="text-slate-300">—</span>}</td>
                    <td className="px-4 py-3 text-xs text-slate-600 max-w-[140px] truncate" title={d.fornecedor}>{d.fornecedor || <span className="text-slate-300">—</span>}</td>
                    <td className="px-4 py-3 text-xs font-mono text-slate-500">{d.nif_fornecedor || <span className="text-slate-300">—</span>}</td>
                    <td className="px-4 py-3 text-xs text-slate-500">{d.data_fatura ? new Date(d.data_fatura).toLocaleDateString('pt-PT') : <span className="text-slate-300">—</span>}</td>
                    <td className="px-4 py-3 text-xs font-semibold text-slate-700">{d.valor_total != null ? `${d.valor_total.toFixed(2)} €` : <span className="text-slate-300">—</span>}</td>
                    <td className="px-4 py-3 text-xs text-slate-500">{d.iva != null ? `${d.iva.toFixed(2)} €` : <span className="text-slate-300">—</span>}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <a href={f.url} target="_blank" rel="noopener noreferrer" className="p-1.5 text-slate-400 hover:text-indigo-600 transition-colors" title="Abrir">
                          <ExternalLink size={14} />
                        </a>
                        <a href={f.url} download={f.filename} className="p-1.5 text-slate-400 hover:text-emerald-600 transition-colors" title="Download">
                          <Download size={14} />
                        </a>
                        <button onClick={() => handleApagar(f)} disabled={apagando === f.id} className="p-1.5 text-slate-400 hover:text-red-500 transition-colors disabled:opacity-50" title="Apagar">
                          {apagando === f.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                        </button>
                      </div>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 text-xs text-slate-400 font-semibold border-t border-slate-50">
            {faturas.length} fatura(s) importada(s)
          </div>
        </div>
      )}
    </div>
  );
}
