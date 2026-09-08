import React, { useEffect, useMemo, useState } from 'react';
import { Upload, ShieldCheck, Loader2, Send, Calendar, CheckCircle, AlertTriangle, Clock, Eye, Download } from 'lucide-react';
import { useApp } from '../../../context/AppContext';
import { authFetch } from '../../../utils/authFetch';
import { TIPOS_DOCUMENTOS_EMPRESA, TIPOS_DOCUMENTOS_EMPRESA_MENSAIS } from '../../../constants/companyDocuments';
import { getValidadeStatus, getExpiryRelativeLabel } from '../../../constants/rhCategories';
import { FT, SCALE, FONT_TITLE } from '../../../styles/designTokens';
import CompanyDocumentsPackageModal from './CompanyDocumentsPackageModal';
import { DocumentViewerModal } from './WorkerDocsFolderView';

function StatusBadge({ status }) {
  const map = {
    expirado: { color: 'var(--bad)', bg: 'var(--bad-bg)', icon: <AlertTriangle size={10} />, label: 'Expirado' },
    urgente:  { color: 'var(--warn)', bg: 'var(--warn-bg)', icon: <Clock size={10} />, label: 'A expirar' },
    aviso:    { color: 'var(--warn)', bg: 'var(--warn-bg)', icon: <Clock size={10} />, label: 'A expirar' },
    ok:       { color: 'var(--ok)', bg: 'var(--ok-bg)', icon: <CheckCircle size={10} />, label: 'Válido' },
    disponivel: { color: 'var(--ok)', bg: 'var(--ok-bg)', icon: <CheckCircle size={10} />, label: 'Disponível' },
    falta:    { color: 'var(--slate-dim)', bg: 'var(--surface-dim)', icon: null, label: 'Em falta' },
  };
  const { color, bg, icon, label } = map[status] || map.falta;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full ${SCALE.text.meta} font-bold`} style={{ color, backgroundColor: bg }}>
      {icon} {label}
    </span>
  );
}

// Modal simples de upload de um documento da empresa — ficheiro + validade
// opcional (+ período, só para os 3 tipos mensais).
function UploadCompanyDocModal({ tipo, mensal, onClose, onUploaded }) {
  const { supabase } = useApp();
  const hoje = new Date();
  const [periodo, setPeriodo] = useState(`${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`);
  const [validade, setValidade] = useState('');
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const slugifyTipo = (t) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase();

  const handleUpload = async () => {
    if (!file || !supabase) return;
    setUploading(true);
    setError('');
    try {
      const path = `${slugifyTipo(tipo)}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
      const { error: upErr } = await supabase.storage.from('documentos-empresa').upload(path, file);
      if (upErr) throw upErr;
      const { data: urlData } = supabase.storage.from('documentos-empresa').getPublicUrl(path);
      const { error: dbErr } = await supabase.from('company_documents').insert({
        id: `cdoc_${Date.now()}`,
        tipo,
        periodo: mensal ? periodo : null,
        nome_ficheiro: file.name,
        url: urlData.publicUrl,
        data_validade: validade || null,
      });
      if (dbErr) throw dbErr;
      onUploaded();
      onClose();
    } catch (e) {
      setError(e.message);
    }
    setUploading(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl p-5 w-full max-w-sm space-y-3" onClick={(e) => e.stopPropagation()}>
        <h4 className={`${SCALE.text.entityName}`} style={{ fontFamily: FONT_TITLE }}>{tipo}</h4>

        {mensal && (
          <div className="space-y-1">
            <label className={`${SCALE.text.statLabel} text-[var(--slate-dim)]`}>Período</label>
            <input type="month" value={periodo} onChange={(e) => setPeriodo(e.target.value)}
              className="w-full p-2.5 rounded-xl border border-[var(--border)] text-sm" />
          </div>
        )}

        <div className="space-y-1">
          <label className={`${SCALE.text.statLabel} text-[var(--slate-dim)]`}>Ficheiro (PDF)</label>
          <input type="file" accept=".pdf" onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="w-full p-2 rounded-xl border border-[var(--border)] text-xs" />
        </div>

        <div className="space-y-1">
          <label className={`${SCALE.text.statLabel} text-[var(--slate-dim)]`}>Validade (opcional)</label>
          <input type="date" value={validade} onChange={(e) => setValidade(e.target.value)}
            className="w-full p-2.5 rounded-xl border border-[var(--border)] text-sm" />
        </div>

        {error && <p className="text-xs text-red-600 font-bold bg-red-50 rounded-lg p-2">{error}</p>}

        <div className="flex gap-2 pt-1">
          <button onClick={onClose} disabled={uploading} className="flex-1 py-2 rounded-xl bg-slate-100 text-slate-600 text-sm font-semibold disabled:opacity-50">Cancelar</button>
          <button onClick={handleUpload} disabled={uploading || !file} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-semibold disabled:opacity-50" style={{ backgroundColor: FT.orange, color: FT.navy }}>
            {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />} Guardar
          </button>
        </div>
      </div>
    </div>
  );
}

