import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useApp } from '../../../context/AppContext';
import { renderPdfFirstPage, renderPdfToSrcDoc } from '../../../components/common/workerDocuments/useDocumentPreview';
import { FT, SCALE, FONT_TITLE } from '../../../styles/designTokens';
import {
  FileText, Clock,
  FolderOpen, Eye, EyeOff, UserCheck, CheckCircle, AlertTriangle, ChevronDown, ChevronUp,
  Folder, ArrowLeft, Search, FileSignature, Download, Trash2,
  Layers, Calendar, Plus, ScanSearch, Send,
} from 'lucide-react';
import ModalShell from '../../../components/common/ModalShell';
import { CATEGORIAS_RH_ACT, getValidadeStatus, getDiasRestantes, getExpiryRelativeLabel, CATEGORIA_CONFIG, CATEGORIA_COLOR_MAP } from '../../../constants/rhCategories';
import { getCategoryFields } from '../../../constants/documentFieldsByCategory';
import { toSentenceCase, toSentenceCaseFilename, getInitials } from '../../../utils/textUtils';
import UploadManualModal from './UploadManualModal';
import { CompactDocRow } from './docBadges';
import ClientDocumentsPackageModal from './ClientDocumentsPackageModal';
import { TIPOS_DOCUMENTOS_CLIENTE } from '../../../constants/clientDocuments';

// Icon-button padronizado — mesmo par usado no resto do admin (neutro:
// hover navy/surface; destrutivo: hover bad/bad-bg).
const ACTION_ICON_CLS = "p-1.5 rounded-lg transition-all text-[var(--slate)] hover:text-[var(--navy)] hover:bg-[var(--surface-dim)]";
const ACTION_ICON_DELETE_CLS = "p-1.5 rounded-lg transition-all text-[var(--bad)] hover:bg-[var(--bad-bg)]";

const MESES_PT = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

// Recibo e mapa de ajudas ficam visíveis ao trabalhador logo no upload,
// sem precisar do toggle manual (ver useDocumentsAdmin.js).
const TIPOS_AUTO_VISIVEL = ['Recibo de Vencimento', 'Mapa de Ajudas de Custo'];

const TIPOS_COM_ASSINATURA = ['recibo', 'mapa de deslocamento', 'contrato de trabalho', 'mapa de ajuda de custo'];
const temFluxoAssinatura = (d) =>
  d.source === 'template' ||
  TIPOS_COM_ASSINATURA.some(t => (d?.tipo || '').toLowerCase().includes(t));

function buildDocTitle(d) {
  const rawBase = (d.title || d.tipo || 'Documento').replace(/ \(Frente\)| \(Verso\)/g, '').trim();
  const base = toSentenceCaseFilename(rawBase);
  if (d.createdAt) {
    return `${base} - ${MESES_PT[d.createdAt.getMonth()]} ${d.createdAt.getFullYear()}`;
  }
  return base;
}

function ThumbImg({ url, alt, imgClassName, wrapperClassName }) {
  const { supabase } = useApp();
  const [src, setSrc] = useState(null);
  const blobUrlRef = useRef(null);

  useEffect(() => {
    setSrc(null);
    if (blobUrlRef.current) { URL.revokeObjectURL(blobUrlRef.current); blobUrlRef.current = null; }
    if (!url) return;
    let cancelled = false;

    (async () => {
      try {
        const m = url.match(/\/object\/public\/([^/]+)\/(.+?)(\?|$)/);
        let blob;
        if (m && supabase) {
          const { data, error } = await supabase.storage.from(m[1]).download(decodeURIComponent(m[2]));
          if (error) throw error;
          blob = data;
        } else {
          const r = await fetch(url);
          if (!r.ok) throw new Error();
          blob = await r.blob();
        }
        if (cancelled) return;

        const isPdf = /\.pdf(\?|$)/i.test(url) || blob.type === 'application/pdf';
        const buf = await blob.arrayBuffer();
        if (cancelled) return;

        if (isPdf) {
          const dataUrl = await renderPdfFirstPage(buf, 0.5);
          if (!cancelled) setSrc(dataUrl);
        } else {
          const ext = url.split('?')[0].split('.').pop().toLowerCase();
          const mime = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' }[ext] || blob.type || 'image/jpeg';
          const blobUrl = URL.createObjectURL(new Blob([buf], { type: mime }));
          blobUrlRef.current = blobUrl;
          if (!cancelled) setSrc(blobUrl);
        }
      } catch { /* mostra placeholder */ }
    })();

    return () => {
      cancelled = true;
      if (blobUrlRef.current) { URL.revokeObjectURL(blobUrlRef.current); blobUrlRef.current = null; }
    };
  }, [url, supabase]);

  const wrapper = wrapperClassName || 'w-full h-full flex items-center justify-center bg-[var(--surface-dim)]';
  if (!src) return <div className={wrapper}><FileText size={22} className="text-[var(--slate)]" /></div>;
  return <img src={src} alt={alt || ''} className={imgClassName || 'w-full h-full object-cover'} />;
}

const COLOR_MAP = CATEGORIA_COLOR_MAP;

// Cor de acento por categoria (CATEGORIA_CONFIG[...].color), só para o
// acento/barra do CategorySection — não dá para reaproveitar as classes
// Tailwind de COLOR_MAP (`text-rose-600` etc.) num `style` inline, e montar
// a classe em runtime (`.replace('text-','border-')`) não funciona: o JIT
// do Tailwind só gera CSS para classes literais presentes no código-fonte,
// não para strings construídas dinamicamente. `var(--cat-*)` (index.css)
// segue o `.dark` automaticamente dentro de `style` inline — os -600 do
// Tailwind usados na primeira versão falhavam AA nos dois modos (medido:
// 3.19-4.76:1 claro, 3.62-4.54:1 escuro contra --panel), corrigido com
// tokens dedicados por categoria (>=5.47:1 nos dois modos).
const CATEGORIA_HEX = {
  amberCustom: 'var(--cat-amber-custom)',
  emerald: 'var(--cat-emerald)',
  sky: 'var(--cat-sky)',
  rose: 'var(--cat-rose)',
  teal: 'var(--cat-teal)',
  amber: 'var(--cat-amber)',
  orange: 'var(--cat-orange)',
  slate: 'var(--cat-slate)',
};

