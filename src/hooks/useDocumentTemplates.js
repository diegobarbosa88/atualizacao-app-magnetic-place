import { useState, useCallback, useEffect } from 'react';
import {
  uploadTemplateFile,
  deleteTemplateFile,
  downloadTemplateBytes,
  extractTags,
  readFileAsArrayBuffer,
  renderDocx,
  buildRenderData,
  triggerDocxDownload,
  TEMPLATES_BUCKET,
} from '../utils/docxTemplateService';
import { sendWorkerDocumentEmail } from '../utils/emailUtils';
import { applyAdminStampToPage } from '../utils/pdfSigningService';
import { convertHtmlToPdf } from '../utils/pdfCoService';
import { DOC_STATUS } from '../constants/documentStatus';
import { inferirCategoria } from '../constants/rhCategories';
import { notifyEvent, TARGET } from '../utils/notifyEvent';
import { generateUniqueVerificationCode } from '../utils/verificationCode';
import QRCode from 'qrcode';

// Mesmo padrão de useSignatureStamp.jsx buildVerifyUrl, mas para a nova
// página pública de verificação por código (?view=verify-doc&code=...) —
// rota distinta da do Fluxo 2 (?view=verify&id=), que expõe dados a mais
// (ver plano desta sessão).
function buildVerifyDocUrl(code) {
  const origin = (typeof window !== 'undefined' && window.location)
    ? `${window.location.origin}${window.location.pathname}`
    : '';
  return `${origin}?view=verify-doc&code=${encodeURIComponent(code)}`;
}

