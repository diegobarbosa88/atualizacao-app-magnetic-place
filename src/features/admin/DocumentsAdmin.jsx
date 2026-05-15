import React, { useState, useMemo } from 'react';
import {
  FileText, Eye, Trash2, Search, Upload, Loader2, Plus, X,
  Clock, FileSignature, CheckCircle, ChevronUp, ChevronDown,
} from 'lucide-react';
import { formatDocDate } from '../../utils/dateUtils';
import { useApp } from '../../context/AppContext';
import { useDocumentTemplates } from '../../hooks/useDocumentTemplates';
import { isSigned, isAwaitingAdmin } from '../../constants/documentStatus';
import {
  downloadTemplateBytes,
  renderDocx,
  buildRenderData,
} from '../../utils/docxTemplateService';
import DocxPreviewModal from '../../components/common/DocxPreviewModal';
import DocumentTemplatesAdmin from '../../components/admin/DocumentTemplatesAdmin';
import { parseDeviceLabel, fetchPublicIp } from '../../utils/deviceUtils';

const TIPOS_MANUAIS = ['Recibo de Vencimento', 'Mapa de Deslocamento', 'Contrato de Trabalho', 'Outro'];

const SortableTh = ({ label, columnKey, sortKey, sortDir, onSort }) => {
  const active = sortKey === columnKey;
  return (
    <th
      onClick={() => onSort(columnKey)}
      className="px-4 py-2 text-[10px] font-black uppercase tracking-widest cursor-pointer select-none hover:text-slate-600 transition-colors"
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {active && (sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
      </span>
    </th>
  );
};

const DocumentsAdmin = ({ workers = [], documents = [], setDocuments, systemSettings }) => {
  const { supabase: clientSupabase, companySignature, stampStyle } = useApp();
  const [activeSubTab, setActiveSubTab] = useState('documentos');

  const {
    generatedDocs,
    loadingDocs,
    saving,
    handleApproveDocument,
    handleDeleteDoc: handleDeleteGenerated,
  } = useDocumentTemplates(clientSupabase);

  const workerById = useMemo(() => {
    const m = {};
    workers.forEach(w => { m[w.id] = w; });
    return m;
  }, [workers]);

  // ─── Vista unificada ──────────────────────────────────────────────────────
  const [searchTerm, setSearchTerm] = useState('');
  const [stateFilter, setStateFilter] = useState('all');     // all | pending | awaiting_admin | signed
  const [sourceFilter, setSourceFilter] = useState('all');   // all | manual | template
  const [approvingId, setApprovingId] = useState(null);
  const [preview, setPreview] = useState(null);
  const [sortKey, setSortKey] = useState('createdAt');
  const [sortDir, setSortDir] = useState('desc'); // 'asc' | 'desc'

  const handleSort = (key) => {
    if (sortKey === key) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(key === 'createdAt' ? 'desc' : 'asc');
    }
  };

  // Modal de upload manual
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selWorker, setSelWorker] = useState('');
  const [selTipo, setSelTipo] = useState(TIPOS_MANUAIS[0]);
  const [selFile, setSelFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  const unifiedDocs = useMemo(() => {
    const manuais = (documents || []).map(d => {
      const state = d.status === 'Assinado' ? 'signed' : 'pending';
      return {
        id: `manual:${d.id}`,
        source: 'manual',
        workerId: d.workerId,
        workerName: workerById[d.workerId]?.name || 'Desconhecido',
        title: d.nomeFicheiro || d.tipo,
        subtitle: d.tipo,
        state,
        createdAt: d.dataEmissao ? new Date(d.dataEmissao) : null,
        signedAtWorker: d.dataAssinatura ? new Date(d.dataAssinatura) : null,
        signedAtAdmin: null,
        viewUrl: d.url,
        signedPdfUrl: d.pdfAssinadoUrl,
        raw: d,
      };
    });
    const gerados = (generatedDocs || []).map(d => {
      const state = isSigned(d.status) ? 'signed' : isAwaitingAdmin(d.status) ? 'awaiting_admin' : 'pending';
      return {
        id: `template:${d.id}`,
        source: 'template',
        workerId: d.worker_id,
        workerName: workerById[d.worker_id]?.name || 'Desconhecido',
        title: d.title,
        subtitle: 'Gerado por template',
        state,
        createdAt: d.created_at ? new Date(d.created_at) : null,
        signedAt: d.admin_signed_at ? new Date(d.admin_signed_at) : (d.signed_at ? new Date(d.signed_at) : null),
        signedAtWorker: d.signed_at ? new Date(d.signed_at) : null,
        signedAtAdmin: d.admin_signed_at ? new Date(d.admin_signed_at) : null,
        signedPdfUrl: d.signed_pdf_url,
        raw: d,
      };
    });
    return [...manuais, ...gerados];
  }, [documents, generatedDocs, workerById]);

  const filteredDocs = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    const list = unifiedDocs.filter(d => {
      if (stateFilter !== 'all' && d.state !== stateFilter) return false;
      if (sourceFilter !== 'all' && d.source !== sourceFilter) return false;
      if (q) {
        const t = (d.title || '').toLowerCase();
        const w = (d.workerName || '').toLowerCase();
        if (!t.includes(q) && !w.includes(q)) return false;
      }
      return true;
    });

    const dir = sortDir === 'asc' ? 1 : -1;
    const getVal = (d) => {
      switch (sortKey) {
        case 'createdAt': return d.createdAt ? d.createdAt.getTime() : null;
        case 'workerName': return d.workerName || null;
        case 'title': return d.title || null;
        case 'source': return d.source || null;
        case 'state': return d.state || null;
        default: return null;
      }
    };
    return [...list].sort((a, b) => {
      const va = getVal(a);
      const vb = getVal(b);
      if (va == null && vb == null) return 0;
      if (va == null) return 1;  // nulls always last
      if (vb == null) return -1;
      if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * dir;
      return String(va).localeCompare(String(vb), 'pt', { sensitivity: 'base' }) * dir;
    });
  }, [unifiedDocs, stateFilter, sourceFilter, searchTerm, sortKey, sortDir]);

  const counts = useMemo(() => {
    const c = { all: unifiedDocs.length, pending: 0, awaiting_admin: 0, signed: 0 };
    unifiedDocs.forEach(d => { c[d.state] = (c[d.state] || 0) + 1; });
    return c;
  }, [unifiedDocs]);

  // ─── Acções ───────────────────────────────────────────────────────────────
  const onUpload = async () => {
    if (!selWorker || !selFile) return alert('Selecione tudo.');
    setUploading(true);

    if (!clientSupabase) {
      setUploading(false);
      return alert('A conexão com a base de dados falhou. Por favor, atualize a página (F5) e tente novamente.');
    }

    const docId = `doc_${Date.now()}`;
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
        dataEmissao: new Date().toISOString(),
      };

      const { file: _unused, ...docToInsert } = newDoc;

      const { error: dbError } = await clientSupabase
        .from('documents')
        .insert([docToInsert]);

      if (dbError) throw dbError;

      if (setDocuments) {
        setDocuments(prev => [newDoc, ...prev]);
      }
      setSelFile(null);
      setSelWorker('');
      setShowUploadModal(false);
      alert('Documento enviado com sucesso!');
    } catch (err) {
      console.error('Erro no upload:', err);
      alert(`Erro: ${err.message}`);
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteManual = async (raw) => {
    if (!clientSupabase) return alert('Conexão indisponível. Actualize a página.');
    if (!window.confirm('Apagar documento permanentemente?')) return;

    try {
      const match = raw.url?.match(/\/storage\/v1\/object\/public\/documentos\/(.+?)(\?|$)/);
      const pathInStorage = match ? decodeURIComponent(match[1]) : null;
      if (pathInStorage) {
        await clientSupabase.storage.from('documentos').remove([pathInStorage]);
      }
      const { error } = await clientSupabase.from('documents').delete().eq('id', raw.id);
      if (error) throw error;

      if (setDocuments) {
        setDocuments(prev => prev.filter(d => d.id !== raw.id));
      }
    } catch (err) {
      alert(`Erro ao apagar: ${err.message}`);
    }
  };

  const onApprove = async (raw) => {
    if (!companySignature?.signatureDataUrl) {
      alert('Configura primeiro a assinatura da empresa em Definições.');
      return;
    }
    setApprovingId(raw.id);
    try {
      const adminDevice = parseDeviceLabel();
      const adminIp = await fetchPublicIp();
      await handleApproveDocument(raw, {
        companyName: systemSettings?.companyName,
        companySignature,
        adminIp,
        adminDevice,
        stampStyle,
      });
    } catch (err) {
      console.error('Erro a aprovar documento:', err);
      alert('Erro: ' + (err.message || err));
    } finally {
      setApprovingId(null);
    }
  };

  const openGeneratedPreview = async (raw) => {
    const workerName = workerById[raw.worker_id]?.name || '';
    const title = `${raw.title}${workerName ? ` — ${workerName}` : ''}`;
    setPreview({ title, loading: true, blob: null, error: '' });
    try {
      if (!raw.template_id) throw new Error('Documento sem template associado.');
      const { data: tmpl, error: tErr } = await clientSupabase
        .from('document_templates').select('*').eq('id', raw.template_id).single();
      if (tErr) throw tErr;
      if (!tmpl?.template_docx_path) throw new Error('Template sem ficheiro .docx');

      const { data: worker, error: wErr } = await clientSupabase
        .from('workers').select('*').eq('id', raw.worker_id).single();
      if (wErr) throw wErr;

      const buffer = await downloadTemplateBytes(clientSupabase, tmpl.template_docx_path);
      const renderData = buildRenderData(worker || {}, systemSettings || {});
      const filledBlob = renderDocx(buffer, renderData);
      setPreview({ title, loading: false, blob: filledBlob, error: '' });
    } catch (err) {
      console.error('Falha a abrir preview:', err);
      setPreview({ title, loading: false, blob: null, error: err.message || 'Erro a carregar documento.' });
    }
  };

  // ─── Render helpers ───────────────────────────────────────────────────────
  const renderStateBadge = (state) => {
    if (state === 'signed') {
      return (
        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-tighter bg-emerald-100 text-emerald-700">
          <CheckCircle size={11} /> Assinado
        </span>
      );
    }
    if (state === 'awaiting_admin') {
      return (
        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-tighter bg-indigo-100 text-indigo-700">
          <FileSignature size={11} /> Aguarda Aprovação
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-tighter bg-amber-100 text-amber-700">
        <Clock size={11} /> Pendente
      </span>
    );
  };

  const renderSourceChip = (source) => (
    <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider border ${
      source === 'template'
        ? 'bg-purple-50 text-purple-700 border-purple-100'
        : 'bg-slate-50 text-slate-600 border-slate-200'
    }`}>
      {source === 'template' ? 'Template' : 'Manual'}
    </span>
  );

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-slate-100 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 border-b border-slate-50 pb-6">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-50 p-2 rounded-xl text-indigo-600">
            <FileText size={20} />
          </div>
          <h3 className="font-black text-xl text-slate-800 uppercase tracking-tight">Centro de Documentos</h3>
        </div>

        <div className="flex bg-slate-50 p-1 rounded-2xl border border-slate-100 self-start md:self-auto">
          <button
            onClick={() => setActiveSubTab('documentos')}
            className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeSubTab === 'documentos' ? 'bg-white text-indigo-600 shadow-sm scale-105' : 'text-slate-400 hover:text-slate-600'}`}
          >
            Documentos
          </button>
          <button
            onClick={() => setActiveSubTab('templates')}
            className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeSubTab === 'templates' ? 'bg-white text-indigo-600 shadow-sm scale-105' : 'text-slate-400 hover:text-slate-600'}`}
          >
            Templates
          </button>
        </div>
      </div>

      {activeSubTab === 'templates' ? (
        <DocumentTemplatesAdmin workers={workers} systemSettings={systemSettings} supabase={supabase} />
      ) : (
        <>
          {/* Pills de contagem por estado */}
          <div className="flex flex-wrap gap-2 mb-5">
            {[
              { key: 'all', label: 'Todos', color: 'slate' },
              { key: 'pending', label: 'Pendentes', color: 'amber' },
              { key: 'awaiting_admin', label: 'Aguardam Aprovação', color: 'indigo' },
              { key: 'signed', label: 'Assinados', color: 'emerald' },
            ].map(({ key, label, color }) => {
              const active = stateFilter === key;
              const palette = {
                slate: active ? 'bg-slate-900 text-white border-slate-900' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100',
                amber: active ? 'bg-amber-500 text-white border-amber-500' : 'bg-amber-50 text-amber-700 border-amber-100 hover:bg-amber-100',
                indigo: active ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-indigo-50 text-indigo-700 border-indigo-100 hover:bg-indigo-100',
                emerald: active ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-emerald-50 text-emerald-700 border-emerald-100 hover:bg-emerald-100',
              }[color];
              return (
                <button
                  key={key}
                  onClick={() => setStateFilter(key)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${palette}`}
                >
                  {label}
                  <span className={`px-1.5 py-0.5 rounded-md text-[9px] ${active ? 'bg-white/20' : 'bg-white/60'}`}>{counts[key] ?? 0}</span>
                </button>
              );
            })}
          </div>

          {/* Toolbar */}
          <div className="flex flex-col md:flex-row gap-3 mb-6 items-stretch md:items-center">
            <div className="relative flex-1">
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
              className="md:w-44 p-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-slate-700 outline-none"
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
            >
              <option value="all">Todas Origens</option>
              <option value="manual">Manual</option>
              <option value="template">Template</option>
            </select>
            <button
              onClick={() => setShowUploadModal(true)}
              className="px-5 py-3 bg-indigo-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-2 hover:bg-slate-900 transition-all shadow-lg shadow-indigo-200 active:scale-[0.98] whitespace-nowrap"
            >
              <Plus size={16} /> Upload Manual
            </button>
          </div>

          {/* Lista unificada */}
          <div className="overflow-x-auto -mx-2">
            <table className="w-full text-left border-separate border-spacing-y-2">
              <thead>
                <tr className="text-slate-400">
                  <SortableTh label="Data" columnKey="createdAt" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                  <SortableTh label="Colaborador" columnKey="workerName" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                  <SortableTh label="Documento" columnKey="title" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                  <SortableTh label="Origem" columnKey="source" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                  <SortableTh label="Estado" columnKey="state" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                  <th className="px-4 py-2 text-[10px] font-black uppercase tracking-widest text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {loadingDocs && filteredDocs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-16 text-center">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto text-slate-300" />
                    </td>
                  </tr>
                ) : filteredDocs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-20 text-center">
                      <div className="flex flex-col items-center gap-2 opacity-30">
                        <FileText size={40} />
                        <p className="text-xs font-black uppercase tracking-widest">Sem documentos</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredDocs.map(d => {
                    const isApproving = approvingId === d.raw.id;
                    return (
                      <tr key={d.id} className="bg-slate-50/30 hover:bg-white hover:shadow-md transition-all duration-300">
                        <td className="px-4 py-4 rounded-l-2xl border-y border-l border-slate-100">
                          <span className="text-xs font-bold text-slate-500 font-mono">
                            {d.createdAt ? formatDocDate(d.createdAt.toISOString(), true) : '—'}
                          </span>
                        </td>
                        <td className="px-4 py-4 border-y border-slate-100">
                          <p className="text-sm font-black text-slate-800">{d.workerName}</p>
                        </td>
                        <td className="px-4 py-4 border-y border-slate-100">
                          <p className="text-xs font-bold text-slate-700 truncate max-w-[260px]" title={d.title}>{d.title}</p>
                          {d.subtitle && <p className="text-[10px] text-slate-400 mt-0.5 truncate max-w-[260px]">{d.subtitle}</p>}
                          {(d.signedAtWorker || d.signedAtAdmin) && (
                            <div className="mt-1 flex flex-col gap-0.5">
                              {d.signedAtWorker && (
                                <p className="text-[10px] text-emerald-600 font-bold">
                                  Trabalhador: {formatDocDate(d.signedAtWorker.toISOString(), true)}
                                </p>
                              )}
                              {d.signedAtAdmin && (
                                <p className="text-[10px] text-indigo-600 font-bold">
                                  Magnetic Place: {formatDocDate(d.signedAtAdmin.toISOString(), true)}
                                </p>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-4 border-y border-slate-100">{renderSourceChip(d.source)}</td>
                        <td className="px-4 py-4 border-y border-slate-100">{renderStateBadge(d.state)}</td>
                        <td className="px-4 py-4 rounded-r-2xl border-y border-r border-slate-100 text-right">
                          <div className="flex justify-end items-center gap-2 flex-wrap">
                            {d.source === 'manual' ? (
                              <>
                                {d.viewUrl && (
                                  <a
                                    href={d.viewUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="p-2 bg-white text-indigo-600 rounded-xl border border-indigo-100 hover:bg-indigo-600 hover:text-white transition-all shadow-sm"
                                    title="Visualizar original"
                                  >
                                    <Eye size={16} />
                                  </a>
                                )}
                                {d.signedPdfUrl && (
                                  <a
                                    href={d.signedPdfUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="p-2 bg-white text-emerald-600 rounded-xl border border-emerald-100 hover:bg-emerald-600 hover:text-white transition-all shadow-sm"
                                    title="Visualizar assinado"
                                  >
                                    <CheckCircle size={16} />
                                  </a>
                                )}
                                <button
                                  onClick={() => handleDeleteManual(d.raw)}
                                  className="p-2 bg-white text-rose-500 rounded-xl border border-rose-100 hover:bg-rose-500 hover:text-white transition-all shadow-sm"
                                  title="Eliminar"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  onClick={() => openGeneratedPreview(d.raw)}
                                  className="p-2 bg-white text-indigo-600 rounded-xl border border-indigo-100 hover:bg-indigo-600 hover:text-white transition-all shadow-sm"
                                  title="Pré-visualizar com dados do trabalhador"
                                >
                                  <Eye size={16} />
                                </button>
                                {d.signedPdfUrl && (
                                  <a
                                    href={d.signedPdfUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="p-2 bg-white text-emerald-600 rounded-xl border border-emerald-100 hover:bg-emerald-600 hover:text-white transition-all shadow-sm"
                                    title="Visualizar assinado"
                                  >
                                    <CheckCircle size={16} />
                                  </a>
                                )}
                                {d.state === 'awaiting_admin' && (
                                  <button
                                    onClick={() => onApprove(d.raw)}
                                    disabled={isApproving || saving}
                                    className="p-2 bg-indigo-600 text-white rounded-xl border border-indigo-600 hover:bg-indigo-700 transition-all shadow-sm disabled:opacity-50"
                                    title="Aplicar carimbo da empresa e finalizar"
                                  >
                                    {isApproving ? <Loader2 size={16} className="animate-spin" /> : <FileSignature size={16} />}
                                  </button>
                                )}
                                <button
                                  onClick={() => handleDeleteGenerated(d.raw.id)}
                                  className="p-2 bg-white text-rose-500 rounded-xl border border-rose-100 hover:bg-rose-500 hover:text-white transition-all shadow-sm"
                                  title="Eliminar"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Modal Upload Manual */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[200] flex items-start justify-center p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-xl rounded-[2rem] p-6 shadow-2xl my-8 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-5">
              <div className="flex items-center gap-3">
                <div className="bg-indigo-50 p-2 rounded-xl text-indigo-600"><Upload size={18} /></div>
                <h2 className="text-lg font-black text-slate-800 uppercase tracking-tight">Upload Manual</h2>
              </div>
              <button
                onClick={() => !uploading && setShowUploadModal(false)}
                className="p-2 text-slate-400 hover:text-slate-600 disabled:opacity-50"
                disabled={uploading}
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Colaborador</label>
                <select
                  className="w-full p-3 rounded-xl border border-slate-200 bg-white text-sm focus:ring-2 focus:ring-indigo-500 outline-none font-medium"
                  value={selWorker}
                  onChange={(e) => setSelWorker(e.target.value)}
                  disabled={uploading}
                >
                  <option value="">Selecionar...</option>
                  {workers.map(w => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Tipo</label>
                <select
                  className="w-full p-3 rounded-xl border border-slate-200 bg-white text-sm focus:ring-2 focus:ring-indigo-500 outline-none font-medium"
                  value={selTipo}
                  onChange={(e) => setSelTipo(e.target.value)}
                  disabled={uploading}
                >
                  {TIPOS_MANUAIS.map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Ficheiro (PDF)</label>
                <input
                  type="file"
                  accept=".pdf"
                  className="w-full p-2.5 rounded-xl border border-slate-200 bg-white text-xs cursor-pointer"
                  onChange={(e) => setSelFile(e.target.files?.[0])}
                  disabled={uploading}
                />
                {selFile && (
                  <p className="text-[10px] text-slate-500 mt-1 ml-1 truncate">{selFile.name}</p>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6 pt-5 border-t border-slate-100">
              <button
                onClick={() => setShowUploadModal(false)}
                disabled={uploading}
                className="px-5 py-2.5 text-xs font-black uppercase tracking-widest text-slate-600 hover:bg-slate-100 rounded-xl transition-all disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={onUpload}
                disabled={uploading || !selWorker || !selFile}
                className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl font-black uppercase text-xs tracking-widest flex items-center gap-2 disabled:opacity-50 transition-all hover:bg-indigo-700 shadow-lg shadow-indigo-200"
              >
                {uploading ? <Loader2 className="animate-spin" size={16} /> : <Upload size={16} />}
                {uploading ? 'A Enviar...' : 'Submeter'}
              </button>
            </div>
          </div>
        </div>
      )}

      {preview && (
        <DocxPreviewModal
          title={preview.title}
          blob={preview.blob}
          loading={preview.loading}
          error={preview.error}
          onClose={() => setPreview(null)}
        />
      )}
    </div>
  );
};

export default DocumentsAdmin;