// Anel colorido à volta do avatar — proporção de documentos em dia
// (verde/âmbar/vermelho consoante haja algo urgente/expirado), para ver de
// longe quem tem pendências sem abrir a pasta.
function AvatarRing({ name, total, expirados, urgentes }) {
  const r = 19, c = 2 * Math.PI * r;
  const validPct = total > 0 ? Math.max(0, (total - expirados - urgentes) / total) : 1;
  const color = expirados > 0 ? 'var(--bad)' : urgentes > 0 ? 'var(--warn)' : 'var(--ok)';
  const hasAlert = expirados > 0 || urgentes > 0;
  return (
    <div className="relative w-11 h-11 shrink-0">
      <svg width="44" height="44" viewBox="0 0 44 44" className="absolute inset-0 -rotate-90">
        <circle cx="22" cy="22" r={r} fill="none" stroke="var(--border-soft)" strokeWidth="3" />
        <circle cx="22" cy="22" r={r} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round"
          strokeDasharray={`${c * validPct} ${c}`} />
      </svg>
      <div className={`absolute inset-[3px] rounded-full flex items-center justify-center ${SCALE.text.badge}`} style={{ backgroundColor: FT.navy, color: FT.orange }}>
        {getInitials(name)}
      </div>
      {/* Ponto de alerta no canto — substitui o badge/banner de texto solto
          que existia à parte do cartão. */}
      {hasAlert && (
        <span
          className="absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white"
          style={{ backgroundColor: expirados > 0 ? 'var(--bad)' : 'var(--warn)' }}
          title={expirados > 0 ? 'Documento expirado' : 'Documento a expirar em breve'}
        />
      )}
    </div>
  );
}

function ValidadeChip({ dataValidade }) {
  const status = getValidadeStatus(dataValidade);
  if (!status) return null;
  const dias = getDiasRestantes(dataValidade);
  const map = {
    expirado: { color: 'var(--bad)',  bg: 'var(--bad-bg)',  icon: <AlertTriangle size={8} />, label: 'Expirado' },
    urgente:  { color: 'var(--warn)', bg: 'var(--warn-bg)', icon: <Clock size={8} />,         label: `${dias}d` },
    aviso:    { color: 'var(--warn)', bg: 'var(--warn-bg)', icon: <Clock size={8} />,         label: `${dias}d` },
    ok:       { color: 'var(--ok)',   bg: 'var(--ok-bg)',   icon: <CheckCircle size={8} />,   label: 'Válido' },
  };
  const { color, bg, icon, label } = map[status];
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded ${SCALE.text.meta}`} style={{ color, backgroundColor: bg }}>
      {icon} {label}
    </span>
  );
}

function StateBadgeSmall({ state }) {
  if (state === 'signed') return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded ${SCALE.text.meta}`} style={{ color: 'var(--ok)', backgroundColor: 'var(--ok-bg)' }}>
      <CheckCircle size={8} /> Assinado
    </span>
  );
  if (state === 'awaiting_admin') return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded ${SCALE.text.meta}`} style={{ color: 'var(--slate-dim)', backgroundColor: 'var(--surface-dim)' }}>
      <FileSignature size={8} /> Aguarda aprovação
    </span>
  );
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded ${SCALE.text.meta}`} style={{ color: 'var(--warn)', backgroundColor: 'var(--warn-bg)' }}>
      <Clock size={8} /> Pendente
    </span>
  );
}

export function DocumentViewerModal({ doc, onClose }) {
  const { supabase } = useApp();
  const [content, setContent] = useState(null);
  const [loading, setLoading] = useState(false);
  const blobUrlRef = useRef(null);

  useEffect(() => {
    setContent(null);
    if (blobUrlRef.current) { URL.revokeObjectURL(blobUrlRef.current); blobUrlRef.current = null; }
    const url = doc?.previewUrl;
    if (!doc || !url) return;
    let cancelled = false;
    setLoading(true);

    (async () => {
      try {
        const m = url.match(/\/object\/public\/([^/]+)\/(.+?)(\?|$)/);
        let blob;
        if (m && supabase) {
          const { data, error } = await supabase.storage.from(m[1]).download(decodeURIComponent(m[2]));
          if (error) throw error;
          blob = data;
        } else {
          const r = await fetch(url);
          if (!r.ok) throw new Error();
          blob = await r.blob();
        }
        if (cancelled) return;

        const isPdf = /\.pdf(\?|$)/i.test(url) || blob.type === 'application/pdf';
        const buf = await blob.arrayBuffer();
        if (cancelled) return;

        if (isPdf) {
          const srcDoc = await renderPdfToSrcDoc(buf);
          if (!cancelled) setContent({ type: 'srcDoc', value: srcDoc });
        } else {
          const ext = url.split('?')[0].split('.').pop().toLowerCase();
          const mime = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' }[ext] || blob.type || 'image/jpeg';
          const blobUrl = URL.createObjectURL(new Blob([buf], { type: mime }));
          blobUrlRef.current = blobUrl;
          if (!cancelled) setContent({ type: 'imgUrl', value: blobUrl });
        }
      } catch { /* content null → mostra "não disponível" */ }
      finally { if (!cancelled) setLoading(false); }
    })();

    return () => {
      cancelled = true;
      if (blobUrlRef.current) { URL.revokeObjectURL(blobUrlRef.current); blobUrlRef.current = null; }
    };
  }, [doc?.previewUrl, supabase]);

  if (!doc) return null;
  const url = doc.previewUrl;
  const title = buildDocTitle(doc);

  return (
    <ModalShell
      isOpen
      onClose={onClose}
      title={title}
      meta={[doc.workerName, doc.categoria, doc.tipo].filter(Boolean).join(' · ') || undefined}
      size="4xl"
      layer="viewer"
      footer={url ? (
        <div className="flex justify-end px-5 py-3">
          <a href={url} download className="p-2 rounded-xl bg-[var(--surface-dim)] hover:bg-indigo-50 text-[var(--ink-soft)] hover:text-indigo-600 transition-colors" title="Descarregar">
            <Download size={14} />
          </a>
        </div>
      ) : null}
    >
        {/* Corpo */}
        <div className="h-full bg-[var(--surface)] flex items-center justify-center">
          {loading ? (
            <div className="flex flex-col items-center gap-3 py-20 opacity-50">
              <Clock size={28} className="animate-spin text-indigo-400" />
              <p className="text-xs font-black uppercase tracking-widest text-[var(--slate-dim)]">A carregar...</p>
            </div>
          ) : !url || !content ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3 opacity-40">
              <FileText size={40} />
              <p className="text-sm font-black uppercase tracking-widest">Pré-visualização não disponível</p>
              <p className="text-xs text-[var(--slate-dim)]">Este documento ainda não tem ficheiro associado</p>
            </div>
          ) : content.type === 'srcDoc' ? (
            <iframe srcDoc={content.value} sandbox="allow-scripts" className="w-full min-h-[60vh] h-full border-0" title={title} />
          ) : (
            <div className="flex items-center justify-center p-6 w-full">
              <img src={content.value} alt={title} className="max-w-full max-h-[70vh] object-contain rounded-xl shadow" />
            </div>
          )}
        </div>
    </ModalShell>
  );
}

