import React, { useState, useEffect, useCallback } from 'react';
import { Loader2, RefreshCw, Upload, FileDown, Trash2 } from 'lucide-react';
import { STATUS_DOC } from '../../utils/validacaoHelpers';

// ─── Modo Documentos ──────────────────────────────────────────────────────────
const ModoDocumentos = ({ workers }) => {
  const [docs, setDocs]               = useState([]);
  const [carregando, setCarregando]   = useState(false);
  const [filtroWorker, setFiltroWorker] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('');
  const [enviandoId, setEnviandoId]   = useState(null);
  const [apagandoId, setApagandoId]   = useState(null);
  const [selecionados, setSelecionados] = useState(new Set());
  const [enviandoLote, setEnviandoLote] = useState(false);

  const carregar = useCallback(async () => {
    const db = window.supabaseInstance;
    if (!db) return;
    setCarregando(true);
    const { data } = await db.from('documents').select('*').order('dataEmissao', { ascending: false }).limit(500);
    setDocs(data ?? []);
    setCarregando(false);
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  const enviar = async (doc) => {
    const db = window.supabaseInstance;
    if (!db) return;
    setEnviandoId(doc.id);
    const { error } = await db.from('documents').update({ status: 'Pendente' }).eq('id', doc.id);
    if (!error) setDocs(prev => prev.map(d => d.id === doc.id ? { ...d, status: 'Pendente' } : d));
    setEnviandoId(null);
  };

  const apagar = async (doc) => {
    const db = window.supabaseInstance;
    if (!db || !window.confirm(`Apagar documento "${doc.nomeFicheiro}"?`)) return;
    setApagandoId(doc.id);
    try {
      // Extrai o path do storage a partir do URL público
      const match = doc.url?.match(/\/documentos\/(.+)$/);
      if (match) await db.storage.from('documentos').remove([decodeURIComponent(match[1])]);
      await db.from('documents').delete().eq('id', doc.id);
      setDocs(prev => prev.filter(d => d.id !== doc.id));
    } finally {
      setApagandoId(null);
    }
  };

  const filtrados = docs.filter(d => {
    if (filtroWorker && d.workerId !== filtroWorker) return false;
    if (filtroStatus && d.status !== filtroStatus) return false;
    return true;
  });

  const workersComDocs = workers.filter(w => docs.some(d => d.workerId === w.id));

  const rascunhosFiltrados = filtrados.filter(d => d.status === 'Rascunho');
  const todosRascunhosSelecionados = rascunhosFiltrados.length > 0 && rascunhosFiltrados.every(d => selecionados.has(d.id));

  const toggleSelecionado = (id) => setSelecionados(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const toggleTodos = () => {
    if (todosRascunhosSelecionados) {
      setSelecionados(prev => { const next = new Set(prev); rascunhosFiltrados.forEach(d => next.delete(d.id)); return next; });
    } else {
      setSelecionados(prev => { const next = new Set(prev); rascunhosFiltrados.forEach(d => next.add(d.id)); return next; });
    }
  };

  const enviarSelecionados = async () => {
    const db = window.supabaseInstance;
    if (!db || selecionados.size === 0) return;
    setEnviandoLote(true);
    const ids = [...selecionados];
    const { error } = await db.from('documents').update({ status: 'Pendente' }).in('id', ids);
    if (!error) {
      setDocs(prev => prev.map(d => ids.includes(d.id) ? { ...d, status: 'Pendente' } : d));
      setSelecionados(new Set());
    }
    setEnviandoLote(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap items-center justify-between">
        <div className="flex gap-2 flex-wrap">
          <select value={filtroWorker} onChange={e => setFiltroWorker(e.target.value)}
            className="text-[10px] font-black uppercase tracking-widest border border-slate-200 rounded-xl px-3 py-2 bg-white text-slate-600 focus:outline-none focus:border-indigo-400">
            <option value="">Todos os trabalhadores</option>
            {workersComDocs.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
          <select value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)}
            className="text-[10px] font-black uppercase tracking-widest border border-slate-200 rounded-xl px-3 py-2 bg-white text-slate-600 focus:outline-none focus:border-indigo-400">
            <option value="">Todos os estados</option>
            {Object.entries(STATUS_DOC).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-2">
          {selecionados.size > 0 && (
            <button onClick={enviarSelecionados} disabled={enviandoLote}
              className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest bg-emerald-600 text-white px-3 py-2 rounded-xl hover:bg-emerald-700 transition-colors disabled:opacity-40">
              {enviandoLote ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
              Enviar ({selecionados.size})
            </button>
          )}
          <button onClick={carregar} disabled={carregando}
            className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-indigo-600 transition-colors disabled:opacity-40">
            <RefreshCw size={13} className={carregando ? 'animate-spin' : ''} /> Atualizar
          </button>
        </div>
      </div>

      {filtrados.length === 0 && !carregando && (
        <p className="text-center text-slate-400 text-xs py-10">Nenhum documento encontrado.</p>
      )}

      {filtrados.length > 0 && (
        <div className="rounded-2xl border border-slate-100 overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="px-4 py-2.5 w-8">
                  {rascunhosFiltrados.length > 0 && (
                    <input type="checkbox" checked={todosRascunhosSelecionados} onChange={toggleTodos}
                      className="accent-emerald-600 cursor-pointer" />
                  )}
                </th>
                <th className="px-4 py-2.5 text-left text-[9px] font-black uppercase tracking-widest text-slate-400">Trabalhador</th>
                <th className="px-4 py-2.5 text-left text-[9px] font-black uppercase tracking-widest text-slate-400">Documento</th>
                <th className="px-4 py-2.5 text-left text-[9px] font-black uppercase tracking-widest text-slate-400">Data</th>
                <th className="px-4 py-2.5 text-center text-[9px] font-black uppercase tracking-widest text-slate-400">Estado</th>
                <th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtrados.map(doc => {
                const worker = workers.find(w => w.id === doc.workerId);
                const estado = STATUS_DOC[doc.status] ?? STATUS_DOC.Rascunho;
                return (
                  <tr key={doc.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3">
                      {doc.status === 'Rascunho' && (
                        <input type="checkbox" checked={selecionados.has(doc.id)} onChange={() => toggleSelecionado(doc.id)}
                          className="accent-emerald-600 cursor-pointer" />
                      )}
                    </td>
                    <td className="px-4 py-3 font-bold text-slate-800">{worker?.name ?? doc.workerId}</td>
                    <td className="px-4 py-3">
                      <p className="text-slate-700 font-bold">{doc.tipo}</p>
                      <p className="text-[10px] text-slate-400">{doc.nomeFicheiro}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                      {doc.dataEmissao ? new Date(doc.dataEmissao).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${estado.cls}`}>
                        {estado.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <a href={doc.url} target="_blank" rel="noreferrer"
                          className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors" title="Ver PDF">
                          <FileDown size={14} />
                        </a>
                        {doc.status === 'Rascunho' && (
                          <button onClick={() => enviar(doc)} disabled={enviandoId === doc.id}
                            className="p-1.5 rounded-lg text-slate-400 hover:bg-emerald-50 hover:text-emerald-600 transition-colors disabled:opacity-40" title="Enviar para trabalhador">
                            {enviandoId === doc.id ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                          </button>
                        )}
                        <button onClick={() => apagar(doc)} disabled={apagandoId === doc.id}
                          className="p-1.5 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors disabled:opacity-40" title="Apagar">
                          {apagandoId === doc.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default ModoDocumentos;
