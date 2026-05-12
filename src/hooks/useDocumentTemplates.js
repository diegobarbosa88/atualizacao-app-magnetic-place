import { useState, useCallback, useEffect } from 'react';
import { replaceTemplateFields, TEMPLATE_FIELDS } from '../utils/templateFields';

export const DEFAULT_TEMPLATE = '';

const DEFAULT_PLACEHOLDERS = [
  { id: 'qrcode', elementId: 'worker-qrcode-placeholder', text: 'QR CODE', x: 0, y: 0, fontSize: 8, fontWeight: 'bold' },
  { id: 'carimbo', elementId: 'worker-signature-placeholder', text: 'ASSINATURA', x: 0, y: 0, fontSize: 9, fontWeight: 'bold' }
];

export const PLACEHOLDER_IDS = {
  SIGNATURE: 'worker-signature-placeholder',
  QRCODE: 'worker-qrcode-placeholder'
};

export const PLACEHOLDER_ELEMENTS = {
  'worker-qrcode-placeholder': { label: 'QR Code', defaultX: 0, defaultY: 0 },
  'worker-signature-placeholder': { label: 'Assinatura', defaultX: 0, defaultY: 0 }
};

export const SIGNATURE_PLACEHOLDER_HTML = `<div id="worker-signature-placeholder" style="position:absolute; left:0px; top:0px; width:290px;">
  <div style="width:290px;height:80px;border:2px dashed #10b981;border-radius:14px;display:flex;align-items:center;justify-content:center;background:rgba(16,185,129,0.1);page-break-inside:avoid;break-inside:avoid;">
    <span style="font-size:9px;font-weight:900;color:#10b981;text-transform:uppercase;letter-spacing:0.1em;font-family:'Inter',sans-serif;">Assinatura</span>
  </div>
</div>`;

export const QRCODE_PLACEHOLDER_HTML = `<div id="worker-qrcode-placeholder" style="position:absolute; left:0px; top:0px; width:100px; height:100px;">
  <div style="width:100%;height:100%;border:2px dashed #6366f1;border-radius:14px;display:flex;align-items:center;justify-content:center;background:rgba(99,102,241,0.1);page-break-inside:avoid;break-inside:avoid;">
    <span style="font-size:8px;font-weight:900;color:#6366f1;text-transform:uppercase;letter-spacing:0.05em;font-family:'Inter',sans-serif;">QR Code</span>
  </div>
</div>`;

export function extractPositionsFromHtml(html) {
  if (!html) return {};
  const positions = {};
  const ids = [PLACEHOLDER_IDS.SIGNATURE, PLACEHOLDER_IDS.QRCODE];
  ids.forEach(id => {
    if (!id) return;
    const openTag = '<div id="' + id + '"';
    let idx = html.indexOf(openTag);
    if (idx === -1) return;
    const styleStart = html.indexOf('style="', idx);
    if (styleStart === -1 || styleStart > idx + 300) return;
    const styleEnd = html.indexOf('"', styleStart + 7);
    if (styleEnd === -1) return;
    const styleVal = html.substring(styleStart + 7, styleEnd);
    let leftVal = '0px';
    let topVal = '0px';
    const leftIdx = styleVal.indexOf('left:');
    if (leftIdx !== -1) {
      const pxIdx = styleVal.indexOf('px', leftIdx + 5);
      if (pxIdx !== -1) {
        leftVal = styleVal.substring(leftIdx + 5, pxIdx + 2);
      } else {
        const semiIdx = styleVal.indexOf(';', leftIdx + 5);
        leftVal = styleVal.substring(leftIdx + 5, semiIdx !== -1 ? semiIdx : styleVal.length).trim() + 'px';
      }
    }
    const topIdx = styleVal.indexOf('top:');
    if (topIdx !== -1) {
      const pxIdx = styleVal.indexOf('px', topIdx + 4);
      if (pxIdx !== -1) {
        topVal = styleVal.substring(topIdx + 4, pxIdx + 2);
      } else {
        const semiIdx = styleVal.indexOf(';', topIdx + 4);
        topVal = styleVal.substring(topIdx + 4, semiIdx !== -1 ? semiIdx : styleVal.length).trim() + 'px';
      }
    }
    positions[id] = { left: leftVal, top: topVal };
  });
  return positions;
}