// Revitalizado (2026-08-31, proposta aprovada — ver CLAUDE.md): cabeçalho
// ganha a cor real da categoria (CATEGORIA_HEX/--cat-*, a mesma paleta já
// usada em CategorySection), estado sobe para junto do título, campos
// passam de linhas "rótulo: valor" para uma grelha de fichas, e as ações
// ganham rótulo em vez de ícones sozinhos. Estrutura/dados não mudam —
// continua a ler getCategoryFields(d) tal como estava.
function DocCardSingle({ d, onOpenDoc, onDelete, confirmDeleteId, setConfirmDeleteId }) {
  const { supabase } = useApp();
  const [visivelWorker, setVisivelWorker] = useState(d.visivel_worker ?? false);
  const url = d.viewUrl || d.signedPdfUrl || null;
  const temExpirado = getValidadeStatus(d.data_validade) === 'expirado';
  const temUrgente  = getValidadeStatus(d.data_validade) === 'urgente';
  const title = buildDocTitle(d);
  const catConfig = CATEGORIA_CONFIG[d.categoria] || CATEGORIA_CONFIG['Outros'];
  const catColor = CATEGORIA_HEX[catConfig.color] || FT.slate;
  const CatIcon = catConfig.icon;
  const accentColor = temExpirado ? 'var(--bad)' : temUrgente ? 'var(--warn)' : catColor;

  // bg-[var(--panel)], não bg-white: a classe bg-white tem uma regra-ponte
  // em App.css (`.dark .bg-white`) que força border-color com !important em
  // modo escuro — sobrepunha-se à cor da categoria no border-top (medido:
  // #334155 fixo, ignorava --cat-emerald). Achado ao vivo, ver CLAUDE.md.
  return (
    <div className="rounded-2xl overflow-hidden bg-[var(--panel)] border border-[var(--border-soft)]" style={{ borderTop: `3px solid ${accentColor}` }}>
      {/* Cabeçalho — ícone/tom da categoria + estado sempre visível junto ao título */}
      <div className="flex items-center gap-2.5 px-4 py-3.5">
        <div className="w-8 h-8 rounded-[10px] flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `color-mix(in srgb, ${catColor} 15%, transparent)`, color: catColor }}>
          <CatIcon size={16} />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className={`${SCALE.text.entityName} truncate`} style={{ fontFamily: FONT_TITLE }}>{title}</h4>
          {d.workerName && <p className={`${SCALE.text.meta} text-[var(--slate-dim)] truncate`}>{d.workerName}</p>}
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          {temFluxoAssinatura(d) && <StateBadgeSmall state={d.state} />}
          <ValidadeChip dataValidade={d.data_validade} />
        </div>
      </div>

      {/* Pré-visualização — object-contain, não object-cover: uma página
          A4 (retrato) recortada para caber numa caixa quase quadrada
          perdia o topo e o fundo da página. Com a página inteira visível,
          a caixa pode crescer um pouco sem ficar desproporcional. */}
      <div className="px-4">
        <div className="rounded-xl border border-[var(--border-soft)] overflow-hidden h-48">
          <ThumbImg url={url} alt={title} imgClassName="w-full h-full object-contain" wrapperClassName="w-full h-full flex items-center justify-center bg-[var(--surface-dim)]" />
        </div>
      </div>

      {/* Info do documento — grelha de fichas em vez de linhas "rótulo: valor" */}
      <div className="grid grid-cols-2 gap-px bg-[var(--border-soft)] border border-[var(--border-soft)] rounded-xl overflow-hidden mx-4 mt-3.5">
        {getCategoryFields(d).map(({ label, value }) => {
          const isValidadeField = label === 'Válido até' || label === 'Validade';
          const expiry = isValidadeField ? getExpiryRelativeLabel(d.data_validade) : null;
          return (
            <div key={label} className="bg-white px-2.5 py-2">
              <p className={`${SCALE.text.statLabel} text-[var(--slate-dim)] mb-0.5`}>{label}</p>
              {value ? (
                <p className={`${SCALE.text.body} text-[var(--ink-mid)]`}>{value}</p>
              ) : (
                <p className={`${SCALE.text.body} text-[var(--slate-dim)] italic`}>Não disponível</p>
              )}
              {expiry && <p className={`${SCALE.text.meta} font-bold mt-0.5 ${expiry.colorClass}`}>{expiry.label}</p>}
            </div>
          );
        })}
      </div>

      {/* Ações — com rótulo, apagar isolado à direita (destrutiva) */}
      {confirmDeleteId === d.id ? (
        <div className="mx-4 mt-3.5 mb-4 bg-rose-50 border border-rose-200 rounded-lg p-2 space-y-1.5">
          <p className={`${SCALE.text.meta} text-rose-700 text-center`}>Apagar permanentemente?</p>
          <div className="flex gap-1.5">
            <button onClick={() => { onDelete(d); setConfirmDeleteId(null); }} className={`flex-1 py-1.5 bg-rose-600 text-white ${SCALE.text.meta} rounded-lg hover:bg-rose-700`}>Sim</button>
            <button onClick={() => setConfirmDeleteId(null)} className={`flex-1 py-1.5 bg-white border border-[var(--border)] text-[var(--ink-soft)] ${SCALE.text.meta} rounded-lg`}>Não</button>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-1.5 mx-4 mt-3.5 mb-4">
          <button onClick={() => onOpenDoc(d)} className={`flex-1 flex items-center justify-center gap-1.5 h-9 rounded-[10px] bg-[var(--surface)] text-[var(--ink-soft)] ${SCALE.text.badge} hover:bg-[var(--border-soft)] transition-colors`}>
            <Eye size={14} /> Ver
          </button>
          {d.source === 'manual' && (
            <button
              onClick={async () => {
                const next = !visivelWorker;
                setVisivelWorker(next);
                await supabase?.from('documents').update({ visivel_worker: next }).eq('id', d.raw.id);
              }}
              title={visivelWorker ? 'Visível ao trabalhador — clique para ocultar' : 'Oculto ao trabalhador — clique para tornar visível'}
              className={`flex-1 flex items-center justify-center gap-1.5 h-9 rounded-[10px] ${SCALE.text.badge} transition-colors`}
              style={visivelWorker ? { color: 'var(--ok)', backgroundColor: 'var(--ok-bg)' } : { color: 'var(--slate)', backgroundColor: 'var(--surface)' }}
            >
              {visivelWorker ? <UserCheck size={14} /> : <EyeOff size={14} />} {visivelWorker ? 'Visível' : 'Oculto'}
            </button>
          )}
          <button onClick={() => setConfirmDeleteId(d.id)} title="Apagar" className="w-9 h-9 flex items-center justify-center rounded-[10px] transition-colors hover:brightness-95" style={{ color: 'var(--bad)', backgroundColor: 'var(--bad-bg)' }}>
            <Trash2 size={14} />
          </button>
        </div>
      )}
    </div>
  );
}