const TIPO_SS_AUTOMATIZAVEL = 'Certidão de Situação Contributiva Regularizada';
const TIPO_AT_AUTOMATIZAVEL = 'Certidão de Situação Fiscal Regularizada';

// Ver (preview) + Descarregar — mesmo par de ações já usado nos documentos
// por trabalhador (DocumentViewerModal), reaproveitado aqui em vez de
// deixar o documento "disponível" sem forma nenhuma de o abrir/baixar.
function DocActions({ doc, label, onPreview }) {
  if (!doc?.url) return null;
  return (
    <div className="flex items-center gap-1 shrink-0">
      <button onClick={() => onPreview(doc, label)} title="Ver" className="p-1.5 rounded-lg text-[var(--slate)] hover:text-[var(--navy)] hover:bg-[var(--surface)] transition-colors">
        <Eye size={14} />
      </button>
      <a href={doc.url} download title="Descarregar" className="p-1.5 rounded-lg text-[var(--slate)] hover:text-[var(--navy)] hover:bg-[var(--surface)] transition-colors">
        <Download size={14} />
      </a>
    </div>
  );
}

export default function CompanyDocumentsAdmin() {
  const { supabase } = useApp();
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploadTipo, setUploadTipo] = useState(null); // tipo em upload, ou null
  const [obtendoSS, setObtendoSS] = useState(false);
  const [erroSS, setErroSS] = useState('');
  const [obtendoAT, setObtendoAT] = useState(false);
  const [erroAT, setErroAT] = useState('');
  const [pacoteOpen, setPacoteOpen] = useState(false);
  const [previewDoc, setPreviewDoc] = useState(null);

  const handlePreview = (doc, label) => {
    setPreviewDoc({
      previewUrl: doc.url,
      tipo: label,
      title: doc.nome_ficheiro || null,
      createdAt: doc.data_emissao ? new Date(doc.data_emissao) : null,
    });
  };

  const reload = () => {
    if (!supabase) return;
    setLoading(true);
    supabase.from('company_documents').select('*').order('data_emissao', { ascending: false })
      .then(({ data }) => { setDocs(data || []); setLoading(false); });
  };
  useEffect(reload, [supabase]);

  // Por tipo não-mensal: só o mais recente (já vem ordenado desc). Por tipo
  // mensal: os últimos 6 períodos distintos, mais recente primeiro.
  const porTipo = useMemo(() => {
    const map = {};
    TIPOS_DOCUMENTOS_EMPRESA.forEach((tipo) => {
      const doDocTipo = docs.filter((d) => d.tipo === tipo);
      if (TIPOS_DOCUMENTOS_EMPRESA_MENSAIS.includes(tipo)) {
        const porPeriodo = {};
        doDocTipo.forEach((d) => { if (d.periodo && !porPeriodo[d.periodo]) porPeriodo[d.periodo] = d; });
        map[tipo] = Object.values(porPeriodo).sort((a, b) => (b.periodo || '').localeCompare(a.periodo || '')).slice(0, 6);
      } else {
        map[tipo] = doDocTipo[0] || null;
      }
    });
    return map;
  }, [docs]);

  const handleObterSS = async () => {
    setObtendoSS(true);
    setErroSS('');
    try {
      const res = await authFetch('/api/seguranca-social', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'situacao-contributiva' }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.erro || `Erro ${res.status}`);
      if (!body.caminho) throw new Error('A Segurança Social não devolveu o documento.');

      const pdfRes = await authFetch(`/api/seguranca-social?action=situacao-contributiva-pdf&caminho=${encodeURIComponent(body.caminho)}`);
      if (!pdfRes.ok) throw new Error('Falha ao descarregar o PDF da Segurança Social.');
      const blob = await pdfRes.blob();

      const path = `certidao-situacao-contributiva/${Date.now()}.pdf`;
      const { error: upErr } = await supabase.storage.from('documentos-empresa').upload(path, blob, { contentType: 'application/pdf' });
      if (upErr) throw upErr;
      const { data: urlData } = supabase.storage.from('documentos-empresa').getPublicUrl(path);

      const { error: dbErr } = await supabase.from('company_documents').insert({
        id: `cdoc_${Date.now()}`,
        tipo: TIPO_SS_AUTOMATIZAVEL,
        nome_ficheiro: 'situacao-contributiva.pdf',
        url: urlData.publicUrl,
      });
      if (dbErr) throw dbErr;

      if (!body.situacaoContributivaRegularizada) {
        setErroSS('Obtido, mas a Segurança Social devolveu a situação como NÃO regularizada — confirma antes de enviar ao cliente.');
      }
      reload();
    } catch (e) {
      setErroSS(e.message);
    }
    setObtendoSS(false);
  };

  // RPA sobre o Portal das Finanças (api/_obterCertidaoFiscalAT.js) — não há
  // API oficial, ao contrário da SS. Corre só sob pedido manual (não em
  // cron), até se confirmar que aguenta o portal mudar de layout sem quebrar
  // — ver nota no ficheiro do RPA.
  const handleObterAT = async () => {
    setObtendoAT(true);
    setErroAT('');
    try {
      const res = await authFetch('/api/documentos-empresa/certidao-fiscal', { method: 'POST' });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || `Erro ${res.status}`);
      reload();
    } catch (e) {
      setErroAT(e.message);
    }
    setObtendoAT(false);
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button onClick={() => setPacoteOpen(true)} className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg shadow-sm transition-all font-black uppercase" style={{ backgroundColor: FT.orange, color: FT.navy }}>
          <Send size={14} /> <span className={SCALE.text.badge}>Preparar Pacote para Cliente</span>
        </button>
      </div>

      {erroSS && <p className="text-xs text-red-600 font-bold bg-red-50 rounded-lg p-2">{erroSS}</p>}
      {erroAT && <p className="text-xs text-red-600 font-bold bg-red-50 rounded-lg p-2">{erroAT}</p>}

      {loading ? (
        <div className="py-12 text-center opacity-40"><Loader2 className="animate-spin mx-auto" size={24} /></div>
      ) : (
        <div className="space-y-2">
          {TIPOS_DOCUMENTOS_EMPRESA.map((tipo) => {
            const mensal = TIPOS_DOCUMENTOS_EMPRESA_MENSAIS.includes(tipo);
            const doc = mensal ? null : porTipo[tipo];
            const status = mensal
              ? (porTipo[tipo]?.length ? 'disponivel' : 'falta')
              : (doc ? (getValidadeStatus(doc.data_validade) || 'disponivel') : 'falta');

            return (
              <div key={tipo} className="rounded-xl border border-[var(--border-soft)] bg-[var(--panel)] p-3.5">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className={`${SCALE.text.entityName} truncate`} style={{ fontFamily: FONT_TITLE }}>{tipo}</p>
                    {!mensal && doc && (
                      <p className={`${SCALE.text.meta} text-[var(--slate-dim)] mt-0.5`}>
                        {doc.nome_ficheiro} {doc.data_validade && getExpiryRelativeLabel(doc.data_validade) && `· ${getExpiryRelativeLabel(doc.data_validade).label}`}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <StatusBadge status={status} />
                    {!mensal && <DocActions doc={doc} label={tipo} onPreview={handlePreview} />}
                    {tipo === TIPO_SS_AUTOMATIZAVEL && (
                      <button onClick={handleObterSS} disabled={obtendoSS} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-[var(--border)] hover:bg-[var(--surface)] transition-all disabled:opacity-50">
                        {obtendoSS ? <Loader2 size={12} className="animate-spin" /> : <ShieldCheck size={12} />} <span className={SCALE.text.meta}>Obter da SS</span>
                      </button>
                    )}
                    {tipo === TIPO_AT_AUTOMATIZAVEL && (
                      <button onClick={handleObterAT} disabled={obtendoAT} title="RPA sobre o Portal das Finanças — sem API oficial, pode demorar ~30s" className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-[var(--border)] hover:bg-[var(--surface)] transition-all disabled:opacity-50">
                        {obtendoAT ? <Loader2 size={12} className="animate-spin" /> : <ShieldCheck size={12} />} <span className={SCALE.text.meta}>Obter da AT</span>
                      </button>
                    )}
                    <button onClick={() => setUploadTipo(tipo)} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-[var(--border)] hover:bg-[var(--surface)] transition-all">
                      <Upload size={12} /> <span className={SCALE.text.meta}>{mensal ? 'Adicionar mês' : 'Atualizar'}</span>
                    </button>
                  </div>
                </div>

                {mensal && (
                  <div className="flex flex-wrap gap-1.5 mt-2.5 pt-2.5 border-t border-[var(--border-soft)]">
                    {(porTipo[tipo] || []).length === 0 ? (
                      <p className={`${SCALE.text.meta} text-[var(--slate-dim)] italic`}>Nenhum mês disponível ainda.</p>
                    ) : (
                      porTipo[tipo].map((d) => (
                        <div key={d.id} className={`inline-flex items-center gap-1 pl-2 pr-1 py-1 rounded-lg bg-[var(--surface-dim)] ${SCALE.text.meta}`}>
                          <Calendar size={10} /> {d.periodo}
                          <DocActions doc={d} label={`${tipo} — ${d.periodo}`} onPreview={handlePreview} />
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {uploadTipo && (
        <UploadCompanyDocModal
          tipo={uploadTipo}
          mensal={TIPOS_DOCUMENTOS_EMPRESA_MENSAIS.includes(uploadTipo)}
          onClose={() => setUploadTipo(null)}
          onUploaded={reload}
        />
      )}

      <CompanyDocumentsPackageModal open={pacoteOpen} onClose={() => setPacoteOpen(false)} porTipo={porTipo} />

      <DocumentViewerModal key={previewDoc?.previewUrl} doc={previewDoc} onClose={() => setPreviewDoc(null)} />
    </div>
  );
}