export function replacePlaceholdersWithComponents(html, worker, positions = {}) {
  if (!html) return html;
  let result = html;

  const signatureId = PLACEHOLDER_IDS.SIGNATURE;
  const qrcodeId = PLACEHOLDER_IDS.QRCODE;

  const htmlPositions = extractPositionsFromHtml(html);

  const signaturePos = positions[signatureId] || htmlPositions[signatureId] || {};
  const qrcodePos = positions[qrcodeId] || htmlPositions[qrcodeId] || {};

  const signatureStyle = `position:absolute;left:${signaturePos.left || '0px'};top:${signaturePos.top || '0px'};width:290px;`;
  const qrcodeStyle = `position:absolute;left:${qrcodePos.left || '0px'};top:${qrcodePos.top || '0px'};width:100px;height:100px;`;

  const escapedSignatureId = signatureId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const escapedQrcodeId = qrcodeId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  const signatureRegex = new RegExp(`<div([^>]*)\\sid="${escapedSignatureId}"([^>]*)>[\\s\\S]*?</div>`, 'gi');
  const qrcodeRegex = new RegExp(`<div([^>]*)\\sid="${escapedQrcodeId}"([^>]*)>[\\s\\S]*?</div>`, 'gi');

  const signatureHtml = `<div id="${signatureId}" style="${signatureStyle}">
  <div style="width:290px;height:80px;border:2px solid #10b981;border-radius:14px;display:flex;align-items:center;justify-content:center;background:rgba(16,185,129,0.05);page-break-inside:avoid;break-inside:avoid;">
    <span style="font-size:9px;font-weight:600;color:#10b981;font-family:Arial,sans-serif;">${worker?.name || 'Assinatura do Trabalhador'}</span>
  </div>
</div>`;

  const qrcodeHtml = `<div id="${qrcodeId}" style="${qrcodeStyle}">
  <div style="width:100%;height:100%;border:2px solid #6366f1;border-radius:8px;display:flex;align-items:center;justify-content:center;background:rgba(99,102,241,0.05);page-break-inside:avoid;break-inside:avoid;">
    <span style="font-size:7px;font-weight:600;color:#6366f1;font-family:Arial,sans-serif;text-align:center;">QR Code<br>${worker?.name || ''}</span>
  </div>
</div>`;

  result = result.replace(signatureRegex, signatureHtml);
  result = result.replace(qrcodeRegex, qrcodeHtml);

  return result;
}

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
      console.error("Erro ao carregar templates:", err);
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
      console.error("Erro ao carregar documentos:", err);
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

  const handleSave = useCallback(async (previewData, editingId) => {
    if (!previewData.name.trim()) throw new Error("Nome é obrigatório");
    if (!supabase) throw new Error("Supabase não configurado");
    setSaving(true);
    try {
      const payload = {
        name: previewData.name,
        description: previewData.description,
        html_content: previewData.html_content,
        updated_at: new Date().toISOString()
      };
      if (editingId) {
        const { error } = await supabase
          .from('document_templates')
          .update(payload)
          .eq('id', editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('document_templates')
          .insert([payload]);
        if (error) throw error;
      }
      await loadTemplates();
    } finally {
      setSaving(false);
    }
  }, [supabase, loadTemplates]);

  const handleDeleteTemplate = useCallback(async (id) => {
    if (!window.confirm("Apagar este template permanentemente?")) return;
    if (!supabase) return;
    try {
      const { error } = await supabase
        .from('document_templates')
        .delete()
        .eq('id', id);
      if (error) throw error;
      await loadTemplates();
    } catch (err) {
      alert("Erro ao apagar: " + err.message);
    }
  }, [supabase, loadTemplates]);

  const handleGenerateDocuments = useCallback(async (selectedTemplate, selectedWorkers, workers, systemSettings, positions = {}) => {
    if (!selectedTemplate || selectedWorkers.length === 0) throw new Error("Template ou trabalhadores não selecionados");
    if (!supabase) throw new Error("Supabase não configurado");
    setSaving(true);
    try {
      const promises = selectedWorkers.map(async (workerId) => {
        const worker = workers.find(w => w.id === workerId);
        if (!worker) return;
        let generatedHtml = replaceTemplateFields(selectedTemplate.html_content, worker, systemSettings);
        generatedHtml = replacePlaceholdersWithComponents(generatedHtml, worker, positions);
        const newDoc = {
          template_id: selectedTemplate.id,
          worker_id: workerId,
          title: selectedTemplate.name,
          generated_html: generatedHtml,
          status: 'pending',
          created_at: new Date().toISOString()
        };
        const { error } = await supabase.from('worker_documents').insert([newDoc]);
        if (error) throw error;
      });
      const results = await Promise.allSettled(promises);
      const failed = results.filter(r => r.status === 'rejected');
      await loadGeneratedDocs();
      return { total: results.length, failed: failed.length, results };
    } finally {
      setSaving(false);
    }
  }, [supabase, loadGeneratedDocs]);

  const handleGenerateAI = useCallback(async (aiPrompt) => {
    if (!aiPrompt.trim()) throw new Error("Descreva o que deseja gerar");
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (!apiKey) throw new Error("API Key do Gemini não configurada");
    const sanitizedPrompt = aiPrompt.trim().slice(0, 500).replace(/["""]/g, '');
    const prompt = `
      Aja como um especialista em documentos legais e administrativos.
      Gere um template de documento HTML para: "${sanitizedPrompt}".
      
      REGRAS CRÍTICAS:
      1. Use apenas HTML puro e classes do Tailwind CSS v3.
      2. Estrutura obrigatória: O conteúdo principal deve estar dentro de uma div com a classe "document-container".
      3. Use estes placeholders exatos onde apropriado:
         ${TEMPLATE_FIELDS.map(f => `${f.tag} (${f.label})`).join(', ')}
      4. O design deve ser profissional, limpo e pronto para impressão (A4).
      5. Retorne APENAS o código HTML completo, começando com <!DOCTYPE html> e terminando com </html>. Não inclua explicações ou markdown.
      6. Garanta que o estilo no <head> seja compatível com visualização profissional.
    `;
    const configured = import.meta.env.VITE_GEMINI_MODEL;
    const modelCandidates = [
      configured,
      'gemini-2.5-flash',
      'gemini-2.0-flash-001',
      'gemini-1.5-flash-latest',
      'gemini-1.5-flash-002',
      'gemini-1.5-flash-8b',
      'gemini-1.5-pro-latest',
      'gemini-pro',
    ].filter(Boolean);
    let response;
    let lastErrorMsg = '';
    let usedModel = '';
    for (const m of modelCandidates) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${apiKey}`;
      response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
      });
      if (response.ok) {
        usedModel = m;
        break;
      }
      try {
        const errData = await response.clone().json();
        lastErrorMsg = errData.error?.message || `HTTP ${response.status}`;
        if (response.status !== 404) break;
      } catch {
        lastErrorMsg = `HTTP ${response.status}`;
      }
    }
    if (!response || !response.ok) {
      throw new Error(lastErrorMsg || 'Nenhum modelo Gemini disponível para esta API key.');
    }
    const data = await response.json();
    const finishReason = data.candidates?.[0]?.finishReason;
    if (finishReason === 'SAFETY' || finishReason === 'RECITATION') {
      throw new Error(`A IA recusou gerar o conteúdo (${finishReason}). Reformule o pedido.`);
    }
    let generatedHtml = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    generatedHtml = generatedHtml.replace(/^```html\n?/, '').replace(/\n?```$/, '').trim();
    if (!generatedHtml || (!generatedHtml.includes('<!DOCTYPE') && !generatedHtml.includes('<html'))) {
      throw new Error("A IA não retornou HTML válido. Reformule o pedido.");
    }
    return generatedHtml;
  }, []);

  const handleDownloadSigned = useCallback(async (doc) => {
    if (!doc.signed_pdf_url) throw new Error("Documento não assinado");
    const response = await fetch(doc.signed_pdf_url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const safeName = `${doc.title || 'documento'}_${doc.worker?.name || 'colaborador'}_assinado.pdf`.replace(/[\s/\\?%*:|"<>]+/g, '_');
    a.download = safeName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, []);

  const handleDeleteDoc = useCallback(async (id) => {
    if (!window.confirm("Apagar este documento gerado?")) return;
    if (!supabase) return;
    try {
      const { error } = await supabase.from('worker_documents').delete().eq('id', id);
      if (error) throw error;
      await loadGeneratedDocs();
    } catch (err) {
      alert("Erro ao apagar: " + err.message);
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
    handleSave,
    handleDeleteTemplate,
    handleGenerateDocuments,
    handleGenerateAI,
    handleDownloadSigned,
    handleDeleteDoc,
    replaceTemplateFields,
    replacePlaceholdersWithComponents,
    extractPositionsFromHtml,
    DEFAULT_TEMPLATE,
    DEFAULT_PLACEHOLDERS,
    PLACEHOLDER_ELEMENTS,
    PLACEHOLDER_IDS,
    SIGNATURE_PLACEHOLDER_HTML,
    QRCODE_PLACEHOLDER_HTML
  };
}
