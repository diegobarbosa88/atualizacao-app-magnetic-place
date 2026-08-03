import React, { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  FileText, Coins, ShieldCheck, Heart, GraduationCap, Clock,
  FolderOpen, Eye, CheckCircle, AlertTriangle, ChevronDown, ChevronUp,
  Folder, User, ArrowLeft, Search, X, FileSignature, Download, Trash2,
} from 'lucide-react';
import { CATEGORIAS_RH_ACT, getValidadeStatus, getDiasRestantes } from '../../../constants/rhCategories';
import { formatDocDate } from '../../../utils/dateUtils';

const CATEGORIA_CONFIG = {
  "Contratual":                    { icon: FileText,       color: 'indigo' },
  "Remuneração":                   { icon: Coins,          color: 'emerald' },
  "Identificação e Legalização":   { icon: ShieldCheck,    color: 'sky' },
  "Saúde e Segurança no Trabalho": { icon: Heart,          color: 'rose' },
  "Segurança Social e Fiscal":     { icon: ShieldCheck,    color: 'violet' },
  "Formação Profissional":         { icon: GraduationCap,  color: 'amber' },
  "Tempo de Trabalho":             { icon: Clock,          color: 'orange' },
  "Outros":                        { icon: FolderOpen,     color: 'slate' },
};

const COLOR_MAP = {
  indigo:  { bg: 'bg-indigo-50',  text: 'text-indigo-600',  border: 'border-indigo-100' },
  emerald: { bg: 'bg-emerald-50', text: 'text-emerald-600', border: 'border-emerald-100' },
  sky:     { bg: 'bg-sky-50',     text: 'text-sky-600',     border: 'border-sky-100' },
  rose:    { bg: 'bg-rose-50',    text: 'text-rose-600',    border: 'border-rose-100' },
  violet:  { bg: 'bg-violet-50',  text: 'text-violet-600',  border: 'border-violet-100' },
  amber:   { bg: 'bg-amber-50',   text: 'text-amber-600',   border: 'border-amber-100' },
  orange:  { bg: 'bg-orange-50',  text: 'text-orange-600',  border: 'border-orange-100' },
  slate:   { bg: 'bg-slate-100',  text: 'text-slate-500',   border: 'border-slate-200' },
};

