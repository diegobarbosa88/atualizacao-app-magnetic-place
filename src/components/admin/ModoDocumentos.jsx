import React, { useState } from 'react';
import { Loader2, Upload, FileDown, Trash2 } from 'lucide-react';
import { STATUS_DOC } from '../../utils/validacaoHelpers';
import { useApp } from '../../context/AppContext';

// ─── Modo Documentos ──────────────────────────────────────────────────────────
const ModoDocumentos = ({ workers }) => {
  const { documents, saveToDb, handleDelete } = useApp();
  const docs = [...documents].sort((a, b) => new Date(b.dataEmissao || 0) - new Date(a.dataEmissao || 0));

  const [filtroWorker, setFiltroWorker] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('');
  const [enviandoId, setEnviandoId]   = useState(null);
  const [apagandoId, setApagandoId]   = useState(null);
  const [selecionados, setSelecionados] = useState(new Set());
  const [enviandoLote, setEnviandoLote] = useState(false);

  const enviar = async (doc) => {
    setEnviandoId(doc.id);
    await saveToDb('documents', doc.id, { status: 'Pendente' });
    setEnviandoId(null);
  };

  const apagar = async (doc) => {
    if (!window.confirm(`Apagar documento "${doc.nomeFicheiro}"?`)) return;
    setApagandoId(doc.id);
    try {
      await handleDelete('documents', doc.id);
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
    await db.from('documents').update({ status: 'Pendente' }).in('id', ids);
    setSelecionados(new Set());
    setEnviandoLote(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
        <div className="flex flex-col sm:flex-row gap-2">
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
              className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-white px-3 py-2 rounded-xl transition-colors disabled:opacity-40 hover:opacity-90"
              style={{ backgroundColor: '#1B3A57' }}>
              {enviandoLote ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
              Enviar ({selecionados.size})
            </button>
          )}
        </div>
      </div>

      {filtrados.length === 0 && (
        <p className="text-center text-slate-400 text-xs py-10">Nenhum documento encontrado.</p>
      )}

      {filtrados.length > 0 && (
        <div className="rounded-2xl border border-slate-100 overflow-x-auto">
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
                <th className="hidden sm:table-cell px-4 py-2.5 text-left text-[9px] font-black uppercase tracking-widest text-slate-400">Data</th>
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
                      <p className="sm:hidden text-[10px] text-slate-400 mt-0.5">
                        {doc.dataEmissao ? new Date(doc.dataEmissao).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', year: 'numeric' }) : ''}
                      </p>
                    </td>
                    <td className="hidden sm:table-cell px-4 py-3 text-slate-500 whitespace-nowrap">
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
                          className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors" title="Ver PDF">
                          <FileDown size={15} />
                        </a>
                        {doc.status === 'Rascunho' && (
                          <button onClick={() => enviar(doc)} disabled={enviandoId === doc.id}
                            className="p-2 rounded-lg text-slate-400 hover:bg-emerald-50 hover:text-emerald-600 transition-colors disabled:opacity-40" title="Enviar para trabalhador">
                            {enviandoId === doc.id ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
                          </button>
                        )}
                        <button onClick={() => apagar(doc)} disabled={apagandoId === doc.id}
                          className="p-2 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors disabled:opacity-40" title="Apagar">
                          {apagandoId === doc.id ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
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
