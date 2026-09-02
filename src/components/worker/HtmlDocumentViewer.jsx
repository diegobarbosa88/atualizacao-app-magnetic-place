import React, { useCallback, useEffect, useState } from 'react';
import { Loader2, AlertCircle, FileSignature, X, RefreshCw } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { replaceTemplateFields } from '../../utils/templateFields';
import { applyLayoutOverride } from '../../utils/templateLayoutSettings';
import { DOC_STATUS } from '../../constants/documentStatus';
import SignDrawModal from './SignDrawModal';
import FitToWidthHtmlFrame from '../common/FitToWidthHtmlFrame';

// Irmão de DocumentViewer.jsx, para documentos com document_templates.formato
// = 'html' — a assinatura entra como <img> normal dentro do próprio fluxo
// do HTML (substitui {worker_signature}), nunca por coordenadas fixas sobre
// um PDF já gerado. Sem chamada a PDF.co aqui: só se gera PDF depois de o
// admin aprovar (ver useDocumentTemplates.js handleApproveDocument), para
// não deixar um PDF intermédio órfão no storage.
export function HtmlDocumentViewer({ document: docRecord, onBack, onSigned }) {
  const { supabase, systemSettings } = useApp();
  const [workerData, setWorkerData] = useState(null);
  const [filledHtml, setFilledHtml] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [showSignature, setShowSignature] = useState(false);
  const [workerIp, setWorkerIp] = useState('Desconhecido');

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  useEffect(() => {
    fetch('https://api.ipify.org?format=json')
      .then(r => r.json()).then(d => setWorkerIp(d.ip || 'Desconhecido'))
      .catch(() => setWorkerIp('Desconhecido'));
  }, []);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const { data: workerRow, error: wErr } = await supabase
          .from('workers').select('*').eq('id', docRecord.worker_id).single();
        if (wErr) throw wErr;

        const { data: tmplRow, error: tErr } = await supabase
          .from('document_templates').select('*').eq('id', docRecord.template_id).single();
        if (tErr) throw tErr;
        if (!tmplRow.template_html) throw new Error('Template não tem conteúdo HTML associado.');

        let clientRow = null;
        if (docRecord.client_id) {
          const { data: c } = await supabase
            .from('clients').select('*').eq('id', docRecord.client_id).maybeSingle();
          clientRow = c || null;
        }

        const { data: epiCatalogo } = await supabase.from('epi_catalogo_documento').select('*');

        if (cancelled) return;
        setWorkerData(workerRow || {});
        const filled = applyLayoutOverride(
          replaceTemplateFields(tmplRow.template_html, workerRow || {}, systemSettings || {}, clientRow, epiCatalogo || []),
          tmplRow.layout_settings
        );
        setFilledHtml(filled);
      } catch (err) {
        console.error('Erro ao carregar documento HTML:', err);
        if (!cancelled) setError(err.message || 'Erro a carregar o documento.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [supabase, docRecord.worker_id, docRecord.template_id, docRecord.client_id, systemSettings]);

  const applySignature = useCallback(async (signatureDataUrl) => {
    setShowSignature(false);
    setSaving(true);
    setError('');
    try {
      const signedAt = new Date().toISOString();

      // Guarda o HTML preenchido (com {worker_signature}/{admin_stamp}
      // ainda por resolver) e a assinatura em bruto separadamente — a
      // aprovação do admin resolve as duas tags de uma vez a partir daqui
      // (useDocumentTemplates.js handleApproveDocument), em vez de mutar o
      // texto em duas passagens sucessivas.
      const { error: dbErr } = await supabase
        .from('worker_documents')
        .update({
          generated_html: filledHtml,
          signature_data: signatureDataUrl,
          status: DOC_STATUS.AWAITING_ADMIN,
          signed_at: signedAt,
          signed_ip: workerIp,
        })
        .eq('id', docRecord.id);
      if (dbErr) throw dbErr;

      onSigned?.();
    } catch (err) {
      console.error('applySignature (html) erro:', err);
      setError(err.message || 'Falha a aplicar assinatura.');
    }
    setSaving(false);
  }, [filledHtml, supabase, workerIp, docRecord.id, onSigned]);

  const canSign = !loading && !saving && !error && !!filledHtml;

  // O cartão de assinaturas ({worker_signature}/{admin_stamp}/QR/código)
  // não tem nada de útil para mostrar aqui — ninguém assinou ainda, fica só
  // com texto placeholder. Escondido só nesta pré-visualização (display-only,
  // não mexe no HTML gravado nem no que o admin resolve na aprovação).
  const previewHtml = filledHtml
    ? filledHtml.replace('</body>', '<style>.stamp-block{display:none!important}</style></body>')
    : '';

  return (
    <div
      className="w-[90vw] h-[90vh] max-w-5xl bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden"
      onClick={(e) => e.stopPropagation()}
    >
      <header className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)] flex-shrink-0">
        <h2 className="text-base sm:text-lg font-black text-[var(--ink)] truncate pr-4">
          {docRecord.title}
        </h2>
        <button
          onClick={onBack}
          disabled={saving}
          className="p-2 text-[var(--slate)] hover:text-[var(--ink-soft)] hover:bg-[var(--surface)] rounded-xl disabled:opacity-50 flex-shrink-0"
          title="Fechar"
        >
          <X className="w-5 h-5" />
        </button>
      </header>

      <div className="flex-1 min-h-0 bg-[var(--surface)] relative">
        {error ? (
          <div className="h-full flex items-center justify-center p-6">
            <div className="flex items-start gap-3 p-4 bg-[var(--tone-rose-bg)] border border-[var(--tone-rose-border)] rounded-xl text-sm text-[var(--tone-rose)] max-w-md">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          </div>
        ) : loading ? (
          <div className="h-full flex items-center justify-center text-[var(--slate)]">
            <Loader2 className="w-8 h-8 animate-spin" />
          </div>
        ) : (
          <FitToWidthHtmlFrame html={previewHtml} title={docRecord.title} />
        )}

        {saving && (
          <div className="absolute inset-0 bg-white/70 backdrop-blur-[2px] flex items-center justify-center">
            <div className="bg-white rounded-2xl shadow-xl px-6 py-4 flex items-center gap-3">
              <Loader2 className="w-5 h-5 text-[var(--navy)] animate-spin" />
              <span className="text-sm font-bold text-[var(--ink-soft)]">A processar assinatura...</span>
            </div>
          </div>
        )}
      </div>

      <footer className="flex-shrink-0 border-t border-[var(--border)] px-4 sm:px-6 py-4 bg-white">
        {error && (
          <div className="mb-3 flex items-start gap-2 p-3 bg-[var(--tone-rose-bg)] border border-[var(--tone-rose-border)] rounded-xl text-xs text-[var(--tone-rose)]">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span className="flex-1">{error}</span>
            <button
              onClick={() => setError('')}
              className="px-2 py-1 bg-[var(--tone-rose-bg)] hover:bg-[var(--tone-rose-border)] rounded-md text-xs font-bold flex items-center gap-1"
            >
              <RefreshCw className="w-3 h-3" /> Fechar aviso
            </button>
          </div>
        )}
        <button
          onClick={() => setShowSignature(true)}
          disabled={!canSign}
          className="w-full py-3 sm:py-4 bg-[var(--orange)] text-white font-black uppercase tracking-wider rounded-2xl hover:bg-[var(--orange-deep)] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm transition-colors"
        >
          {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <FileSignature className="w-5 h-5" />}
          {saving ? 'A processar assinatura...' : loading ? 'A carregar...' : 'Assinar Digitalmente'}
        </button>
      </footer>

      {showSignature && (
        <SignDrawModal
          onClose={() => !saving && setShowSignature(false)}
          onSign={(dataUrl) => applySignature(dataUrl)}
          workerName={workerData?.name}
          working={saving}
        />
      )}
    </div>
  );
}

export default HtmlDocumentViewer;
