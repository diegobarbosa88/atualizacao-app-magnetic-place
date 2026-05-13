import { useState, useCallback, useEffect } from 'react';
import { replaceTemplateFields, TEMPLATE_FIELDS } from '../utils/templateFields';

export const DEFAULT_TEMPLATE = '';

export function blocksToHtml(blocks, worker, systemSettings = {}) {
  if (!blocks || !Array.isArray(blocks) || blocks.length === 0) {
    return '';
  }

  const sortedBlocks = [...blocks].sort((a, b) => (a.order || 0) - (b.order || 0));

  let html = '<div class="document-container">\n';

  sortedBlocks.forEach(block => {
    switch (block.type) {
      case 'title':
        html += `  <h1 class="font-black text-2xl text-slate-800 mb-4">${escapeHtml(block.content || '')}</h1>\n`;
        break;
      case 'subtitle':
        html += `  <h2 class="font-bold text-base text-slate-600 mb-3">${escapeHtml(block.content || '')}</h2>\n`;
        break;
      case 'paragraph': {
        let content = block.content || '';
        if (worker && Object.keys(worker).length > 0) {
          content = replaceTemplateFields(content, worker, systemSettings);
        }
        html += `  <p class="text-slate-700 mb-4 leading-relaxed">${escapeHtml(content)}</p>\n`;
        break;
      }
      case 'signature':
        html += `  <div class="mt-8 pt-6 border-t border-slate-200 page-break-inside-avoid">
    <div class="w-full h-24 bg-amber-50 border-2 border-dashed border-amber-200 rounded-2xl flex items-center justify-center">
      <span class="text-[10px] font-bold text-amber-600 uppercase tracking-widest">Assinatura</span>
    </div>
  </div>\n`;
        break;
    }
  });

  html += '</div>\n';
  return html;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

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

export const SIGNATURE_PLACEHOLDER_HTML = `<div id="worker-signature-placeholder" class="mt-8 pt-6 border-t border-slate-100 opacity-30 page-break-inside-avoid" style="position:absolute; left:0px; top:0px; width:290px;">
  <div class="flex flex-col items-end">
    <div class="w-56 h-16 border-2 border-dashed border-slate-300 rounded-2xl flex items-center justify-center">
      <span class="text-[8px] font-black text-slate-400 uppercase tracking-widest">Aguardando Assinatura</span>
    </div>
  </div>
</div>`;

export const QRCODE_PLACEHOLDER_HTML = `<div id="worker-qrcode-placeholder" style="position:absolute; left:0px; top:0px; width:100px; height:100px;">
  <div style="width:100px;height:100px;border:2px dashed #6366f1;border-radius:14px;display:flex;align-items:center;justify-content:center;background:rgba(99,102,241,0.1);page-break-inside:avoid;break-inside:avoid;">
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

  const replaceStyle = (styleStr, newStyle) => {
    const posIdx = styleStr.indexOf('position:');
    if (posIdx !== -1) {
      const semiAfterPos = styleStr.indexOf(';', posIdx);
      return styleStr.substring(0, posIdx) + newStyle + styleStr.substring(semiAfterPos + 1);
    }
    return newStyle + styleStr;
  };

  const ids = [signatureId, qrcodeId];
  const styles = [signatureStyle, qrcodeStyle];

  ids.forEach((id, i) => {
    if (!id) return;
    const escapedId = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const openTag = '<div id="' + escapedId + '"';
    let idx = result.indexOf(openTag);
    while (idx !== -1) {
      const styleStart = result.indexOf('style="', idx);
      if (styleStart === -1 || styleStart > idx + 300) break;
      const styleEndQuote = result.indexOf('"', styleStart + 7);
      if (styleEndQuote === -1) break;
      const styleVal = result.substring(styleStart + 7, styleEndQuote);
      const updated = replaceStyle(styleVal, styles[i]);
      result = result.substring(0, styleStart + 7) + updated + result.substring(styleEndQuote + 1);
      idx = result.indexOf(openTag, idx + 1);
    }
  });

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

  const handleSave = useCallback(async (previewData, editingId, blocks = []) => {
    if (!previewData.name.trim()) throw new Error("Nome é obrigatório");
    if (!supabase) throw new Error("Supabase não configurado");
    setSaving(true);
    try {
      const payload = {
        name: previewData.name,
        description: previewData.description || '',
        blocks: JSON.stringify(blocks),
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

  const handleGenerateDocuments = useCallback(async (selectedTemplate, selectedWorkers, workers, systemSettings) => {
    if (!selectedTemplate || selectedWorkers.length === 0) throw new Error("Template ou trabalhadores não selecionados");
    if (!supabase) throw new Error("Supabase não configurado");
    setSaving(true);
    try {
      const templateBlocks = typeof selectedTemplate.blocks === 'string'
        ? JSON.parse(selectedTemplate.blocks)
        : (selectedTemplate.blocks || []);

      if (templateBlocks.length === 0) {
        throw new Error("Template não tem blocos definidos");
      }

      const promises = selectedWorkers.map(async (workerId) => {
        const worker = workers.find(w => w.id === workerId);
        if (!worker) return;
        const generatedHtml = blocksToHtml(templateBlocks, worker, systemSettings);
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
    const sanitizedPrompt = aiPrompt.trim().slice(0, 500).replace(/["""]/g, '');

    const SYSTEM_PROMPT = `Você é um especialista jurídico e de RH. Gere documentos profissionais em português.
Seu trabalho é retornar EXCLUSIVAMENTE um array JSON válido com blocos documentais.
Não retorne HTML, Markdown, ou qualquer outro formato além de JSON puro.
Cada bloco DEVE ter: id (formato: "bloco_1", "bloco_2", etc.), type, e content.

TIPOS DE BLOCOS PERMITIDOS:
- "title": Título principal do documento (ex: "CONTRATO DE TRABALHO")
- "subtitle": Subtítulo ou cláusula (ex: "CLÁUSULA 1.ª — OBJECTO")
- "paragraph": Texto normal do documento (pode conter variáveis {{variavel}})
- "signature": Bloco de assinaturas FINAL (content DEVE ser string vazia "")

VARIÁVEIS PERMITIDAS:
${TEMPLATE_FIELDS.map(f => `  - ${f.tag} (${f.label})`).join('\n')}

REGRAS OBRIGATÓRIAS:
1. Array JSON válido, sem texto adicional fora do array
2. Blocos em sequência lógica (título → cláusulas → texto → assinatura)
3. Documento completo e profissional para impressão A4
4. Usar português formal
5. Para "signature", content = ""
6. IDs únicos: "bloco_1", "bloco_2", "bloco_3", etc.
7. NUNCA retorne HTML ou markdown`;

    const USER_PROMPT = `Gere um documento para: "${sanitizedPrompt}"

Array JSON de blocos:`;

    const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
    const openaiModel = import.meta.env.VITE_OPENAI_MODEL;
    const geminiApiKey = import.meta.env.VITE_GEMINI_API_KEY;

    let blocks;

    // OpenAI path
    if (apiKey) {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: openaiModel || 'gpt-4o-mini',
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: USER_PROMPT }
          ],
          response_format: { type: 'json_object' },
          temperature: 0.3
        })
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error?.message || `OpenAI API error: ${response.status}`);
      }

      const data = await response.json();
      const generatedText = data.choices?.[0]?.message?.content || '';

      try {
        const parsed = JSON.parse(generatedText);
        blocks = parsed.blocks || parsed.document || parsed.content || [];
        if (!Array.isArray(blocks)) {
          if (typeof parsed === 'object' && !Array.isArray(parsed)) {
            const firstKey = Object.keys(parsed)[0];
            const possibleArray = parsed[firstKey];
            if (Array.isArray(possibleArray)) {
              blocks = possibleArray;
            } else {
              throw new Error("JSON returned is not an array of blocks");
            }
          } else {
            throw new Error("JSON returned is not an array of blocks");
          }
        }
      } catch {
        const cleaned = generatedText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        try {
          const parsed = JSON.parse(cleaned);
          blocks = parsed.blocks || parsed.document || parsed.content || [];
        } catch {
          throw new Error("A IA não retornou JSON válido de blocos. Reformule o pedido.");
        }
      }
    }
    // Gemini path
    else if (geminiApiKey) {
      const configured = import.meta.env.VITE_GEMINI_MODEL;
      const modelCandidates = [
        configured,
        'gemini-2.5-flash',
        'gemini-2.0-flash-001',
        'gemini-1.5-flash-latest',
        'gemini-1.5-flash-002',
        'gemini-1.5-flash-8b',
      ].filter(Boolean);

      let response;
      let lastErrorMsg = '';
      for (const m of modelCandidates) {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${geminiApiKey}`;
        response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: `${SYSTEM_PROMPT}\n\n${USER_PROMPT}` }] }],
            generationConfig: { temperature: 0.3 }
          })
        });
        if (response.ok) break;
        try {
          const errData = await response.clone().json();
          lastErrorMsg = errData.error?.message || `HTTP ${response.status}`;
          if (response.status !== 404) break;
        } catch {
          lastErrorMsg = `HTTP ${response.status}`;
        }
      }

      if (!response?.ok) {
        throw new Error(lastErrorMsg || 'Nenhum modelo disponível.');
      }

      const data = await response.json();
      const finishReason = data.candidates?.[0]?.finishReason;
      if (finishReason === 'SAFETY' || finishReason === 'RECITATION') {
        throw new Error(`A IA recusou gerar o conteúdo (${finishReason}).`);
      }

      let generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      generatedText = generatedText.replace(/^```json\n?/g, '').replace(/^```\n?/g, '').replace(/\n?```$/g, '').trim();

      try {
        blocks = JSON.parse(generatedText);
      } catch {
        throw new Error("A IA não retornou JSON válido.");
      }
    }
    else {
      throw new Error("Nenhuma API Key configurada (OpenAI ou Gemini)");
    }

    if (!Array.isArray(blocks) || blocks.length === 0) {
      throw new Error("A IA não retornou blocos válidos.");
    }

    const validTypes = ['title', 'subtitle', 'paragraph', 'signature'];
    blocks.forEach((block, index) => {
      if (!block.id) block.id = `bloco_${index + 1}`;
      if (!block.type || !validTypes.includes(block.type)) {
        throw new Error(`Bloco ${index + 1} tem tipo inválido: ${block.type}`);
      }
      if (block.type === 'signature') block.content = '';
    });

    return blocks;
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
    QRCODE_PLACEHOLDER_HTML,
    blocksToHtml
  };
}