function ValidadeChip({ dataValidade }) {
  const status = getValidadeStatus(dataValidade);
  if (!status) return null;
  const dias = getDiasRestantes(dataValidade);
  const map = {
    expirado: { cls: 'bg-red-100 text-red-700',      icon: <AlertTriangle size={8} />, label: 'Expirado' },
    urgente:  { cls: 'bg-amber-100 text-amber-700',  icon: <Clock size={8} />,         label: `${dias}d` },
    aviso:    { cls: 'bg-yellow-100 text-yellow-700', icon: <Clock size={8} />,         label: `${dias}d` },
    ok:       { cls: 'bg-emerald-100 text-emerald-700', icon: <CheckCircle size={8} />, label: 'Válido' },
  };
  const { cls, icon, label } = map[status];
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-black ${cls}`}>
      {icon} {label}
    </span>
  );
}

function StateBadgeSmall({ state }) {
  if (state === 'signed') return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-black bg-emerald-100 text-emerald-700">
      <CheckCircle size={8} /> Assinado
    </span>
  );
  if (state === 'awaiting_admin') return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-black bg-indigo-100 text-indigo-700">
      <FileSignature size={8} /> Aguarda aprovação
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-black bg-amber-100 text-amber-700">
      <Clock size={8} /> Pendente
    </span>
  );
}

function DocumentViewerModal({ doc, onClose }) {
  if (!doc) return null;
  const url = doc.previewUrl;
  const isImage = url && /\.(png|jpe?g|gif|webp)(\?|$)/i.test(url);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="relative bg-white rounded-2xl shadow-2xl flex flex-col w-full max-w-4xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-slate-100 flex-shrink-0">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-black text-slate-800 truncate">{doc.title}</p>
            <p className="text-[10px] text-slate-400 mt-0.5">
              {[doc.workerName, doc.categoria, doc.tipo].filter(Boolean).join(' · ')}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {url && (
              <a
                href={url}
                download
                className="p-2 rounded-xl bg-slate-100 hover:bg-indigo-50 text-slate-500 hover:text-indigo-600 transition-colors"
                title="Descarregar"
              >
                <Download size={14} />
              </a>
            )}
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-100 hover:bg-red-50 text-slate-500 hover:text-red-600 transition-colors"
            >
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Corpo */}
        <div className="flex-1 overflow-auto bg-slate-50">
          {!url ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3 opacity-40">
              <FileText size={40} />
              <p className="text-sm font-black uppercase tracking-widest">Pré-visualização não disponível</p>
              <p className="text-xs text-slate-500">Este documento ainda não tem ficheiro associado</p>
            </div>
          ) : isImage ? (
            <div className="flex items-center justify-center p-6">
              <img src={url} alt={doc.title} className="max-w-full max-h-[70vh] object-contain rounded-xl shadow" />
            </div>
          ) : (
            <iframe
              src={url}
              className="w-full min-h-[60vh] h-full border-0"
              title={doc.title}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function SubPastaCard({ categoria, docs, onOpenDoc, onDelete }) {
  const [expanded, setExpanded] = useState(docs.length > 0 && docs.length <= 5);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const config = CATEGORIA_CONFIG[categoria] || CATEGORIA_CONFIG["Outros"];
  const colors = COLOR_MAP[config.color];
  const Icon = config.icon;
  if (docs.length === 0) return null;

  const temExpirado = docs.some(d => getValidadeStatus(d.data_validade) === 'expirado');
  const temUrgente  = docs.some(d => getValidadeStatus(d.data_validade) === 'urgente');
  const alertBorder = temExpirado ? 'border-red-300' : temUrgente ? 'border-amber-300' : 'border-slate-200';

  return (
    <div className={`border rounded-xl overflow-hidden ${alertBorder}`}>
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left hover:bg-slate-50 transition-colors"
      >
        <div className={`p-1.5 rounded-lg ${colors.bg} ${colors.text} flex-shrink-0`}>
          <Icon size={14} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-black text-slate-700 truncate">{categoria}</p>
          <p className={`text-[10px] font-bold ${colors.text}`}>{docs.length} doc{docs.length !== 1 ? 's' : ''}</p>
        </div>
        {temExpirado && <AlertTriangle size={12} className="text-red-500 flex-shrink-0" />}
        {!temExpirado && temUrgente && <AlertTriangle size={12} className="text-amber-500 flex-shrink-0" />}
        {expanded ? <ChevronUp size={12} className="text-slate-400" /> : <ChevronDown size={12} className="text-slate-400" />}
      </button>

      {expanded && (
        <div className="border-t border-slate-100 divide-y divide-slate-100 bg-white">
          {docs.map(d => (
            <div key={d.id} className="px-3 py-2.5 hover:bg-slate-50 transition-colors">
              {confirmDeleteId === d.id ? (
                /* Confirmação inline */
                <div className="flex items-center justify-between gap-2 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">
                  <p className="text-[10px] font-black text-rose-700 flex-1">Apagar permanentemente?</p>
                  <div className="flex gap-1.5 flex-shrink-0">
                    <button
                      onClick={() => { onDelete(d); setConfirmDeleteId(null); }}
                      className="px-2.5 py-1 bg-rose-600 text-white text-[10px] font-black rounded-lg hover:bg-rose-700 transition-colors"
                    >Sim</button>
                    <button
                      onClick={() => setConfirmDeleteId(null)}
                      className="px-2.5 py-1 bg-white border border-slate-200 text-slate-600 text-[10px] font-black rounded-lg hover:bg-slate-50 transition-colors"
                    >Não</button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-2.5">
                  <FileText size={12} className="text-slate-300 flex-shrink-0 mt-1" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-slate-800 truncate leading-tight">{d.title || d.tipo}</p>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0 mt-0.5">
                      {d.tipo && d.tipo !== d.title && (
                        <span className="text-[10px] text-slate-400">{d.tipo}</span>
                      )}
                      {d.createdAt && (
                        <span className="text-[10px] text-slate-400">
                          {formatDocDate(d.createdAt.toISOString(), true)}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1 mt-1">
                      <StateBadgeSmall state={d.state} />
                      <ValidadeChip dataValidade={d.data_validade} />
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0 mt-0.5">
                    <button
                      onClick={() => onOpenDoc(d)}
                      className="p-1.5 rounded-lg text-indigo-500 hover:text-indigo-700 hover:bg-indigo-50 transition-colors"
                      title="Pré-visualizar"
                    >
                      <Eye size={13} />
                    </button>
                    <button
                      onClick={() => setConfirmDeleteId(d.id)}
                      className="p-1.5 rounded-lg text-slate-300 hover:text-rose-500 hover:bg-rose-50 transition-colors"
                      title="Apagar"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function WorkerPastaView({ worker, docs, onBack, onOpenDoc, onDelete }) {
  const byCategoria = useMemo(() => {
    const map = {};
    CATEGORIAS_RH_ACT.forEach(c => { map[c] = []; });
    docs.forEach(d => {
      const cat = d.categoria || 'Outros';
      if (!map[cat]) map[cat] = [];
      map[cat].push(d);
    });
    return map;
  }, [docs]);

  const expirados = docs.filter(d => ['expirado', 'urgente'].includes(getValidadeStatus(d.data_validade))).length;
  const categoriasComDocs = CATEGORIAS_RH_ACT.filter(c => (byCategoria[c] || []).length > 0);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors">
          <ArrowLeft size={16} />
        </button>
        <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
          <User size={18} />
        </div>
        <div className="flex-1">
          <h4 className="font-black text-slate-800 text-base">{worker.workerName}</h4>
          <p className="text-[10px] text-slate-400 font-bold">{docs.length} documento{docs.length !== 1 ? 's' : ''}</p>
        </div>
        {expirados > 0 && (
          <span className="flex items-center gap-1 text-xs font-black text-red-600 bg-red-50 border border-red-200 px-2.5 py-1 rounded-xl">
            <AlertTriangle size={12} /> {expirados} a expirar
          </span>
        )}
      </div>

      {/* Sub-pastas por categoria */}
      {categoriasComDocs.length === 0 ? (
        <div className="py-12 text-center opacity-30">
          <FolderOpen size={32} className="mx-auto mb-2" />
          <p className="text-xs font-black uppercase tracking-widest">Sem documentos</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {CATEGORIAS_RH_ACT.map(cat => (
            <SubPastaCard key={cat} categoria={cat} docs={byCategoria[cat] || []} onOpenDoc={onOpenDoc} onDelete={onDelete} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function WorkerDocsFolderView({ docs, onPreview, onDeleteManual, onDeleteGenerated }) {
  const [searchParams] = useSearchParams();
  const [selectedWorker, setSelectedWorker] = useState(() => searchParams.get('worker') || null);
  const [search, setSearch] = useState('');
  const [previewDoc, setPreviewDoc] = useState(null);

  const handleDelete = (doc) => {
    if (doc.source === 'manual') {
      onDeleteManual?.(doc.raw);
    } else {
      onDeleteGenerated?.(doc.raw.id);
    }
  };

  const handleOpenDoc = (doc) => {
    const url = doc.signedPdfUrl || doc.viewUrl || null;
    if (url) {
      setPreviewDoc({ ...doc, previewUrl: url });
    } else if (onPreview) {
      onPreview(doc.raw);
    } else {
      setPreviewDoc({ ...doc, previewUrl: null });
    }
  };

  // Agrupar docs por trabalhador
  const byWorker = useMemo(() => {
    const map = {};
    docs.forEach(d => {
      if (!map[d.workerId]) {
        map[d.workerId] = { workerId: d.workerId, workerName: d.workerName, docs: [] };
      }
      map[d.workerId].docs.push(d);
    });
    return Object.values(map).sort((a, b) => a.workerName.localeCompare(b.workerName, 'pt'));
  }, [docs]);

  const workersFiltrados = search.trim()
    ? byWorker.filter(w => w.workerName.toLowerCase().includes(search.toLowerCase()))
    : byWorker;

  // Vista do trabalhador selecionado
  if (selectedWorker) {
    const workerData = byWorker.find(w => w.workerId === selectedWorker);
    if (workerData) {
      return (
        <>
          <DocumentViewerModal doc={previewDoc} onClose={() => setPreviewDoc(null)} />
          <WorkerPastaView
            worker={workerData}
            docs={workerData.docs}
            onBack={() => setSelectedWorker(null)}
            onOpenDoc={handleOpenDoc}
            onDelete={handleDelete}
          />
        </>
      );
    }
  }

  // Vista de lista de trabalhadores
  return (
    <div className="space-y-4">
      <DocumentViewerModal doc={previewDoc} onClose={() => setPreviewDoc(null)} />

      {/* Pesquisa de trabalhador */}
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        <input
          type="text"
          placeholder="Pesquisar colaborador..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-9 pr-3 py-2.5 text-xs font-bold border border-slate-200 rounded-xl bg-slate-50 outline-none focus:ring-2 focus:ring-indigo-300 transition-all"
        />
      </div>

      {workersFiltrados.length === 0 ? (
        <div className="py-12 text-center opacity-30">
          <Folder size={32} className="mx-auto mb-2" />
          <p className="text-xs font-black uppercase tracking-widest">Nenhum colaborador encontrado</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {workersFiltrados.map(w => {
            const expirados = w.docs.filter(d => getValidadeStatus(d.data_validade) === 'expirado').length;
            const urgentes  = w.docs.filter(d => getValidadeStatus(d.data_validade) === 'urgente').length;
            const categorias = [...new Set(w.docs.map(d => d.categoria).filter(Boolean))];
            const alertBorder = expirados > 0 ? 'border-red-200 hover:border-red-400'
              : urgentes > 0 ? 'border-amber-200 hover:border-amber-400'
              : 'border-slate-200 hover:border-indigo-300';

            return (
              <button
                key={w.workerId}
                onClick={() => setSelectedWorker(w.workerId)}
                className={`text-left border-2 rounded-2xl p-4 hover:shadow-md transition-all duration-200 bg-white ${alertBorder}`}
              >
                <div className="flex items-start gap-3 mb-3">
                  <div className="p-2.5 rounded-xl bg-indigo-50 text-indigo-600 flex-shrink-0">
                    <User size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-black text-slate-800 truncate">{w.workerName}</p>
                    <p className="text-[10px] text-slate-400 font-bold mt-0.5">
                      {w.docs.length} doc{w.docs.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                  {(expirados > 0 || urgentes > 0) && (
                    <AlertTriangle size={14} className={expirados > 0 ? 'text-red-500' : 'text-amber-500'} />
                  )}
                </div>

                {/* Sub-pastas presentes */}
                {categorias.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {categorias.slice(0, 4).map(cat => {
                      const conf = CATEGORIA_CONFIG[cat] || CATEGORIA_CONFIG["Outros"];
                      const colors = COLOR_MAP[conf.color];
                      return (
                        <span key={cat} className={`px-1.5 py-0.5 rounded text-[9px] font-black ${colors.bg} ${colors.text}`}>
                          {cat.split(' ')[0]}
                        </span>
                      );
                    })}
                    {categorias.length > 4 && (
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-slate-100 text-slate-500">
                        +{categorias.length - 4}
                      </span>
                    )}
                  </div>
                )}

                {/* Alertas de validade */}
                {(expirados > 0 || urgentes > 0) && (
                  <div className="mt-2 flex items-center gap-1">
                    {expirados > 0 && (
                      <span className="text-[9px] font-black text-red-600 bg-red-50 px-1.5 py-0.5 rounded">
                        {expirados} expirado{expirados !== 1 ? 's' : ''}
                      </span>
                    )}
                    {urgentes > 0 && (
                      <span className="text-[9px] font-black text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">
                        {urgentes} urgente{urgentes !== 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
