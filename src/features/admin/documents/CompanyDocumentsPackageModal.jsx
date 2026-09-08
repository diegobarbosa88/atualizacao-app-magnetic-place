import React, { useEffect, useState } from 'react';
import { PDFDocument } from 'pdf-lib';
import JSZip from 'jszip';
import { FileDown, FileArchive, Send, AlertTriangle, Loader2, CheckCircle2 } from 'lucide-react';
import { useApp } from '../../../context/AppContext';
import { authFetch } from '../../../utils/authFetch';
import ModalShell from '../../../components/common/ModalShell';
import { FT, SCALE } from '../../../styles/designTokens';
import { TIPOS_DOCUMENTOS_EMPRESA, TIPOS_DOCUMENTOS_EMPRESA_MENSAIS } from '../../../constants/companyDocuments';

const slugify = (s) => (s || '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

async function fetchPdfBytes(url) {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Falha ao descarregar documento (${resp.status})`);
  return resp.arrayBuffer();
}

// Pacote de documentos da EMPRESA (não de um trabalhador) — mesmo padrão do
// ClientDocumentsPackageModal.jsx, mas o destinatário é escolhido aqui (não
// há worker_client_history a apontar um cliente atual). "Pronto" é só
// existir — nenhum destes documentos passa por assinatura digital.
export default function CompanyDocumentsPackageModal({ open, onClose, porTipo }) {
  const { supabase, clients } = useApp();
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState('');
  const [clienteId, setClienteId] = useState('');
  const [confirmandoEnvio, setConfirmandoEnvio] = useState(false);
  const [ultimoEnvio, setUltimoEnvio] = useState(null);
  const [enviado, setEnviado] = useState(null);

  useEffect(() => {
    if (!open) return;
    setError('');
    setEnviado(null);
    setClienteId('');
  }, [open]);

  useEffect(() => {
    if (!open || !supabase || !clienteId) { setUltimoEnvio(null); return; }
    supabase.from('documentos_empresa_envios').select('enviado_em')
      .eq('client_id', clienteId).order('enviado_em', { ascending: false }).limit(1).maybeSingle()
      .then(({ data }) => setUltimoEnvio(data?.enviado_em || null));
  }, [open, supabase, clienteId]);

  if (!open) return null;

  // Resolve a URL "pronta" de cada tipo: mensal usa o período mais recente
  // (porTipo[tipo] é já um array ordenado desc); os restantes um objeto único.
  const resolvidos = TIPOS_DOCUMENTOS_EMPRESA.map((tipo) => {
    const mensal = TIPOS_DOCUMENTOS_EMPRESA_MENSAIS.includes(tipo);
    const doc = mensal ? (porTipo[tipo]?.[0] || null) : porTipo[tipo];
    return { tipo, url: doc?.url || null };
  });
  const prontos = resolvidos.filter((r) => r.url);
  const emFalta = resolvidos.filter((r) => !r.url);
  const algumPronto = prontos.length > 0;
  const todosProntos = prontos.length === TIPOS_DOCUMENTOS_EMPRESA.length;

  const nomeCliente = clients?.find((c) => c.id === clienteId)?.name || '';

  const handlePdfUnico = async () => {
    setBusy('pdf');
    setError('');
    try {
      const merged = await PDFDocument.create();
      for (const { url } of prontos) {
        const bytes = await fetchPdfBytes(url);
        const src = await PDFDocument.load(bytes);
        const paginas = await merged.copyPages(src, src.getPageIndices());
        paginas.forEach((p) => merged.addPage(p));
      }
      const bytes = await merged.save();
      downloadBlob(new Blob([bytes], { type: 'application/pdf' }), 'documentos-empresa-magnetic-place.pdf');
    } catch (e) {
      setError('Erro ao juntar PDFs: ' + e.message);
    }
    setBusy(null);
  };

  const handleZip = async () => {
    setBusy('zip');
    setError('');
    try {
      const zip = new JSZip();
      for (const { tipo, url } of prontos) {
        const bytes = await fetchPdfBytes(url);
        zip.file(`${slugify(tipo)}.pdf`, bytes);
      }
      const blob = await zip.generateAsync({ type: 'blob' });
      downloadBlob(blob, 'documentos-empresa-magnetic-place.zip');
    } catch (e) {
      setError('Erro ao gerar ZIP: ' + e.message);
    }
    setBusy(null);
  };

  const confirmarEnvio = async () => {
    setBusy('email');
    setError('');
    try {
      const res = await authFetch('/api/documentos-empresa/enviar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: clienteId }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || `Erro ${res.status}`);
      setEnviado(body.enviado_em || new Date().toISOString());
      setUltimoEnvio(body.enviado_em || new Date().toISOString());
      setConfirmandoEnvio(false);
    } catch (e) {
      setError(e.message);
    }
    setBusy(null);
  };

  return (
    <ModalShell isOpen={open} onClose={onClose} title="Pacote de Documentos da Empresa" size="sm">
      <div className="p-5 space-y-3">
        <div className="space-y-1">
          <label className={`${SCALE.text.statLabel} text-[var(--slate-dim)]`}>Cliente destinatário</label>
          <select
            value={clienteId}
            onChange={(e) => setClienteId(e.target.value)}
            disabled={!!busy}
            className="w-full p-3 rounded-xl border border-[var(--border)] bg-white text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">Selecionar cliente...</option>
            {(clients || []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        {!todosProntos && (
          <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl p-3">
            <AlertTriangle size={14} className="text-amber-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-xs font-bold text-amber-700">Ainda faltam documentos:</p>
              <ul className="text-xs text-amber-700 list-disc pl-4 mt-1">
                {emFalta.map((x) => <li key={x.tipo}>{x.tipo}</li>)}
              </ul>
            </div>
          </div>
        )}

        {(ultimoEnvio || enviado) && clienteId && (
          <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2">
            <CheckCircle2 size={13} className="text-emerald-600 flex-shrink-0" />
            <span className={`${SCALE.text.meta} text-emerald-700 font-bold`}>
              Enviado em {new Date(enviado || ultimoEnvio).toLocaleDateString('pt-PT')}
            </span>
          </div>
        )}

        {error && <p className="text-xs text-red-600 font-bold bg-red-50 rounded-lg p-2">{error}</p>}

        {!confirmandoEnvio ? (
          <div className="space-y-2">
            <button
              onClick={handlePdfUnico}
              disabled={!algumPronto || !!busy}
              className="w-full flex items-center justify-center gap-2 disabled:opacity-50 py-2.5 rounded-xl font-bold text-xs border border-[var(--border)] hover:bg-[var(--surface)] transition-all"
            >
              {busy === 'pdf' ? <Loader2 size={14} className="animate-spin" /> : <FileDown size={14} />}
              PDF único{!todosProntos && algumPronto ? ` (${prontos.length}/${TIPOS_DOCUMENTOS_EMPRESA.length})` : ''}
            </button>
            <button
              onClick={handleZip}
              disabled={!algumPronto || !!busy}
              className="w-full flex items-center justify-center gap-2 disabled:opacity-50 py-2.5 rounded-xl font-bold text-xs border border-[var(--border)] hover:bg-[var(--surface)] transition-all"
            >
              {busy === 'zip' ? <Loader2 size={14} className="animate-spin" /> : <FileArchive size={14} />}
              ZIP{!todosProntos && algumPronto ? ` (${prontos.length}/${TIPOS_DOCUMENTOS_EMPRESA.length})` : ''}
            </button>
            <button
              onClick={() => setConfirmandoEnvio(true)}
              disabled={!algumPronto || !!busy || !clienteId}
              title={!clienteId ? 'Escolhe primeiro o cliente destinatário' : undefined}
              className="w-full flex items-center justify-center gap-2 disabled:opacity-50 py-2.5 rounded-xl font-black text-xs uppercase shadow-lg transition-all"
              style={{ backgroundColor: FT.orange, color: FT.navy }}
            >
              <Send size={14} /> Enviar por Email ao Cliente
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-[var(--ink-soft)]">
              {todosProntos ? (
                <>Enviar os {TIPOS_DOCUMENTOS_EMPRESA.length} documentos da empresa para <b>{nomeCliente}</b>?</>
              ) : (
                <>Enviar {prontos.length} de {TIPOS_DOCUMENTOS_EMPRESA.length} documentos da empresa para <b>{nomeCliente}</b> — os restantes ainda não estão disponíveis?</>
              )}
            </p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmandoEnvio(false)} disabled={busy === 'email'} className="flex-1 px-4 py-2 rounded-xl bg-slate-100 text-slate-600 text-sm font-semibold disabled:opacity-50">
                Cancelar
              </button>
              <button
                onClick={confirmarEnvio}
                disabled={busy === 'email'}
                className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-50"
                style={{ backgroundColor: FT.orange, color: FT.navy }}
              >
                {busy === 'email' ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                Confirmar Envio
              </button>
            </div>
          </div>
        )}
      </div>
    </ModalShell>
  );
}
