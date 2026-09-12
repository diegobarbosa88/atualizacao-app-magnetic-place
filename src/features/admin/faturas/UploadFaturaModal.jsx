import React, { useState, useEffect } from 'react';
import { Camera, Upload, X, Loader2, AlertTriangle, Save, FileText } from 'lucide-react';
import { useApp } from '../../../context/AppContext';
import { callGeminiVision } from '../../../utils/aiUtils';
import { FT, SCALE } from '../../../styles/designTokens';
import ModalShell from '../../../components/common/ModalShell';

const readFileAsBase64 = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = (e) => resolve(e.target.result.split(',')[1]);
  reader.onerror = reject;
  reader.readAsDataURL(file);
});

const slugify = (s) => (s || '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-zA-Z0-9.]+/g, '_').replace(/_+/g, '_');

// Mesmos campos já extraídos pelas faturas importadas via Gmail/TOConline
// (ver api/parse-fatura.js buildFaturaPrompt), adaptado para leitura direta
// de imagem em vez de texto — mantém os dois caminhos a produzirem o mesmo
// formato de `dados`.
const PROMPT = `És um especialista em leitura de faturas portuguesas e europeias. Analisa a imagem/PDF de uma fatura de fornecedor e extrai os seguintes campos com rigor:

- numero_fatura: número/referência da fatura (ex: "FT 2024/123", "2024-456"). NÃO confundas com número de encomenda, guia ou cliente.
- data_fatura: data de emissão da fatura em formato YYYY-MM-DD. NÃO uses a data de vencimento.
- nif_fornecedor: identificador fiscal de quem EMITE a fatura, em qualquer formato europeu — português (NIF/NIPC, 9 dígitos numéricos), espanhol (NIF/CIF, uma letra seguida de 8 dígitos, ex: "B64076482"), ou outro. Procura rótulos como "NIF:", "NIPC:", "CIF:", "VAT:", "Tax ID:", "N.I.F.". Extrai tal como aparece no documento (sem espaços). NÃO uses o NIF do cliente/destinatário.
- fornecedor: nome legal completo da empresa que EMITE a fatura (não o cliente — a Magnetic Place é sempre o cliente/destinatário).
- valor_total: valor total da fatura com IVA incluído (número decimal, ex: 1234.56). NÃO incluas encargos adicionais, imposto de selo, juros de mora nem outros acréscimos que apareçam depois do total da fatura.
- iva: valor monetário total do IVA (não a taxa percentual, mas o montante em euros).
- iban: IBAN da conta bancária do fornecedor, se presente no documento. Formato PTXX... ou outro IBAN europeu. Se não existir, usa null.

Regras importantes:
- Se um campo não existir claramente no documento, usa null.
- Para valor_total e iva usa sempre número decimal (ex: 123.45), nunca string.
- iban deve estar em formato limpo sem espaços.
- Para datas, converte formatos como "15/03/2024" para "2024-03-15".
- Responde EXCLUSIVAMENTE em JSON válido, sem texto antes ou depois, sem markdown, nesta estrutura:
{ "numero_fatura": "string ou null", "data_fatura": "YYYY-MM-DD ou null", "nif_fornecedor": "string ou null", "fornecedor": "string ou null", "valor_total": "número ou null", "iva": "número ou null", "iban": "string ou null" }

Se a imagem não parecer uma fatura, devolve todos os campos como null.`;

const EMPTY_FORM = { fornecedor: '', nifFornecedor: '', numeroFatura: '', dataFatura: '', valorTotal: '', iva: '', iban: '', descricao: '' };

export default function UploadFaturaModal({ open, onClose, onSaved }) {
  const { supabase, systemSettings } = useApp();
  const [step, setStep] = useState('upload');
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState('');
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    if (!file || !file.type.startsWith('image/')) { setPreviewUrl(''); return; }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const reset = () => {
    setStep('upload');
    setFile(null);
    setPreviewUrl('');
    setScanning(false);
    setScanError('');
    setForm(EMPTY_FORM);
    setSaving(false);
    setSaveError('');
  };

  const handleClose = () => { reset(); onClose(); };

  const handleFileChange = (fileList) => {
    const f = fileList?.[0];
    if (f) setFile(f);
  };

  const handleAnalyze = async () => {
    if (!file) return;
    setScanning(true);
    setScanError('');
    try {
      const base64 = await readFileAsBase64(file);
      const raw = await callGeminiVision(base64, file.type || 'image/jpeg', PROMPT, systemSettings.geminiApiKey);
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('Sem JSON na resposta: ' + raw.substring(0, 200));
      const data = JSON.parse(jsonMatch[0]);
      setForm({
        fornecedor: data.fornecedor || '',
        nifFornecedor: data.nif_fornecedor || '',
        numeroFatura: data.numero_fatura || '',
        dataFatura: data.data_fatura || '',
        valorTotal: data.valor_total != null ? String(data.valor_total) : '',
        iva: data.iva != null ? String(data.iva) : '',
        iban: data.iban || '',
        descricao: '',
      });
    } catch (err) {
      setScanError(err.message);
    } finally {
      setScanning(false);
      setStep('review');
    }
  };

  const updateForm = (patch) => setForm((prev) => ({ ...prev, ...patch }));

  const handleSave = async () => {
    if (!file) return;
    setSaveError('');
    setSaving(true);
    try {
      const ts = Date.now();
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
      const storagePath = `manual/${ts}_${slugify(file.name) || `fatura.${ext}`}`;
      const { error: upErr } = await supabase.storage.from('faturas').upload(storagePath, file, { contentType: file.type || 'image/jpeg', upsert: true });
      if (upErr) throw upErr;
      const { data: urlData } = supabase.storage.from('faturas').getPublicUrl(storagePath);

      const valorTotal = form.valorTotal !== '' ? parseFloat(form.valorTotal) : null;
      const iva = form.iva !== '' ? parseFloat(form.iva) : null;

      const { error: insertErr } = await supabase.from('faturas').insert({
        filename: file.name,
        storage_path: storagePath,
        url: urlData.publicUrl,
        mime_type: file.type || 'image/jpeg',
        tamanho: file.size,
        tipo: 'fornecedor',
        fonte: 'manual',
        entidade: form.fornecedor || null,
        descricao: form.descricao || null,
        valor: valorTotal,
        data_documento: form.dataFatura || null,
        dados: {
          numero_fatura: form.numeroFatura || null,
          fornecedor: form.fornecedor || null,
          data_fatura: form.dataFatura || null,
          valor_total: valorTotal,
          iva,
          nif_fornecedor: form.nifFornecedor || null,
          iban: form.iban || null,
        },
      });
      if (insertErr) throw insertErr;

      setSaving(false);
      onSaved();
      handleClose();
    } catch (err) {
      setSaving(false);
      setSaveError('Erro ao guardar fatura: ' + err.message);
    }
  };

  const fieldClass = "w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs";
  const labelClass = `${SCALE.text.meta} text-[var(--slate-dim)] block mb-0.5`;

  return (
    <ModalShell
      isOpen={open}
      onClose={handleClose}
      busy={scanning}
      title="Subir Fatura"
      meta={step === 'review' ? file?.name : undefined}
      icon={<Camera size={20} />}
      size="lg"
    >
      <div className="p-5 space-y-4">
        {step === 'upload' && (
          <>
            <p className="text-xs text-[var(--slate-dim)]">
              Tira uma foto da fatura na hora ou escolhe uma imagem/PDF já guardado. A IA tenta ler fornecedor, número, data e valores — confirma ou ajusta antes de gravar.
            </p>

            <div
              className="border-2 border-dashed border-[var(--border)] rounded-2xl p-8 text-center cursor-pointer hover:border-[var(--slate)] hover:bg-[var(--surface)] transition-all"
              onClick={() => document.getElementById('upload-fatura-input')?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); handleFileChange(e.dataTransfer.files); }}
            >
              <div className="flex flex-col items-center gap-2 text-[var(--slate-dim)]">
                <Camera size={32} />
                <p className="font-bold text-sm">Tira uma foto ou clica para carregar</p>
                <p className="text-xs">JPG, PNG, WEBP ou PDF</p>
              </div>
              <input id="upload-fatura-input" type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => handleFileChange(e.target.files)} />
            </div>

            {file && (
              <div className="flex items-center gap-3 bg-[var(--surface)] rounded-xl border border-[var(--border-soft)] px-3 py-2.5">
                {previewUrl
                  ? <img src={previewUrl} alt="" className="w-12 h-12 object-cover rounded-lg flex-shrink-0" />
                  : <FileText size={20} className="text-[var(--slate)] flex-shrink-0" />}
                <span className="text-xs font-bold text-[var(--ink-mid)] truncate flex-1">{file.name}</span>
                <span className={`${SCALE.text.meta} text-[var(--slate-dim)] flex-shrink-0`}>{(file.size / 1024).toFixed(0)} KB</span>
                <button onClick={() => setFile(null)} className="text-[var(--slate)] hover:text-red-400 transition-colors flex-shrink-0"><X size={12} /></button>
              </div>
            )}

            {!systemSettings.geminiApiKey && file && (
              <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-700 font-bold">
                <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
                Sem chave API Gemini configurada nas Definições — podes continuar e preencher os campos à mão.
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={handleAnalyze}
                disabled={!file || scanning || !systemSettings.geminiApiKey}
                className="flex-1 flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed py-3 rounded-xl font-black text-sm uppercase shadow-lg transition-all"
                style={{ backgroundColor: FT.orange, color: FT.navy }}
              >
                {scanning ? <Loader2 size={16} className="animate-spin" /> : <Camera size={16} />}
                Ler com IA
              </button>
              <button
                onClick={() => { setForm(EMPTY_FORM); setStep('review'); }}
                disabled={!file}
                className="flex-1 flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed py-3 rounded-xl font-bold text-xs uppercase transition-colors border border-[var(--border)] text-[var(--slate-dim)] hover:text-[var(--ink-mid)]"
              >
                Preencher à mão
              </button>
            </div>
          </>
        )}

        {step === 'review' && (
          <>
            {scanError && (
              <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl p-3 text-xs text-red-600 font-semibold whitespace-pre-line">
                <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
                Não foi possível ler o documento automaticamente ({scanError}). Preenche os campos à mão.
              </div>
            )}

            <div className="flex gap-4">
              {previewUrl && (
                <img src={previewUrl} alt="" className="w-24 h-24 object-cover rounded-xl border border-[var(--border-soft)] flex-shrink-0" />
              )}
              <div className="grid grid-cols-2 gap-2.5 flex-1">
                <div className="col-span-2">
                  <label className={labelClass}>Fornecedor</label>
                  <input type="text" value={form.fornecedor} onChange={(e) => updateForm({ fornecedor: e.target.value })} className={fieldClass} />
                </div>
                <div>
                  <label className={labelClass}>NIF Fornecedor</label>
                  <input type="text" value={form.nifFornecedor} onChange={(e) => updateForm({ nifFornecedor: e.target.value })} className={fieldClass} />
                </div>
                <div>
                  <label className={labelClass}>Nº Fatura</label>
                  <input type="text" value={form.numeroFatura} onChange={(e) => updateForm({ numeroFatura: e.target.value })} className={fieldClass} />
                </div>
                <div>
                  <label className={labelClass}>Data</label>
                  <input type="date" value={form.dataFatura} onChange={(e) => updateForm({ dataFatura: e.target.value })} className={fieldClass} />
                </div>
                <div>
                  <label className={labelClass}>Valor Total (€)</label>
                  <input type="number" step="0.01" min="0" value={form.valorTotal} onChange={(e) => updateForm({ valorTotal: e.target.value })} className={`${fieldClass} font-bold`} />
                </div>
                <div>
                  <label className={labelClass}>IVA (€)</label>
                  <input type="number" step="0.01" min="0" value={form.iva} onChange={(e) => updateForm({ iva: e.target.value })} className={fieldClass} />
                </div>
                <div>
                  <label className={labelClass}>IBAN</label>
                  <input type="text" value={form.iban} onChange={(e) => updateForm({ iban: e.target.value })} className={fieldClass} />
                </div>
              </div>
            </div>

            <div>
              <label className={labelClass}>Descrição (opcional)</label>
              <input type="text" value={form.descricao} onChange={(e) => updateForm({ descricao: e.target.value })} placeholder="Ex.: Material de escritório" className={fieldClass} />
            </div>

            <p className={`${SCALE.text.meta} text-[var(--slate-dim)]`}>Entra como fatura pendente — só conta como despesa depois de reconciliada com o extrato bancário, como qualquer outra.</p>

            {saveError && <p className="text-xs text-red-600 font-bold bg-red-50 rounded-lg p-2">{saveError}</p>}

            <div className="flex gap-2">
              <button
                onClick={() => { setStep('upload'); setScanError(''); }}
                className="flex-1 flex items-center justify-center gap-1.5 text-[var(--slate-dim)] hover:text-[var(--ink-mid)] py-2.5 rounded-xl font-bold text-xs uppercase transition-colors border border-[var(--border)]"
              >
                Voltar
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 flex items-center justify-center gap-1.5 disabled:opacity-50 py-2.5 rounded-xl font-black text-xs uppercase shadow-lg transition-all"
                style={{ backgroundColor: FT.orange, color: FT.navy }}
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                Guardar Fatura
              </button>
            </div>
          </>
        )}
      </div>
    </ModalShell>
  );
}
