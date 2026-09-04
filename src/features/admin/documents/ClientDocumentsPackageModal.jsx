import React, { useEffect, useState } from 'react';
import { PDFDocument } from 'pdf-lib';
import JSZip from 'jszip';
import { FileDown, FileArchive, Send, AlertTriangle, Loader2, CheckCircle2 } from 'lucide-react';
import { useApp } from '../../../context/AppContext';
import { authFetch } from '../../../utils/authFetch';
import ModalShell from '../../../components/common/ModalShell';
import { FT, SCALE } from '../../../styles/designTokens';
import { TIPOS_DOCUMENTOS_CLIENTE } from '../../../constants/clientDocuments';

const slugify = (s) => (s || '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');

const fmtDataHora = (d) => new Date(d).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric' });

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

// Pacote de 3 documentos assinados (Registo de Formação Interna, Termo de
// Responsabilidade EPI, Registo de Riscos) para o cliente do trabalhador —
// PDF único, ZIP, ou envio direto por email. Os PDFs já existem em storage
// (signedPdfUrl de cada doc, resolvido por WorkerPastaView via
// unifyDocuments) — isto só junta/descarrega, não gera nada de novo.
export default function ClientDocumentsPackageModal({ open, onClose, worker, docsCliente }) {
  const { supabase } = useApp();
  const [busy, setBusy] = useState(null); // 'pdf' | 'zip' | 'email' | null
  const [error, setError] = useState('');
  const [confirmandoEnvio, setConfirmandoEnvio] = useState(false);
  const [clienteEmail, setClienteEmail] = useState(null);
  const [carregandoCliente, setCarregandoCliente] = useState(false);
  const [ultimoEnvio, setUltimoEnvio] = useState(null);
  const [enviado, setEnviado] = useState(null);

  useEffect(() => {
    if (!open || !supabase || !worker) return;
    setError('');
    setEnviado(null);
    supabase
      .from('documentos_cliente_envios')
      .select('enviado_em')
      .eq('worker_id', worker.workerId)
      .order('enviado_em', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => setUltimoEnvio(data?.enviado_em || null));
  }, [open, supabase, worker]);

  if (!open || !worker) return null;

  // "pronto" exige estado 'signed', não só a existência de signedPdfUrl —
  // o Registo de Formação Interna tem sempre um PDF anexado assim que é
  // exportado (mesmo em 'Pendente', ver RegistoIndividualTab.jsx), então só
  // olhar para a URL deixaria enviar um registo por assinar ao cliente.
  const prontos = docsCliente.filter((x) => x.doc?.state === 'signed' && x.doc?.signedPdfUrl);
  const todosProntos = prontos.length === TIPOS_DOCUMENTOS_CLIENTE.length;

  const nomeBase = `${slugify(worker.workerName)}`;

  const handlePdfUnico = async () => {
    setBusy('pdf');
    setError('');
    try {
      const merged = await PDFDocument.create();
      for (const { doc } of docsCliente) {
        const bytes = await fetchPdfBytes(doc.signedPdfUrl);
        const src = await PDFDocument.load(bytes);
        const paginas = await merged.copyPages(src, src.getPageIndices());
        paginas.forEach((p) => merged.addPage(p));
      }
      const bytes = await merged.save();
      downloadBlob(new Blob([bytes], { type: 'application/pdf' }), `documentos-${nomeBase}.pdf`);
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
      for (const { tipo, doc } of docsCliente) {
        const bytes = await fetchPdfBytes(doc.signedPdfUrl);
        zip.file(`${slugify(tipo)}.pdf`, bytes);
      }
      const blob = await zip.generateAsync({ type: 'blob' });
      downloadBlob(blob, `documentos-${nomeBase}.zip`);
    } catch (e) {
      setError('Erro ao gerar ZIP: ' + e.message);
    }
    setBusy(null);
  };

  const abrirConfirmacaoEnvio = async () => {
    setError('');
    setCarregandoCliente(true);
    try {
      const { data: historico, error: histErr } = await supabase
        .from('worker_client_history')
        .select('client_id')
        .eq('worker_id', worker.workerId)
        .is('data_fim', null)
        .maybeSingle();
      if (histErr) throw histErr;
      if (!historico?.client_id) throw new Error('Este trabalhador não tem cliente atual atribuído.');
      const { data: cliente, error: clienteErr } = await supabase
        .from('clients').select('name, email').eq('id', historico.client_id).maybeSingle();
      if (clienteErr) throw clienteErr;
      if (!cliente?.email) throw new Error(`O cliente "${cliente?.name || ''}" não tem email configurado.`);
      setClienteEmail(cliente.email);
      setConfirmandoEnvio(true);
    } catch (e) {
      setError(e.message);
    }
    setCarregandoCliente(false);
  };

  const confirmarEnvio = async () => {
    setBusy('email');
    setError('');
    try {
      const res = await authFetch('/api/documentos-cliente/enviar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ worker_id: worker.workerId }),
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
    <ModalShell isOpen={open} onClose={onClose} title="Pacote para Cliente" meta={worker.workerName} icon={<Send size={18} />} size="sm">
      <div className="p-5 space-y-3">
        {!todosProntos && (
          <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl p-3">
            <AlertTriangle size={14} className="text-amber-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-xs font-bold text-amber-700">Ainda faltam documentos assinados:</p>
              <ul className="text-xs text-amber-700 list-disc pl-4 mt-1">
                {docsCliente.filter((x) => !(x.doc?.state === 'signed' && x.doc?.signedPdfUrl)).map((x) => <li key={x.tipo}>{x.tipo}</li>)}
              </ul>
            </div>
          </div>
        )}

        {(ultimoEnvio || enviado) && (
          <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2">
            <CheckCircle2 size={13} className="text-emerald-600 flex-shrink-0" />
            <span className={`${SCALE.text.meta} text-emerald-700 font-bold`}>Enviado em {fmtDataHora(enviado || ultimoEnvio)}</span>
          </div>
        )}

        {error && <p className="text-xs text-red-600 font-bold bg-red-50 rounded-lg p-2">{error}</p>}

        {!confirmandoEnvio ? (
          <div className="space-y-2">
            <button
              onClick={handlePdfUnico}
              disabled={!todosProntos || !!busy}
              className="w-full flex items-center justify-center gap-2 disabled:opacity-50 py-2.5 rounded-xl font-bold text-xs border border-[var(--border)] hover:bg-[var(--surface)] transition-all"
            >
              {busy === 'pdf' ? <Loader2 size={14} className="animate-spin" /> : <FileDown size={14} />}
              PDF único
            </button>
            <button
              onClick={handleZip}
              disabled={!todosProntos || !!busy}
              className="w-full flex items-center justify-center gap-2 disabled:opacity-50 py-2.5 rounded-xl font-bold text-xs border border-[var(--border)] hover:bg-[var(--surface)] transition-all"
            >
              {busy === 'zip' ? <Loader2 size={14} className="animate-spin" /> : <FileArchive size={14} />}
              ZIP
            </button>
            <button
              onClick={abrirConfirmacaoEnvio}
              disabled={!todosProntos || !!busy || carregandoCliente}
              className="w-full flex items-center justify-center gap-2 disabled:opacity-50 py-2.5 rounded-xl font-black text-xs uppercase shadow-lg transition-all"
              style={{ backgroundColor: FT.orange, color: FT.navy }}
            >
              {carregandoCliente ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              Enviar por Email ao Cliente
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-[var(--ink-soft)]">
              Enviar os 3 documentos de <b>{worker.workerName}</b> para <b>{clienteEmail}</b>?
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