function DocCardPair({ pair, onOpenDoc, onDelete, confirmDeleteId, setConfirmDeleteId }) {
  const { supabase } = useApp();
  const frente = pair.find(d => d.lado === 'frente') || pair[0];
  const verso  = pair.find(d => d.lado === 'verso')  || pair[1];
  const isManual = pair.some(d => d.source === 'manual');
  const [visivelWorker, setVisivelWorker] = useState(
    pair.some(d => d.visivel_worker) ?? false
  );

  // Título base sem sufixo (Frente)/(Verso)
  const tipoBase = (frente?.tipo || verso?.tipo || '').replace(/ \(Frente\)| \(Verso\)/g, '').trim();
  const validade = verso?.data_validade || frente?.data_validade || null;
  const emissao  = frente?.createdAt || verso?.createdAt || null;
  const workerName = frente?.workerName || verso?.workerName || '';
  const temExpirado = getValidadeStatus(validade) === 'expirado';
  const temUrgente  = getValidadeStatus(validade) === 'urgente';

  const pairTitle = emissao
    ? `${tipoBase} — Frente & Verso - ${MESES_PT[emissao.getMonth()]} ${emissao.getFullYear()}`
    : `${tipoBase} — Frente & Verso`;

  const PreviewThumb = ({ doc, label }) => {
    const thumbUrl = doc?.viewUrl || doc?.signedPdfUrl || null;
    return (
      <div className="flex-1 min-w-0">
        <p className={`${SCALE.text.statLabel} text-[var(--slate-dim)] text-center mb-1`}>{label}</p>
        <div className="h-32 rounded-lg border border-[var(--border)] overflow-hidden">
          <ThumbImg url={thumbUrl} alt={label} imgClassName="w-full h-full object-contain" wrapperClassName="w-full h-full flex items-center justify-center bg-[var(--surface-dim)]" />
        </div>
      </div>
    );
  };

  return (
    <div className={`rounded-xl border-2 overflow-hidden ${temExpirado ? 'border-red-200' : temUrgente ? 'border-amber-200' : 'border-violet-200'} bg-violet-50/20`}>
      {/* Header */}
      <div className="flex items-start gap-2 px-3 py-2.5 bg-violet-50">
        <div className="p-1.5 bg-violet-200 text-violet-700 rounded-lg flex-shrink-0 mt-0.5"><Layers size={12} /></div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-black text-violet-800 truncate">{pairTitle}</p>
          {workerName && <p className={`${SCALE.text.meta} text-violet-600 truncate`}>{workerName}</p>}
        </div>
        {(temExpirado || temUrgente) && <AlertTriangle size={12} className={temExpirado ? 'text-red-500' : 'text-amber-500'} />}
        {isManual && (
          <button
            onClick={async () => {
              const next = !visivelWorker;
              setVisivelWorker(next);
              const ids = pair.filter(d => d.source === 'manual').map(d => d.raw.id);
              for (const id of ids) {
                await supabase?.from('documents').update({ visivel_worker: next }).eq('id', id);
              }
            }}
            title={visivelWorker ? 'Visível ao trabalhador — clique para ocultar' : 'Oculto ao trabalhador — clique para tornar visível'}
            className="p-1.5 rounded-lg transition-all"
            style={visivelWorker ? { color: 'var(--ok)', backgroundColor: 'var(--ok-bg)' } : { color: 'var(--slate)' }}
          >
            {visivelWorker ? <UserCheck size={11} /> : <EyeOff size={11} />}
          </button>
        )}
      </div>

      <div className="px-3 pb-3 space-y-2.5 bg-white">
        {/* Pré-visualizações */}
        <div className="flex gap-2 pt-2.5">
          <PreviewThumb doc={frente} label="Frente" />
          <PreviewThumb doc={verso}  label="Verso" />
        </div>

        {/* Info do documento — campos específicos da categoria */}
        <div className="bg-[var(--surface)] border border-[var(--border-soft)] rounded-xl p-2.5 space-y-1.5">
          <p className={`${SCALE.text.statLabel} text-[var(--slate-dim)] mb-1.5`}>Informação do documento</p>
          {(() => {
            const ref = frente || verso;
            const mergedDoc = {
              categoria: ref?.categoria,
              tipo: tipoBase,
              data_validade: validade,
              createdAt: emissao,
              signedAtWorker: ref?.signedAtWorker,
              dados_extraidos: frente?.dados_extraidos || verso?.dados_extraidos,
              viewUrl: frente?.viewUrl || verso?.viewUrl || null,
              signedPdfUrl: frente?.signedPdfUrl || verso?.signedPdfUrl || null,
            };
            return getCategoryFields(mergedDoc).map(({ label, value }) => {
              const isValidadeField = label === 'Válido até' || label === 'Validade';
              const expiry = isValidadeField ? getExpiryRelativeLabel(validade) : null;
              return (
                <div key={label}>
                  <span className={`${SCALE.text.meta} text-[var(--slate-dim)]`}>{label}: </span>
                  {value ? (
                    <span className={`${SCALE.text.meta} text-[var(--ink-mid)]`}>{value}</span>
                  ) : (
                    <span className={`${SCALE.text.meta} text-[var(--slate-dim)] italic`}>Não disponível</span>
                  )}
                  {expiry && <p className={`${SCALE.text.meta} ${expiry.colorClass}`}>{expiry.label}</p>}
                </div>
              );
            });
          })()}
          <div className="flex flex-wrap gap-1 pt-0.5">
            {temFluxoAssinatura(frente) && frente?.state && <StateBadgeSmall state={frente.state} />}
            <ValidadeChip dataValidade={validade} />
          </div>
        </div>

        {/* Ações por lado */}
        <div className="grid grid-cols-2 gap-2 pt-2.5 border-t border-[var(--border-soft)]">
          {[{ doc: frente, label: 'Frente' }, { doc: verso, label: 'Verso' }].map(({ doc, label }) => (
            doc ? (
              <div key={doc.id} className="space-y-1">
                <p className={`${SCALE.text.statLabel} text-[var(--slate-dim)] text-center`}>{label}</p>
                {confirmDeleteId === doc.id ? (
                  <div className="bg-rose-50 border border-rose-200 rounded-lg p-1.5 space-y-1">
                    <p className={`${SCALE.text.meta} text-rose-700 text-center`}>Apagar?</p>
                    <div className="flex gap-1">
                      <button onClick={() => { onDelete(doc); setConfirmDeleteId(null); }} className={`flex-1 py-1 bg-rose-600 text-white ${SCALE.text.meta} rounded hover:bg-rose-700`}>Sim</button>
                      <button onClick={() => setConfirmDeleteId(null)} className={`flex-1 py-1 bg-white border border-[var(--border)] text-[var(--ink-soft)] ${SCALE.text.meta} rounded`}>Não</button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-2">
                    <button onClick={() => onOpenDoc(doc)} className={ACTION_ICON_CLS} title="Ver"><Eye size={14} /></button>
                    <button onClick={() => setConfirmDeleteId(doc.id)} className={ACTION_ICON_DELETE_CLS} title="Apagar"><Trash2 size={14} /></button>
                  </div>
                )}
              </div>
            ) : null
          ))}
        </div>
      </div>
    </div>
  );
}

