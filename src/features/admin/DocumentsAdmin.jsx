import React, { useState } from 'react';
import { FileText, Eye, CheckCircle, Trash2, Search, Upload, Loader2 } from 'lucide-react';
import { formatDocDate } from '../../utils/dateUtils';

const DocumentsAdmin = ({ workers = [], documents = [], setDocuments }) => {
  const [selWorker, setSelWorker] = useState('');
  const [selTipo, setSelTipo] = useState('Recibo de Vencimento');
  const [selFile, setSelFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('Todos');
  const [sortConfig, setSortConfig] = useState({ key: 'dataEmissao', direction: 'desc' });

  const tipos = ['Recibo de Vencimento', 'Mapa de Deslocamento', 'Contrato de Trabalho', 'Outro'];

  const requestSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const onUpload = async () => {
    if (!selWorker || !selFile) return alert('Selecione tudo.');
    setUploading(true);

    const clientSupabase = window.supabaseInstance;
    if (!clientSupabase) {
      setUploading(false);
      return alert('A conexão com a base de dados falhou. Por favor, atualize a página (F5) e tente novamente.');
    }

    const docId = `doc_${Date.now()}`;

    // Higienizar totalmente o caminho para evitar erros HTTP 502 no Supabase
    const cleanTipo = selTipo.replace(/[^a-zA-Z0-9]/g, '_');
    const cleanName = selFile.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const path = `${selWorker}/${cleanTipo}/${Date.now()}_${cleanName}`;

    try {
      const { error: upError } = await clientSupabase.storage.from('documentos').upload(path, selFile);
      if (upError) throw upError;

      const { data: urlData } = clientSupabase.storage.from('documentos').getPublicUrl(path);

      const newDoc = {
        id: docId,
        workerId: selWorker,
        tipo: selTipo,
        nomeFicheiro: selFile.name,
        url: urlData.publicUrl,
        status: 'Pendente',
        dataEmissao: new Date().toISOString()
      };

      const { file: _unused, ...docToInsert } = newDoc;

      const { error: dbError } = await clientSupabase
        .from('documents')
        .insert([docToInsert]);

      if (dbError) throw dbError;

      if (setDocuments) {
        setDocuments(prev => [newDoc, ...prev]);
      }
      alert('Documento enviado com sucesso!');
      setSelFile(null);

    } catch (err) {
      console.error("Erro no upload:", err);
      alert(`Erro: ${err.message}`);
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteDoc = async (doc) => {
    if (!window.confirm('Apagar documento permanentemente?')) return;

    try {
      const pathInStorage = doc.url?.includes('/documentos/') ? doc.url.split('/documentos/')[1] : null;

      if (pathInStorage) {
        await supabase.storage.from('documentos').remove([pathInStorage]);
      }

      const { error } = await supabase
        .from('documents')
        .delete()
        .eq('id', doc.id);

      if (error) throw error;

      if (setDocuments) {
        setDocuments(prev => prev.filter(d => d.id !== doc.id));
      }
      alert('Apagado com sucesso!');
    } catch (err) {
      alert(`Erro ao apagar: ${err.message}`);
    }
  };

  return (
    <div className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-slate-100 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center gap-3 mb-8 border-b border-slate-50 pb-6">
        <div className="bg-indigo-50 p-2 rounded-xl text-indigo-600">
          <FileText size={20} />
        </div>
        <h3 className="font-black text-xl text-slate-800 uppercase tracking-tight">Gestão de Documentos</h3>
      </div>

      <div className="bg-slate-50/50 rounded-[2rem] p-6 mb-8 border border-slate-100">
        <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-4 ml-1">Upload de Novo Ficheiro (PDF)</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div className="space-y-1">
            <label className="text-[9px] font-bold text-slate-400 ml-2 uppercase">Colaborador</label>
            <select
              className="w-full p-3 rounded-xl border border-slate-200 bg-white text-sm focus:ring-2 focus:ring-indigo-500 outline-none font-medium"
              value={selWorker}
              onChange={(e) => setSelWorker(e.target.value)}
            >
              <option value="">Selecionar...</option>
              {workers.map(w => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-[9px] font-bold text-slate-400 ml-2 uppercase">Tipo</label>
            <select
              className="w-full p-3 rounded-xl border border-slate-200 bg-white text-sm focus:ring-2 focus:ring-indigo-500 outline-none font-medium"
              value={selTipo}
              onChange={(e) => setSelTipo(e.target.value)}
            >
              {tipos.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-[9px] font-bold text-slate-400 ml-2 uppercase">Ficheiro</label>
            <input
              type="file"
              accept=".pdf"
              className="w-full p-2.5 rounded-xl border border-slate-200 bg-white text-xs file:hidden cursor-pointer"
              onChange={(e) => setSelFile(e.target.files?.[0])}
            />
          </div>
        </div>
        <button
          onClick={onUpload}
          disabled={uploading || !selWorker || !selFile}
          className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest flex items-center justify-center gap-3 disabled:opacity-50 transition-all hover:bg-slate-900 shadow-lg shadow-indigo-200 active:scale-[0.98]"
        >
          {uploading ? <Loader2 className="animate-spin" size={18} /> : <Upload size={18} />}
          {uploading ? 'A Enviar ficheiro...' : 'Submeter Documento'}
        </button>
      </div>

      <div className="flex flex-col md:flex-row gap-4 mb-6 items-center">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            placeholder="Pesquisar por colaborador ou ficheiro..."
            className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <select
          className="w-full md:w-48 p-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-slate-700 outline-none"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="Todos">Todos os Estados</option>
          <option value="Pendente">Pendentes</option>
          <option value="Assinado">Assinados</option>
        </select>
      </div>

      <div className="overflow-x-auto -mx-2">
        <table className="w-full text-left border-separate border-spacing-y-2">
          <thead>
            <tr className="text-slate-400">
              <th
                className="px-4 py-2 text-[10px] font-black uppercase tracking-widest cursor-pointer hover:text-indigo-600 transition-colors"
                onClick={() => requestSort('dataEmissao')}
              >
                Data {sortConfig.key === 'dataEmissao' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
              </th>
              <th
                className="px-4 py-2 text-[10px] font-black uppercase tracking-widest cursor-pointer hover:text-indigo-600 transition-colors"
                onClick={() => requestSort('workerName')}
              >
                Colaborador {sortConfig.key === 'workerName' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
              </th>
              <th
                className="px-4 py-2 text-[10px] font-black uppercase tracking-widest cursor-pointer hover:text-indigo-600 transition-colors"
                onClick={() => requestSort('tipo')}
              >
                Tipo / Nome {sortConfig.key === 'tipo' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
              </th>
              <th
                className="px-4 py-2 text-[10px] font-black uppercase tracking-widest cursor-pointer hover:text-indigo-600 transition-colors"
                onClick={() => requestSort('status')}
              >
                Estado {sortConfig.key === 'status' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
              </th>
              <th className="px-4 py-2 text-[10px] font-black uppercase tracking-widest text-right">Ação</th>
            </tr>
          </thead>
          <tbody>
            {documents.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-20 text-center">
                  <div className="flex flex-col items-center gap-2 opacity-30">
                    <FileText size={40} />
                    <p className="text-xs font-black uppercase tracking-widest">Sem documentos registados</p>
                  </div>
                </td>
              </tr>
            ) : (
              [...documents]
                .map(doc => ({
                  ...doc,
                  workerName: workers.find(w => w.id === doc.workerId)?.name || 'Desconhecido'
                }))
                .filter(doc => {
                  const matchSearch = doc.workerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    (doc.nomeFicheiro || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                    doc.tipo.toLowerCase().includes(searchTerm.toLowerCase());
                  const matchStatus = statusFilter === 'Todos' || doc.status === statusFilter;
                  return matchSearch && matchStatus;
                })
                .sort((a, b) => {
                  const aVal = a[sortConfig.key] || '';
                  const bVal = b[sortConfig.key] || '';
                  if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
                  if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
                  return 0;
                })
                .map(doc => {
                  const worker = workers.find(w => w.id === doc.workerId);
                  return (
                    <tr key={doc.id} className="bg-slate-50/30 hover:bg-white hover:shadow-md transition-all duration-300">
                      <td className="px-4 py-4 rounded-l-2xl border-y border-l border-slate-100">
                        <span className="text-xs font-bold text-slate-500 font-mono">
                          {formatDocDate(doc.dataEmissao, true)}
                        </span>
                      </td>
                      <td className="px-4 py-4 border-y border-slate-100">
                        <p className="text-sm font-black text-slate-800">{worker?.name || 'Desconhecido'}</p>
                      </td>
                      <td className="px-4 py-4 border-y border-slate-100">
                        <p className="text-xs font-bold text-slate-500">{doc.nomeFicheiro || doc.tipo}</p>
                      </td>
                      <td className="px-4 py-4 border-y border-slate-100">
                        <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-tighter ${doc.status === 'Assinado' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                          {doc.status || 'Pendente'}
                        </span>
                      </td>
                      <td className="px-4 py-4 rounded-r-2xl border-y border-r border-slate-100 text-right">
                        <div className="flex justify-end items-center gap-2">
                          <a
                            href={doc.url}
                            target="_blank"
                            rel="noreferrer"
                            className="p-2 bg-white text-indigo-600 rounded-xl border border-indigo-100 hover:bg-indigo-600 hover:text-white transition-all shadow-sm"
                            title="Visualizar Original"
                          >
                            <Eye size={16} />
                          </a>
                          {doc.pdfAssinadoUrl && (
                            <a
                              href={doc.pdfAssinadoUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="p-2 bg-white text-emerald-600 rounded-xl border border-emerald-100 hover:bg-emerald-600 hover:text-white transition-all shadow-sm"
                              title="Visualizar Assinado"
                            >
                              <CheckCircle size={16} />
                            </a>
                          )}
                          <button
                            onClick={() => handleDeleteDoc(doc)}
                            className="p-2 bg-white text-rose-500 rounded-xl border border-rose-100 hover:bg-rose-500 hover:text-white transition-all shadow-sm"
                            title="Eliminar"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default DocumentsAdmin;
