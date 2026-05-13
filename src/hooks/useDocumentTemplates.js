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
} from '../utils/docxTemplateService';
import { sendWorkerDocumentEmail } from '../utils/emailUtils';

export function useDocumentTemplates(supabase, { onError } = {}) {
  const [templates, setTemplates] = useState([]);
  const [generatedDocs, setGeneratedDocs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [saving, setSaving] = useState(false);

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
        const [tmplRes, docsRes] = await Promise.all([
          supabase.from('document_templates').select('*').order('name'),
          supabase.from('worker_documents').select('*').order('created_at', { ascending: false }).limit(200)
        ]);
        if (cancelled) return;
        if (tmplRes.error) throw tmplRes.error;
        if (docsRes.error) throw docsRes.error;
        setTemplates(tmplRes.data || []);
        setGeneratedDocs(docsRes.data || []);
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

  const handleUploadTemplate = useCallback(async ({ name, description, file, stamp_x, stamp_y, stamp_page }) => {
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
        try { await deleteTemplateFile(supabase, uploadedPath); } catch (_) { /* best-effort */ }
      }
      throw err;
    } finally {
      setSaving(false);
    }
  }, [supabase, loadTemplates]);

  const handleUpdateTemplate = useCallback(async ({ id, name, description, file, stamp_x, stamp_y, stamp_page, oldDocxPath }) => {
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
        try { await deleteTemplateFile(supabase, oldDocxPath); } catch (_) { /* best-effort */ }
      }

      await loadTemplates();
      return data;
    } catch (err) {
      // Se falhou e já tinha feito upload, limpar
      if (uploadedPath) {
        try { await deleteTemplateFile(supabase, uploadedPath); } catch (_) { /* best-effort */ }
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
    { onProgress, workersById, sendEmail = true } = {}
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
              title: selectedTemplate.name,
              status: 'pending',
              created_at: new Date().toISOString(),
            }])
            .select()
            .single();
          if (error) throw error;
          succeeded++;

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

    const buffer = await downloadTemplateBytes(supabase, tmpl.template_docx_path);
    const renderData = buildRenderData(worker || {}, systemSettings);
    const blob = renderDocx(buffer, renderData);
    const safeTitle = (doc.title || 'documento').replace(/[\s/\\?%*:|"<>]+/g, '_');
    const safeWorker = (worker?.name || doc.worker_id || '').replace(/[\s/\\?%*:|"<>]+/g, '_');
    triggerDocxDownload(blob, `${safeTitle}_${safeWorker}.docx`);
  }, [supabase]);

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
    loading,
    loadingDocs,
    saving,
    loadTemplates,
    loadGeneratedDocs,
    handleUploadTemplate,
    handleUpdateTemplate,
    handleDeleteTemplate,
    handleGenerateDocuments,
    handleDownloadGenerated,
    handleDeleteDoc,
  };
}