// Agrupa docs de uma categoria em pares Frente/Verso + avulsos — mesma
// lógica que já existia dentro de SubPastaCard, agora reaproveitada por
// categoria dentro de WorkerPastaView (uma função pura, não um hook — corre
// dentro de .map(), não pode chamar useMemo).
function groupDocItems(docs) {
  const groups = {};
  const singles = [];
  docs.forEach(d => {
    if (d.grupo_id) {
      if (!groups[d.grupo_id]) groups[d.grupo_id] = [];
      groups[d.grupo_id].push(d);
    } else {
      singles.push({ type: 'single', doc: d });
    }
  });
  const paired = Object.values(groups).map(g => ({ type: 'pair', docs: g }));
  return [...paired, ...singles];
}

// Modelo "linha" a partir de um item (single ou pair), para o CompactDocRow
// partilhado (docBadges.jsx) — que só olha para tipo/title/state/data_validade.
function itemToRowModel(item) {
  if (item.type === 'single') {
    const d = item.doc;
    return { tipo: d.tipo, title: d.title, state: d.state, data_validade: d.data_validade, createdAt: d.createdAt };
  }
  const [a, b] = item.docs;
  const frente = item.docs.find(d => d.lado === 'frente') || a;
  const verso = item.docs.find(d => d.lado === 'verso') || b;
  const tipoBase = (frente?.tipo || verso?.tipo || '').replace(/ \(Frente\)| \(Verso\)/g, '').trim();
  return {
    tipo: `${tipoBase} — Frente & Verso`,
    title: null,
    state: frente?.state,
    data_validade: verso?.data_validade || frente?.data_validade || null,
    createdAt: frente?.createdAt || verso?.createdAt || null,
  };
}

// Secção de categoria — cabeçalho com ícone/cor da categoria + linhas
// compactas (CompactDocRow). Substitui o cartão de subpasta com barra de
// progresso que abria um modal à parte (SubPastaCard) — clicar numa linha
// abre directamente a ficha do documento (via onOpenItem), sem esse nível
// extra. Decisão do Diego, 2026-08-31, depois de comparar com "Por
// categoria" — ver CLAUDE.md.
// Agrupa os items (já em pares/avulsos) por mês/ano de emissão, do mais
// recente para o mais antigo — o mês passa a título do grupo, por isso cada
// CompactDocRow não repete "· Mês Ano" lá dentro (hideMesAno). Sem data
// (raro) cai num grupo "Sem data" no fim.
function groupItemsByMonth(items) {
  const groups = new Map();
  items.forEach(item => {
    const row = itemToRowModel(item);
    const key = row.createdAt ? `${row.createdAt.getFullYear()}-${row.createdAt.getMonth()}` : 'sem-data';
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        label: row.createdAt ? `${MESES_PT[row.createdAt.getMonth()]} ${row.createdAt.getFullYear()}` : 'Sem data',
        sortValue: row.createdAt ? row.createdAt.getTime() : -Infinity,
        items: [],
      });
    }
    groups.get(key).items.push(item);
  });
  return [...groups.values()].sort((a, b) => b.sortValue - a.sortValue);
}

// Grupo de mês dentro de uma categoria — acordeão próprio, aberto por
// omissão (não perde o ganho de "menos cliques" da reorganização; só dá
// para recolher o que não interessa, não obriga a abrir o que interessa).
function MonthGroup({ group, onOpenItem }) {
  const [open, setOpen] = useState(true);
  return (
    <div>
      {/* Marca de linha do tempo (ponto + linha) em vez de outro bloco de
          texto igual ao cabeçalho da categoria — é informação secundária
          (quando), a categoria é que é a primária (o quê). */}
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center gap-1.5 px-2 mb-1 text-left">
        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: 'var(--slate-dim)' }} />
        <p className={`${SCALE.text.meta} text-[var(--slate-dim)] font-bold uppercase tracking-wide whitespace-nowrap`}>{group.label}</p>
        <span className="flex-1 h-px" style={{ backgroundColor: 'var(--border-soft)' }} />
        <span className={`${SCALE.text.meta} text-[var(--slate-dim)] font-mono`}>{group.items.length}</span>
        <ChevronDown size={11} className={`text-[var(--slate-dim)] shrink-0 transition-transform ${open ? '' : '-rotate-90'}`} />
      </button>
      {open && (
        <div className="flex flex-col gap-1">
          {group.items.map((item, i) => (
            <CompactDocRow
              key={item.type === 'pair' ? (item.docs[0]?.id || i) : item.doc.id}
              d={itemToRowModel(item)}
              onClick={() => onOpenItem(item)}
              hideMesAno
            />
          ))}
        </div>
      )}
    </div>
  );
}

