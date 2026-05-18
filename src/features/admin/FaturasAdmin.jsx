import React, { useState, useEffect } from 'react';
import { FileText, Download, Loader2, RefreshCw, ExternalLink, Trash2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export default function FaturasAdmin() {
  const { supabase } = useApp();
  const [faturas, setFaturas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState(null);
  const [apagando, setApagando] = useState(null);

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

      {erro && (
        <div className="bg-red-50 text-red-700 px-4 py-3 rounded-2xl text-sm font-semibold">
          Erro: {erro}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 size={32} className="animate-spin text-slate-300" />
        </div>
      ) : faturas.length === 0 ? (
        <div className="text-center py-16 text-slate-400 text-sm font-semibold">
          Nenhuma fatura importada ainda.<br />
          <span className="text-xs font-normal">Usa o botão "Gmail" na tab Documentos para importar.</span>
        </div>
      ) : (
        <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Ficheiro</th>
                  <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Tipo</th>
                  <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Tamanho</th>
                  <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Importado em</th>
                  <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Ações</th>
                </tr>
              </thead>
              <tbody>
                {faturas.map((f, i) => (
                  <tr key={f.id} className={`border-b border-slate-50 hover:bg-slate-50 transition-colors ${i % 2 === 0 ? '' : 'bg-slate-50/40'}`}>
                    <td className="px-4 py-3 text-sm font-semibold text-slate-700 max-w-xs truncate">
                      {f.filename}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${f.mime_type === 'application/pdf' ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'}`}>
                        {f.mime_type === 'application/pdf' ? 'PDF' : 'XML'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">{formatBytes(f.tamanho)}</td>
                    <td className="px-4 py-3 text-xs text-slate-500">{formatDate(f.importado_em)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <a
                          href={f.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 text-slate-400 hover:text-indigo-600 transition-colors"
                          title="Abrir"
                        >
                          <ExternalLink size={14} />
                        </a>
                        <a
                          href={f.url}
                          download={f.filename}
                          className="p-1.5 text-slate-400 hover:text-emerald-600 transition-colors"
                          title="Download"
                        >
                          <Download size={14} />
                        </a>
                        <button
                          onClick={() => handleApagar(f)}
                          disabled={apagando === f.id}
                          className="p-1.5 text-slate-400 hover:text-red-500 transition-colors disabled:opacity-50"
                          title="Apagar"
                        >
                          {apagando === f.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
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