// Mesma lógica de src/data/... não existe utilitário partilhado — versão
// mínima, igual à do servidor (api/formacao/index.js slugify), só para
// gerar o slug de um template na primeira vez que é marcado como
// obrigatório no Gate de Onboarding.
function slugify(texto) {
  return texto
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function useDocumentTemplates(supabase, { onError } = {}) {
  const [templates, setTemplates] = useState([]);
  const [generatedDocs, setGeneratedDocs] = useState([]);
  const [gateSlugsAtivos, setGateSlugsAtivos] = useState(() => new Set());
  const [loading, setLoading] = useState(false);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadGateItens = useCallback(async () => {
    if (!supabase) return;
    const { data } = await supabase
      .from('onboarding_gate_itens')
      .select('slug')
      .eq('tipo', 'documento')
      .eq('ativo', true);
    setGateSlugsAtivos(new Set((data || []).map(i => i.slug)));
  }, [supabase]);

  // Liga/desliga um template como documento obrigatório no Gate de
  // Onboarding. Gera o slug a partir do nome na primeira vez (nunca escrito
  // à mão pelo admin) — mesma lógica de api/formacao/index.js
  // handleGateRequisitosSet, para o lado das formações.
  const handleToggleGateRequisito = useCallback(async (template) => {
    if (!supabase) return;
    let slug = template.slug;
    if (!slug) {
      slug = slugify(template.name);
      const { error: slugError } = await supabase.from('document_templates').update({ slug }).eq('id', template.id);
      if (slugError) { onError?.(slugError); return; }
      setTemplates(prev => prev.map(t => t.id === template.id ? { ...t, slug } : t));
    }
    const novoAtivo = !gateSlugsAtivos.has(slug);
    const { error } = await supabase
      .from('onboarding_gate_itens')
      .upsert({ tipo: 'documento', slug, label: template.name, ativo: novoAtivo }, { onConflict: 'tipo,slug' });
    if (error) { onError?.(error); return; }
    await loadGateItens();
  }, [supabase, gateSlugsAtivos, loadGateItens, onError]);

  const loadTemplates = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('document_templates')
        .select('*')
        .order('name');
      if (error) throw error;
      setTemplates(data || []);
    } catch (err) {
      console.error('Erro ao carregar templates:', err);
      onError?.(err);
    } finally {
      setLoading(false);
    }
  }, [supabase, onError]);

  const loadGeneratedDocs = useCallback(async () => {
    if (!supabase) return;
    setLoadingDocs(true);
    try {
      const { data, error } = await supabase
        .from('worker_documents')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      setGeneratedDocs(data || []);
    } catch (err) {
      console.error('Erro ao carregar documentos:', err);
      onError?.(err);
    } finally {
      setLoadingDocs(false);
    }
  }, [supabase, onError]);

  useEffect(() => {
    if (!supabase) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setLoadingDocs(true);
      try {
        const [tmplRes, docsRes, gateRes] = await Promise.all([
          supabase.from('document_templates').select('*').order('name'),
          supabase.from('worker_documents').select('*').order('created_at', { ascending: false }).limit(200),
          supabase.from('onboarding_gate_itens').select('slug').eq('tipo', 'documento').eq('ativo', true),
        ]);
        if (cancelled) return;
        if (tmplRes.error) throw tmplRes.error;
        if (docsRes.error) throw docsRes.error;
        setTemplates(tmplRes.data || []);
        setGeneratedDocs(docsRes.data || []);
        setGateSlugsAtivos(new Set((gateRes.data || []).map(i => i.slug)));
      } catch (err) {
        if (!cancelled) console.error('Erro ao carregar dados:', err);
      } finally {
        if (!cancelled) {
          setLoading(false);
          setLoadingDocs(false);
        }
      }
    };
    load();
    return () => { cancelled = true; };
  }, [supabase]);

  useEffect(() => {
    if (!supabase) return;
    const upsert = (setter) => (row) => setter(prev => {
      const exists = prev.some(x => x.id === row.id);
      return exists ? prev.map(x => x.id === row.id ? row : x) : [row, ...prev];
    });
    const remove = (setter) => (row) => setter(prev => prev.filter(x => x.id !== row.id));

    const chDocs = supabase
      .channel('realtime-worker-documents-hook')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'worker_documents' }, (payload) => {
        if (payload.eventType === 'DELETE') remove(setGeneratedDocs)(payload.old);
        else upsert(setGeneratedDocs)(payload.new);
      }).subscribe();

    const chTemplates = supabase
      .channel('realtime-document-templates-hook')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'document_templates' }, (payload) => {
        if (payload.eventType === 'DELETE') remove(setTemplates)(payload.old);
        else upsert(setTemplates)(payload.new);
      }).subscribe();

    return () => {
      supabase.removeChannel(chDocs);
      supabase.removeChannel(chTemplates);
    };
  }, [supabase]);

  const handleUploadTemplate = useCallback(async ({
    name, description, file,
    stamp_x, stamp_y, stamp_page,
    stamp_admin_x, stamp_admin_y, stamp_admin_page,
  }) => {
    if (!supabase) throw new Error('Supabase não configurado');
    if (!name?.trim()) throw new Error('Nome é obrigatório');
    if (!file) throw new Error('Selecione um ficheiro .docx');
    const isDocx = file.name?.toLowerCase().endsWith('.docx')
      || file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    if (!isDocx) throw new Error('Apenas ficheiros Word (.docx) são suportados');

    setSaving(true);
    let uploadedPath = null;
    try {
      const arrayBuffer = await readFileAsArrayBuffer(file);
      const tags = extractTags(arrayBuffer);

      uploadedPath = await uploadTemplateFile(supabase, file);

      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from('document_templates')
        .insert([{
          name: name.trim(),
          description: description || '',
          template_docx_path: uploadedPath,
          template_fields: tags,
          stamp_x: stamp_x ?? 130,
          stamp_y: stamp_y ?? 30,
          stamp_page: stamp_page || 'last',
          stamp_admin_x: stamp_admin_x ?? 20,
          stamp_admin_y: stamp_admin_y ?? 30,
          stamp_admin_page: stamp_admin_page || 'last',
          created_at: now,
          updated_at: now,
        }])
        .select()
        .single();
      if (error) throw error;

      await loadTemplates();
      return data;
    } catch (err) {
      if (uploadedPath) {
        try { await deleteTemplateFile(supabase, uploadedPath); } catch (cleanupErr) { console.warn('[useDocumentTemplates] Falha na limpeza de ficheiro (best-effort):', cleanupErr); }
      }
      throw err;
    } finally {
      setSaving(false);
    }
  }, [supabase, loadTemplates]);

  const handleUpdateTemplate = useCallback(async ({
    id, name, description, file,
    stamp_x, stamp_y, stamp_page,
    stamp_admin_x, stamp_admin_y, stamp_admin_page,
    oldDocxPath,
  }) => {
    if (!supabase) throw new Error('Supabase não configurado');
    if (!id) throw new Error('ID do template é obrigatório');
    if (!name?.trim()) throw new Error('Nome é obrigatório');

    setSaving(true);
    let uploadedPath = null;
    try {
      const updateData = {
        name: name.trim(),
        description: description || '',
        stamp_x: stamp_x ?? 130,
        stamp_y: stamp_y ?? 30,
        stamp_page: stamp_page || 'last',
        stamp_admin_x: stamp_admin_x ?? 20,
        stamp_admin_y: stamp_admin_y ?? 30,
        stamp_admin_page: stamp_admin_page || 'last',
        updated_at: new Date().toISOString(),
      };

      // Se foi fornecido um novo ficheiro, fazer upload
      if (file) {
        const isDocx = file.name?.toLowerCase().endsWith('.docx')
          || file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
        if (!isDocx) throw new Error('Apenas ficheiros Word (.docx) são suportados');

        const arrayBuffer = await readFileAsArrayBuffer(file);
        const tags = extractTags(arrayBuffer);
        uploadedPath = await uploadTemplateFile(supabase, file);
        
        updateData.template_docx_path = uploadedPath;
        updateData.template_fields = tags;
      }

      const { data, error } = await supabase
        .from('document_templates')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;

      // Se foi feito upload de novo ficheiro e havia um antigo, apagar o antigo
      if (uploadedPath && oldDocxPath) {
        try { await deleteTemplateFile(supabase, oldDocxPath); } catch (cleanupErr) { console.warn('[useDocumentTemplates] Falha na limpeza de ficheiro (best-effort):', cleanupErr); }
      }

      await loadTemplates();
      return data;
    } catch (err) {
      // Se falhou e já tinha feito upload, limpar
      if (uploadedPath) {
        try { await deleteTemplateFile(supabase, uploadedPath); } catch (cleanupErr) { console.warn('[useDocumentTemplates] Falha na limpeza de ficheiro (best-effort):', cleanupErr); }
      }
      throw err;
    } finally {
      setSaving(false);
    }
  }, [supabase, loadTemplates]);

  const handleDeleteTemplate = useCallback(async (template) => {
    if (!supabase) return;
    if (!window.confirm('Apagar este template permanentemente?')) return;
    try {
      if (template?.template_docx_path) {
        await deleteTemplateFile(supabase, template.template_docx_path);
      }
      const { error } = await supabase
        .from('document_templates')
        .delete()
        .eq('id', template.id);
      if (error) throw error;
      await loadTemplates();
    } catch (err) {
      alert('Erro ao apagar: ' + err.message);
    }
  }, [supabase, loadTemplates]);

  const handleGenerateDocuments = useCallback(async (
    selectedTemplate,
    selectedWorkers,
    { onProgress, workersById, sendEmail = true, clientId = null } = {}
  ) => {
    if (!selectedTemplate || !selectedWorkers?.length) {
      throw new Error('Template ou trabalhadores não selecionados');
    }
    if (!supabase) throw new Error('Supabase não configurado');
    setSaving(true);

    const total = selectedWorkers.length;
    let succeeded = 0;
    let failed = 0;
    let emailsSent = 0;
    let emailsSkipped = 0;
    const errors = [];

    try {
      for (let i = 0; i < selectedWorkers.length; i++) {
        const workerId = selectedWorkers[i];
        const worker = workersById?.[workerId] || null;
        const workerName = worker?.name || workerId;

        onProgress?.({ current: i, total, workerId, workerName, status: 'pending' });

        try {
          const { data: inserted, error } = await supabase
            .from('worker_documents')
            .insert([{
              template_id: selectedTemplate.id,
              worker_id: workerId,
              client_id: clientId || null,
              title: selectedTemplate.name,
              status: 'pending',
              created_at: new Date().toISOString(),
              categoria: inferirCategoria(selectedTemplate.name) || null,
            }])
            .select()
            .single();
          if (error) throw error;
          succeeded++;

          // N1: notificar o trabalhador que tem um documento para assinar
          await notifyEvent(supabase, {
            idPrefix: 'notif',
            title: `📄 Novo documento para assinar`,
            message: `Tens um novo documento "${selectedTemplate.name}" para rever e assinar.`,
            type: 'info',
            target: TARGET.WORKER,
            targetWorkerIds: [workerId],
            payload: { kind: 'document_pending' },
          });

          if (sendEmail && worker?.email) {
            const ok = await sendWorkerDocumentEmail({
              workerEmail: worker.email,
              workerName: worker.name,
              documentTitle: selectedTemplate.name,
              documentId: inserted?.id,
            });
            if (ok) emailsSent++;
            else emailsSkipped++;
            onProgress?.({
              current: i + 1, total, workerId, workerName,
              status: ok ? 'ok' : 'email_failed',
            });
          } else {
            if (!worker?.email) emailsSkipped++;
            onProgress?.({
              current: i + 1, total, workerId, workerName,
              status: worker?.email ? 'ok' : 'no_email',
            });
          }
        } catch (err) {
          failed++;
          errors.push({ workerId, workerName, message: err.message });
          onProgress?.({
            current: i + 1, total, workerId, workerName,
            status: 'error', message: err.message,
          });
        }
      }

      await loadGeneratedDocs();
      return { total, succeeded, failed, emailsSent, emailsSkipped, errors };
    } finally {
      setSaving(false);
    }
  }, [supabase, loadGeneratedDocs]);

  const handleDownloadGenerated = useCallback(async (doc, systemSettings = {}) => {
    if (!supabase) throw new Error('Supabase não configurado');
    if (!doc.template_id) throw new Error('Documento sem template associado');

    const { data: tmpl, error: tErr } = await supabase
      .from('document_templates')
      .select('*')
      .eq('id', doc.template_id)
      .single();
    if (tErr) throw tErr;
    if (!tmpl?.template_docx_path) throw new Error('Template sem ficheiro .docx');

    const { data: worker, error: wErr } = await supabase
      .from('workers')
      .select('*')
      .eq('id', doc.worker_id)
      .single();
    if (wErr) throw wErr;

    let clientData = null;
    if (doc.client_id) {
      const { data: c } = await supabase.from('clients').select('*').eq('id', doc.client_id).maybeSingle();
      clientData = c || null;
    }

    const buffer = await downloadTemplateBytes(supabase, tmpl.template_docx_path);
    const renderData = buildRenderData(worker || {}, systemSettings, clientData);
    const blob = renderDocx(buffer, renderData);
    const safeTitle = (doc.title || 'documento').replace(/[\s/\\?%*:|"<>]+/g, '_');
    const safeWorker = (worker?.name || doc.worker_id || '').replace(/[\s/\\?%*:|"<>]+/g, '_');
    triggerDocxDownload(blob, `${safeTitle}_${safeWorker}.docx`);
  }, [supabase]);

  /**
   * Admin/responsável aprova um documento `awaiting_admin`:
   * 1. Faz download do PDF que o trabalhador assinou
   * 2. Aplica o carimbo da empresa na posição configurada no template
   * 3. Upload do PDF final
   * 4. Atualiza worker_documents: status='signed', admin_signed_at=now
   */
  const handleApproveDocument = useCallback(async (doc, { companyName, companySignature, adminIp, stampStyle } = {}) => {
    if (!supabase) throw new Error('Supabase não configurado');
    if (!doc?.id) throw new Error('Documento inválido');
    if (!companySignature?.signatureDataUrl) {
      throw new Error('Configura primeiro a assinatura da empresa nas Definições.');
    }

    setSaving(true);
    try {
      // 0. Buscar template — decide qual dos dois mecanismos usar
      const { data: tmpl, error: tErr } = await supabase
        .from('document_templates')
        .select('formato, stamp_admin_x, stamp_admin_y, stamp_admin_page')
        .eq('id', doc.template_id)
        .single();
      if (tErr) throw tErr;

      let publicUrl;
      let adminSignedAt;

      if (tmpl?.formato === 'html') {
        // Mecanismo novo (ver plano desta sessão): assinatura do admin
        // entra como <img> no próprio fluxo do HTML já assinado pelo
        // trabalhador, convertido para PDF num só passo — sem
        // coordenadas fixas nem segundo ficheiro no storage.
        if (!doc.generated_html || !doc.signature_data) throw new Error('Documento ainda não foi assinado pelo trabalhador');

        adminSignedAt = new Date().toISOString();

        // Código curto de verificação, gerado agora (não antes — só faz
        // sentido a partir do momento em que o documento fica "signed") e
        // gravado abaixo junto com o resto do update. QR opcional, mesmo
        // pacote/padrão já usado por useSignatureStamp.jsx (Fluxo 2).
        const { data: workerRow } = await supabase.from('workers').select('name').eq('id', doc.worker_id).maybeSingle();
        const verificationCode = await generateUniqueVerificationCode(workerRow?.name, supabase);
        let qrImgTag = '';
        try {
          const qrDataUrl = await QRCode.toDataURL(buildVerifyDocUrl(verificationCode), { errorCorrectionLevel: 'M', margin: 0, width: 120 });
          qrImgTag = `<img class="sign-qr" src="${qrDataUrl}" alt="QR de verificação" />`;
        } catch (qrErr) {
          console.warn('Falha a gerar QR de verificação (não bloqueia aprovação):', qrErr);
        }

        const finalHtml = doc.generated_html
          .replace('{worker_signature}', `<img src="${doc.signature_data}" alt="Assinatura do trabalhador" style="max-width:180px;max-height:64px;" />`)
          .replace(
            '{admin_stamp}',
            `<img src="${companySignature.signatureDataUrl}" alt="Assinatura da empresa" style="max-width:180px;max-height:64px;" />` +
            (companySignature.responsibleName ? `<p style="margin:4px 0 0;font-size:11px;">${companySignature.responsibleName}${companySignature.responsibleRole ? ' — ' + companySignature.responsibleRole : ''}</p>` : '')
          )
          .replaceAll('{verification_code}', verificationCode)
          .replaceAll('{verification_qr}', qrImgTag);

        const pdfBlob = await convertHtmlToPdf(finalHtml);
        const finalPath = `signed/${doc.id}_${Date.now()}.pdf`;
        const { error: upErr } = await supabase.storage
          .from(TEMPLATES_BUCKET)
          .upload(finalPath, pdfBlob, { contentType: 'application/pdf', upsert: true });
        if (upErr) throw upErr;
        const { data: pub } = supabase.storage.from(TEMPLATES_BUCKET).getPublicUrl(finalPath);
        publicUrl = pub?.publicUrl || finalPath;

        const { error: dbErr } = await supabase
          .from('worker_documents')
          .update({
            status: DOC_STATUS.SIGNED,
            admin_signed_at: adminSignedAt,
            signed_pdf_url: publicUrl,
            generated_html: finalHtml,
            verification_code: verificationCode,
          })
          .eq('id', doc.id);
        if (dbErr) throw dbErr;
      } else {
        // Mecanismo atual (docx) — sem alteração de comportamento.
        if (!doc.signed_pdf_url) throw new Error('Documento ainda não foi assinado pelo trabalhador');

        // 2. Download do PDF assinado pelo trabalhador
        const res = await fetch(doc.signed_pdf_url);
        if (!res.ok) throw new Error('Falha a obter PDF assinado: ' + res.status);
        const pdfBlob = await res.blob();

        // Buscar logo da Magnetic Place
        let companyLogoBytes = null;
        try {
          const logoRes = await fetch('/icon-512x512.png');
          if (logoRes.ok) companyLogoBytes = await logoRes.arrayBuffer();
        } catch (e) { console.warn('Falha a obter logo:', e); }

        // 3. Aplicar admin stamp
        adminSignedAt = new Date().toISOString();
        const finalPdfBytes = await applyAdminStampToPage(pdfBlob, {
          companyName: companyName || '',
          responsibleName: companySignature.responsibleName || '',
          responsibleRole: companySignature.responsibleRole || '',
          signatureDataUrl: companySignature.signatureDataUrl,
          companyLogoBytes,
          signedAt: adminSignedAt,
          ip: adminIp,
          id: doc.id,
          stampStyle,
          xMm: tmpl?.stamp_admin_x ?? 20,
          yMm: tmpl?.stamp_admin_y ?? 30,
          page: tmpl?.stamp_admin_page || 'last',
        });
        const finalBlob = new Blob([finalPdfBytes], { type: 'application/pdf' });

        // 4. Upload (sobrescreve o anterior)
        const finalPath = `signed/${doc.id}_admin_${Date.now()}.pdf`;
        const { error: upErr } = await supabase.storage
          .from(TEMPLATES_BUCKET)
          .upload(finalPath, finalBlob, { contentType: 'application/pdf', upsert: true });
        if (upErr) throw upErr;
        const { data: pub } = supabase.storage.from(TEMPLATES_BUCKET).getPublicUrl(finalPath);
        publicUrl = pub?.publicUrl || finalPath;

        // 5. Atualiza o registo
        const { error: dbErr } = await supabase
          .from('worker_documents')
          .update({
            status: DOC_STATUS.SIGNED,
            admin_signed_at: adminSignedAt,
            signed_pdf_url: publicUrl,
          })
          .eq('id', doc.id);
        if (dbErr) throw dbErr;
      }

      // N3: notificar o trabalhador que o documento foi aprovado
      await notifyEvent(supabase, {
        idPrefix: 'notif_approved',
        title: `✅ Documento aprovado`,
        message: `O teu documento "${doc.title || doc.nome_ficheiro || 'documento'}" foi aprovado e assinado pela empresa.`,
        type: 'success',
        target: TARGET.WORKER,
        targetWorkerIds: [doc.worker_id],
        payload: { document_id: doc.id, kind: 'document_approved' },
      });

      await loadGeneratedDocs();
      return { signedPdfUrl: publicUrl, adminSignedAt };
    } finally {
      setSaving(false);
    }
  }, [supabase, loadGeneratedDocs]);

  const handleDeleteDoc = useCallback(async (id) => {
    if (!window.confirm('Apagar este documento gerado?')) return;
    if (!supabase) return;
    try {
      const { error } = await supabase.from('worker_documents').delete().eq('id', id);
      if (error) throw error;
      await loadGeneratedDocs();
    } catch (err) {
      alert('Erro ao apagar: ' + err.message);
    }
  }, [supabase, loadGeneratedDocs]);

  return {
    templates,
    generatedDocs,
    gateSlugsAtivos,
    loading,
    loadingDocs,
    saving,
    loadTemplates,
    loadGeneratedDocs,
    loadGateItens,
    handleUploadTemplate,
    handleUpdateTemplate,
    handleDeleteTemplate,
    handleGenerateDocuments,
    handleDownloadGenerated,
    handleDeleteDoc,
    handleApproveDocument,
    handleToggleGateRequisito,
  };
}