function CategorySection({ categoria, docs, onOpenItem }) {
  const [open, setOpen] = useState(true);
  const config = CATEGORIA_CONFIG[categoria] || CATEGORIA_CONFIG["Outros"];
  const colors = COLOR_MAP[config.color];
  const hex = CATEGORIA_HEX[config.color] || FT.slate;
  const Icon = config.icon;
  const monthGroups = useMemo(() => groupItemsByMonth(groupDocItems(docs)), [docs]);
  const resolvidos = useMemo(() => docs.filter(d => d.state === 'signed' && getValidadeStatus(d.data_validade) !== 'expirado').length, [docs]);

  if (docs.length === 0) return null;

  return (
    <div className="rounded-xl overflow-hidden border border-[var(--border-soft)] bg-[var(--panel)]" style={{ borderLeft: `3px solid ${hex}` }}>
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center gap-2 px-2.5 py-2 text-left">
        <div className={`p-1 rounded-md ${colors.bg} ${colors.text} flex-shrink-0`}>
          <Icon size={11} />
        </div>
        <p className={`${SCALE.text.statLabel} text-[var(--slate-dim)]`}>{toSentenceCase(categoria)}</p>
        <div className="ml-auto flex items-center gap-2 shrink-0">
          <div className="text-right">
            <span className={`${SCALE.text.meta} font-mono`} style={{ color: hex }}>{resolvidos}/{docs.length}</span>
            <div className="w-11 h-1 rounded-full overflow-hidden mt-0.5" style={{ backgroundColor: 'var(--surface-dim)' }}>
              <div className="h-full rounded-full" style={{ width: `${docs.length ? resolvidos / docs.length * 100 : 0}%`, backgroundColor: hex }} />
            </div>
          </div>
          <ChevronDown size={13} className={`text-[var(--slate-dim)] shrink-0 transition-transform ${open ? '' : '-rotate-90'}`} />
        </div>
      </button>
      {open && (
        <div className="flex flex-col gap-2.5 px-2.5 pb-2.5">
          {monthGroups.map(group => (
            <MonthGroup key={group.key} group={group} onOpenItem={onOpenItem} />
          ))}
        </div>
      )}
    </div>
  );
}

export function WorkerPastaView({ worker, docs, onBack, onOpenDoc, onDelete, onAddDoc, onScan, hideHeader }) {
  const { supabase } = useApp();
  const [quickViewItem, setQuickViewItem] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [pacoteOpen, setPacoteOpen] = useState(false);
  const [compromisso, setCompromisso] = useState(null);

  // "Compromisso de Início de Atividade" — assinado pelo candidato antes de
  // ser aprovado como trabalhador, num sistema à parte (onboarding_commitments,
  // ligado por worker_id desde 2026-09-04). Não faz parte de documents/
  // worker_documents nem de TIPOS_DOCUMENTOS_CLIENTE — é pré-contratual, não
  // um documento RH normal, por isso vive fora das secções por categoria.
  useEffect(() => {
    if (!supabase || !worker?.workerId) { setCompromisso(null); return; }
    let cancelled = false;
    supabase
      .from('onboarding_commitments')
      .select('pdf_url, created_at')
      .eq('worker_id', worker.workerId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => { if (!cancelled) setCompromisso(data || null); });
    return () => { cancelled = true; };
  }, [supabase, worker?.workerId]);

  // Slot fixo por tipo — no máximo 1 doc "ativo" por tipo faz sentido aqui
  // (Registo de Formação Interna tem id estável por ano, sempre o do ano
  // corrente; os 2 templates do Gate só são gerados uma vez por
  // trabalhador). Se por acaso existir mais que um, fica o mais recente.
  const docsCliente = useMemo(() => {
    return TIPOS_DOCUMENTOS_CLIENTE.map((tipo) => {
      const candidatos = docs.filter((d) => d.tipo === tipo).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      return { tipo, doc: candidatos[0] || null };
    });
  }, [docs]);

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

  // Resumo do cabeçalho — buckets mutuamente exclusivos (um documento
  // pendente E expirado conta só como "expirado", nunca nos dois ao mesmo
  // tempo, para a barra segmentada somar sempre 100%).
  const porResolver = docs.filter(d => d.state !== 'signed' && !['expirado', 'urgente'].includes(getValidadeStatus(d.data_validade))).length;
  const resolvidos = docs.length - porResolver - expirados;
  const pctResolvido = docs.length ? Math.round(resolvidos / docs.length * 100) : 0;

  const quickViewTitle = quickViewItem
    ? (quickViewItem.type === 'pair' ? itemToRowModel(quickViewItem).tipo : buildDocTitle(quickViewItem.doc))
    : '';

  return (
    <div className="space-y-4 max-w-4xl mx-auto">
      {/* Header — omitido quando embebido num ModalShell que já mostra
          nome/contagem no título (ver CategoryWorkerGrid.jsx). */}
      {!hideHeader && (
          /* Cabeçalho-resumo — navy fixo (não segue o tema, é fundo de
              marca, mesma lógica de --navy-solid já documentada) com 3
              números (resolvidos/por resolver/expirados) + barra segmentada,
              para ler o estado geral sem abrir nenhuma secção. Tamanhos de
              letra reaproveitam SCALE.text tal como estavam — só a estrutura
              e as cores mudaram (proposta visual aprovada, 2026-08-31).
              Botão "voltar" passou a viver dentro do próprio cartão (antes
              era um irmão à esquerda, fora do contentor `max-w-4xl mx-auto`
              — ficava solto/desalinhado em ecrãs largos, feedback do
              Diego, 2026-08-31). */
          <div className="rounded-2xl p-4" style={{ background: `linear-gradient(135deg, var(--navy-solid), ${FT.navyDeep})` }}>
            <div className="flex items-center gap-3">
              <button onClick={onBack} className="p-2 -ml-1 rounded-xl transition-colors shrink-0 hover:bg-white/10" style={{ color: 'var(--on-navy)' }}>
                <ArrowLeft size={16} />
              </button>
              <div className="relative w-12 h-12 shrink-0">
                <div className="w-12 h-12 rounded-full flex items-center justify-center text-base font-black" style={{ backgroundColor: FT.navy, color: FT.orange }}>{getInitials(worker.workerName)}</div>
                {expirados > 0 && (
                  <span className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2" style={{ backgroundColor: 'var(--bad)', borderColor: FT.navyDeep }} title={`${expirados} documento${expirados !== 1 ? 's' : ''} a expirar/expirado${expirados !== 1 ? 's' : ''}`} />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h4 className={`${SCALE.text.entityName} truncate`} style={{ fontFamily: FONT_TITLE, color: '#fff' }}>{toSentenceCase(worker.workerName)}</h4>
                <p className={`${SCALE.text.meta} uppercase tracking-wide`} style={{ color: 'var(--on-navy)' }}>{docs.length} documento{docs.length !== 1 ? 's' : ''} no total</p>
              </div>
              {onScan && (
                <button
                  onClick={onScan}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border transition-colors shrink-0"
                  style={{ borderColor: 'var(--on-navy)', color: 'var(--on-navy)' }}
                >
                  <ScanSearch size={13} /> <span className={SCALE.text.badge}>Scanner</span>
                </button>
              )}
              {onAddDoc && (
                <button
                  onClick={onAddDoc}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-colors shrink-0"
                  style={{ backgroundColor: FT.orange, color: FT.navy }}
                >
                  <Plus size={13} /> <span className={SCALE.text.badge}>Adicionar</span>
                </button>
              )}
            </div>

            <div className="flex gap-5 mt-3.5">
              <div>
                <p className={SCALE.text.statValue} style={{ fontFamily: FONT_TITLE, color: '#fff' }}>{resolvidos}</p>
                <p className={SCALE.text.statLabel} style={{ color: 'var(--on-navy)' }}>Resolvidos</p>
              </div>
              <div>
                <p className={SCALE.text.statValue} style={{ fontFamily: FONT_TITLE, color: FT.orange }}>{porResolver}</p>
                <p className={SCALE.text.statLabel} style={{ color: 'var(--on-navy)' }}>Por resolver</p>
              </div>
              {expirados > 0 && (
                <div>
                  {/* #e08872 fixo (não var(--bad)) — o cabeçalho é navy fixo
                      em qualquer tema, e var(--bad) no modo claro (#b4432f)
                      só dá 2,11:1 sobre navy; este é o mesmo tom já usado
                      para --bad no modo escuro, onde o fundo também é
                      escuro — mesma lógica de --on-navy. */}
                  <p className={SCALE.text.statValue} style={{ fontFamily: FONT_TITLE, color: '#e08872' }}>{expirados}</p>
                  <p className={SCALE.text.statLabel} style={{ color: 'var(--on-navy)' }}>Expirados</p>
                </div>
              )}
            </div>

            {docs.length > 0 && (
              <div className="mt-3">
                <div className="h-1.5 rounded-full overflow-hidden flex" style={{ backgroundColor: 'rgba(255,255,255,.12)' }}>
                  {resolvidos > 0 && <div style={{ width: `${resolvidos / docs.length * 100}%`, backgroundColor: 'var(--ok)' }} />}
                  {porResolver > 0 && <div style={{ width: `${porResolver / docs.length * 100}%`, backgroundColor: FT.orange }} />}
                  {expirados > 0 && <div style={{ width: `${expirados / docs.length * 100}%`, backgroundColor: 'var(--bad)' }} />}
                </div>
                <p className={`${SCALE.text.meta} mt-1.5`} style={{ color: 'var(--on-navy)' }}>{pctResolvido}% da pasta resolvida</p>
              </div>
            )}
          </div>
      )}

      {/* Compromisso de Início de Atividade — só aparece se este trabalhador
          tiver vindo do fluxo público de onboarding com assinatura. */}
      {compromisso && (
        <div className="flex items-center justify-between gap-3 rounded-xl px-4 py-2.5 bg-[var(--surface)] border border-[var(--border-soft)]">
          <div className="flex items-center gap-2 min-w-0">
            <FileSignature size={14} className="text-[var(--slate)] shrink-0" />
            <span className={`${SCALE.text.meta} text-[var(--ink-mid)] truncate`}>
              Compromisso de Início de Atividade — assinado em {new Date(compromisso.created_at).toLocaleDateString('pt-PT')}
            </span>
          </div>
          {compromisso.pdf_url && (
            <a href={compromisso.pdf_url} target="_blank" rel="noreferrer" className={`${SCALE.text.badge} text-[var(--navy)] hover:underline shrink-0`}>
              Ver PDF
            </a>
          )}
        </div>
      )}

      {/* Documentos para Cliente — pacote fixo de 3 (TIPOS_DOCUMENTOS_CLIENTE),
          independente das categorias abaixo. Botão fica sempre ativo — o
          próprio modal explica o que falta em vez de um botão desabilitado
          sem contexto. */}
      <div className="rounded-2xl p-4 bg-white border border-[var(--border-soft)]">
        <div className="flex items-center justify-between gap-3 mb-3">
          <h5 className={`${SCALE.text.statLabel} text-[var(--slate-dim)]`}>Documentos para Cliente</h5>
          <button
            onClick={() => setPacoteOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black uppercase shrink-0"
            style={{ backgroundColor: FT.orange, color: FT.navy }}
          >
            <Send size={12} /> Preparar Pacote Cliente
          </button>
        </div>
        <div className="space-y-1.5">
          {docsCliente.map(({ tipo, doc }) => (
            <div key={tipo} className="flex items-center justify-between gap-2">
              <span className={`${SCALE.text.meta} text-[var(--ink-mid)] truncate`}>{tipo}</span>
              {doc ? <StateBadgeSmall state={doc.state} /> : (
                <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded ${SCALE.text.meta}`} style={{ color: 'var(--slate-dim)', backgroundColor: 'var(--surface-dim)' }}>
                  Em falta
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Secções por categoria */}
      {categoriasComDocs.length === 0 ? (
        <div className="py-12 text-center opacity-30">
          <FolderOpen size={32} className="mx-auto mb-2" />
          <p className="text-xs font-black uppercase tracking-widest">Sem documentos</p>
        </div>
      ) : (
        <div className="space-y-4">
          {categoriasComDocs.map(cat => (
            <CategorySection key={cat} categoria={cat} docs={byCategoria[cat] || []} onOpenItem={setQuickViewItem} />
          ))}
        </div>
      )}

      {/* Ficha rápida do documento — o mesmo DocCardSingle/DocCardPair que
          antes só vivia dentro do modal de categoria, agora aberto
          directamente a partir da linha (1 clique, não 2). */}
      <ModalShell
        isOpen={!!quickViewItem}
        onClose={() => setQuickViewItem(null)}
        title={quickViewTitle}
        size="sm"
        layer="nested"
      >
        {quickViewItem && (
          <div className="p-4">
            {quickViewItem.type === 'pair' ? (
              <DocCardPair
                pair={quickViewItem.docs}
                onOpenDoc={onOpenDoc}
                onDelete={onDelete}
                confirmDeleteId={confirmDeleteId}
                setConfirmDeleteId={setConfirmDeleteId}
              />
            ) : (
              <DocCardSingle
                d={quickViewItem.doc}
                onOpenDoc={onOpenDoc}
                onDelete={onDelete}
                confirmDeleteId={confirmDeleteId}
                setConfirmDeleteId={setConfirmDeleteId}
              />
            )}
          </div>
        )}
      </ModalShell>

      <ClientDocumentsPackageModal
        open={pacoteOpen}
        onClose={() => setPacoteOpen(false)}
        worker={worker}
        docsCliente={docsCliente}
      />
    </div>
  );
}

export default function WorkerDocsFolderView({ docs, onPreview, onDeleteManual, onDeleteGenerated }) {
  const { supabase, setDocuments } = useApp();
  const [searchParams] = useSearchParams();
  const [selectedWorker, setSelectedWorker] = useState(() => searchParams.get('worker') || null);
  const [search, setSearch] = useState('');
  const [previewDoc, setPreviewDoc] = useState(null);
  const [showUpload, setShowUpload]     = useState(false);
  const [selTipo, setSelTipo]           = useState('Recibo de Vencimento');
  const [selCategoria, setSelCategoria] = useState('Remuneração');
  const [selValidade, setSelValidade]   = useState('');
  const [selFile, setSelFile]           = useState(null);
  const [uploading, setUploading]       = useState(false);

  const handleUpload = async () => {
    if (!selFile || !supabase || !selectedWorker) return;
    setUploading(true);
    try {
      const slugify = s => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
      const cleanName = selFile.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const path = `${selectedWorker}/${slugify(selCategoria || selTipo)}/${Date.now()}_${cleanName}`;
      const { error: upError } = await supabase.storage.from('documentos').upload(path, selFile);
      if (upError) throw upError;
      const { data: urlData } = supabase.storage.from('documentos').getPublicUrl(path);
      const newDoc = {
        id: `doc_${Date.now()}`,
        workerId: selectedWorker,
        tipo: selTipo,
        nomeFicheiro: selFile.name,
        url: urlData.publicUrl,
        status: 'Pendente',
        categoria: selCategoria || null,
        data_validade: selValidade || null,
        dataEmissao: new Date().toISOString(),
        visivel_worker: TIPOS_AUTO_VISIVEL.includes(selTipo),
      };
      const { error: dbError } = await supabase.from('documents').insert([newDoc]);
      if (dbError) throw dbError;
      if (setDocuments) setDocuments(prev => [newDoc, ...prev]);
      setSelFile(null);
      setSelValidade('');
      setShowUpload(false);
    } catch (err) {
      alert(`Erro: ${err.message}`);
    } finally {
      setUploading(false);
    }
  };

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
          <DocumentViewerModal key={previewDoc?.id} doc={previewDoc} onClose={() => setPreviewDoc(null)} />
          <WorkerPastaView
            worker={workerData}
            docs={workerData.docs}
            onBack={() => setSelectedWorker(null)}
            onOpenDoc={handleOpenDoc}
            onDelete={handleDelete}
            onAddDoc={() => setShowUpload(true)}
          />
          {showUpload && (
            <UploadManualModal
              hideWorkerSelect
              workers={[{ id: selectedWorker, name: workerData.workerName }]}
              uploading={uploading}
              selWorker={selectedWorker}
              setSelWorker={() => {}}
              selTipo={selTipo}           setSelTipo={setSelTipo}
              selCategoria={selCategoria} setSelCategoria={setSelCategoria}
              selValidade={selValidade}   setSelValidade={setSelValidade}
              selFile={selFile}           setSelFile={setSelFile}
              onClose={() => { setShowUpload(false); setSelFile(null); setSelValidade(''); }}
              onUpload={handleUpload}
            />
          )}
        </>
      );
    }
  }

  // Vista de lista de trabalhadores
  return (
    <div className="space-y-4">
      <DocumentViewerModal key={previewDoc?.id} doc={previewDoc} onClose={() => setPreviewDoc(null)} />

      {/* Pesquisa — o Scanner passou para o botão de ação do cabeçalho
          partilhado (DocumentsAdmin.jsx), mesma posição nas 3 sub-abas. */}
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--slate)] pointer-events-none" />
        <input
          type="text"
          placeholder="Pesquisar colaborador..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-9 pr-3 py-2.5 text-xs font-bold border border-[var(--border)] rounded-xl bg-[var(--surface)] outline-none focus:ring-2 focus:ring-indigo-300 transition-all"
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
            const porResolver = w.docs.filter(d => d.state !== 'signed').length;
            const categorias = [...new Set(w.docs.map(d => d.categoria).filter(Boolean))];
            const alertBorder = expirados > 0 ? 'border-red-200 hover:border-red-400'
              : urgentes > 0 ? 'border-amber-200 hover:border-amber-400'
              : 'border-[var(--border)] hover:border-indigo-300';

            return (
              <button
                key={w.workerId}
                onClick={() => setSelectedWorker(w.workerId)}
                className={`text-left border-2 rounded-2xl p-4 hover:shadow-md transition-all duration-200 bg-white ${alertBorder}`}
              >
                <div className="flex items-start gap-3 mb-3">
                  <AvatarRing name={w.workerName} total={w.docs.length} expirados={expirados} urgentes={urgentes} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-black text-[var(--ink)] truncate" style={{ fontFamily: FONT_TITLE }}>{toSentenceCase(w.workerName)}</p>
                    <p className={`${SCALE.text.meta} text-[var(--slate-dim)] mt-0.5`}>
                      {w.docs.length} doc{w.docs.length !== 1 ? 's' : ''}
                      {porResolver > 0 && <span style={{ color: 'var(--warn)' }}> · {porResolver} por resolver</span>}
                    </p>
                  </div>
                </div>

                {/* Sub-pastas presentes — no máx. 3 + "+N", nunca quebra linha */}
                {categorias.length > 0 && (
                  <div className="flex flex-nowrap gap-1 overflow-hidden">
                    {categorias.slice(0, 3).map(cat => {
                      const conf = CATEGORIA_CONFIG[cat] || CATEGORIA_CONFIG["Outros"];
                      const colors = COLOR_MAP[conf.color];
                      return (
                        <span key={cat} className={`px-1.5 py-0.5 rounded whitespace-nowrap shrink-0 ${SCALE.text.meta} ${colors.bg} ${colors.text}`}>
                          {cat.split(' ')[0]}
                        </span>
                      );
                    })}
                    {categorias.length > 3 && (
                      <span className={`px-1.5 py-0.5 rounded whitespace-nowrap shrink-0 ${SCALE.text.meta} bg-[var(--surface-dim)] text-[var(--ink-soft)]`}>
                        +{categorias.length - 3}
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
