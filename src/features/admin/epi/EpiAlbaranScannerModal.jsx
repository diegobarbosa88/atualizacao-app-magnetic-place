import React, { useState } from 'react';
import { ScanSearch, Upload, X, Loader2, AlertTriangle, CheckCircle2, PackagePlus, RefreshCw } from 'lucide-react';
import { useApp } from '../../../context/AppContext';
import { callGeminiVision } from '../../../utils/aiUtils';
import { getStock } from '../../../utils/epiHelpers';
import { EpiIcon } from '../../../utils/epiIcons';
import { FT, SCALE } from '../../../styles/designTokens';
import ModalShell from '../../../components/common/ModalShell';

const readFileAsBase64 = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = (e) => resolve(e.target.result.split(',')[1]);
  reader.onerror = reject;
  reader.readAsDataURL(file);
});

function buildPrompt(types) {
  const catalogoTexto = (types || []).map((t) => {
    const sizesTxt = t.sizes?.length ? ` (tamanhos disponíveis: ${t.sizes.map((s) => s.name).join(', ')})` : '';
    return `- id: "${t.id}" | nome: "${t.label}"${sizesTxt}`;
  }).join('\n');

  return `A tua função é ler uma imagem de um albarán ou guia de remessa de compra de Equipamentos de Proteção Individual (EPI) e identificar cada artigo comprado, para atualizar um stock existente.

CATÁLOGO DE EPI JÁ EXISTENTE NO SISTEMA (usa isto para tentar corresponder cada linha do albarán a um destes itens, mesmo que a descrição não seja idêntica — ex. "Luva Nitrilo Reforçada" deve corresponder a "Luvas Proteção"):
${catalogoTexto || '(catálogo vazio)'}

Para cada linha de artigo no albarán (ignora cabeçalhos de tabela, totais, IVA, portes, notas de rodapé), extrai:
- descricao_original: o texto da descrição tal como está escrito no albarán.
- quantidade: a quantidade comprada, como número inteiro.
- tamanho_detectado: se a descrição ou uma coluna própria indicar um tamanho/medida (ex. "M", "42", "9"), esse valor como string; caso contrário null.
- catalogo_id: o "id" do item do catálogo acima que corresponde melhor a esta linha. Se não houver nenhuma correspondência razoável, usa null.

Responde EXCLUSIVAMENTE em JSON válido, sem texto antes ou depois, nesta estrutura:
{
  "itens": [
    { "descricao_original": "string", "quantidade": number, "tamanho_detectado": "string ou null", "catalogo_id": "string ou null" }
  ]
}

Se a imagem não parecer um albarán/guia de remessa/fatura de compra de material, devolve { "itens": [] }.`;
}

const normStr = (s) => (s || '').toString().trim().toLowerCase();

let rowSeq = 0;

export default function EpiAlbaranScannerModal({ open, onClose, types, onChange }) {
  const { supabase, systemSettings } = useApp();
  const [step, setStep] = useState('upload');
  const [files, setFiles] = useState([]);
  const [processingLabel, setProcessingLabel] = useState('');
  const [rows, setRows] = useState([]);
  const [scanError, setScanError] = useState('');
  const [applying, setApplying] = useState(false);
  const [applyError, setApplyError] = useState('');

  const reset = () => {
    setStep('upload');
    setFiles([]);
    setRows([]);
    setScanError('');
    setApplyError('');
  };

  const handleClose = () => { reset(); onClose(); };

  const handleFilesChange = (fileList) => setFiles(Array.from(fileList));

  const handleAnalyze = async () => {
    if (!files.length) return;
    setStep('processing');
    setScanError('');
    const prompt = buildPrompt(types);
    const collected = [];

    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      setProcessingLabel(`A ler ${i + 1} de ${files.length}: ${f.name}`);
      try {
        const base64 = await readFileAsBase64(f);
        const raw = await callGeminiVision(base64, f.type || 'image/jpeg', prompt, systemSettings.geminiApiKey);
        const jsonMatch = raw.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error('Sem JSON na resposta: ' + raw.substring(0, 200));
        const data = JSON.parse(jsonMatch[0]);
        (data.itens || []).forEach((item) => {
          const type = types.find((t) => t.id === item.catalogo_id) || null;
          let tamanhoEscolhido = '';
          if (type?.sizes?.length) {
            const match = type.sizes.find((s) => normStr(s.name) === normStr(item.tamanho_detectado));
            tamanhoEscolhido = match ? match.name : '';
          }
          collected.push({
            _id: `r${rowSeq++}`,
            fileName: f.name,
            descricaoOriginal: item.descricao_original || '(sem descrição)',
            quantidade: Math.max(1, parseInt(item.quantidade, 10) || 1),
            tipoId: type ? type.id : '',
            tamanhoEscolhido,
            incluir: true,
          });
        });
      } catch (err) {
        setScanError((prev) => prev ? `${prev}\n${f.name}: ${err.message}` : `${f.name}: ${err.message}`);
      }
    }

    setRows(collected);
    setStep('review');
  };

  const updateRow = (id, patch) => setRows((prev) => prev.map((r) => (r._id === id ? { ...r, ...patch } : r)));

  const handleTipoChange = (id, tipoId) => {
    const type = types.find((t) => t.id === tipoId) || null;
    updateRow(id, { tipoId, tamanhoEscolhido: type?.sizes?.length ? (type.sizes[0]?.name || '') : '' });
  };

  const includedRows = rows.filter((r) => r.incluir);
  const pendingSize = includedRows.some((r) => {
    const t = types.find((x) => x.id === r.tipoId);
    return t?.sizes?.length && !r.tamanhoEscolhido;
  });
  const noType = includedRows.some((r) => !r.tipoId);

  const handleApply = async () => {
    setApplyError('');
    if (!includedRows.length) return;
    if (noType) { setApplyError('Há linhas incluídas sem tipo de EPI escolhido — associa um tipo ou desmarca essas linhas.'); return; }
    if (pendingSize) { setApplyError('Há linhas incluídas sem tamanho escolhido — escolhe um tamanho ou desmarca essas linhas.'); return; }

    setApplying(true);
    try {
      const byType = new Map();
      includedRows.forEach((r) => {
        if (!byType.has(r.tipoId)) byType.set(r.tipoId, []);
        byType.get(r.tipoId).push(r);
      });

      for (const [tipoId, tipoRows] of byType) {
        const type = types.find((t) => t.id === tipoId);
        if (!type) continue;
        if (type.sizes?.length) {
          const newSizes = type.sizes.map((s) => {
            const delta = tipoRows.filter((r) => r.tamanhoEscolhido === s.name).reduce((sum, r) => sum + r.quantidade, 0);
            return delta > 0 ? { ...s, stock: s.stock + delta } : s;
          });
          const { error } = await supabase.from('epi_types').update({ sizes: newSizes }).eq('id', tipoId);
          if (error) throw error;
        } else {
          const delta = tipoRows.reduce((sum, r) => sum + r.quantidade, 0);
          const { error } = await supabase.from('epi_types').update({ stock: (type.stock || 0) + delta }).eq('id', tipoId);
          if (error) throw error;
        }
      }

      setApplying(false);
      onChange();
      handleClose();
    } catch (err) {
      setApplying(false);
      setApplyError('Erro ao atualizar stock: ' + err.message);
    }
  };

  return (
    <ModalShell
      isOpen={open}
      onClose={handleClose}
      busy={step === 'processing'}
      title="Ler Albarán"
      meta={step === 'review' ? `${rows.length} artigo${rows.length !== 1 ? 's' : ''} identificado${rows.length !== 1 ? 's' : ''}` : undefined}
      icon={<ScanSearch size={20} />}
      size="2xl"
    >
      <div className="p-5 space-y-4">
        {step === 'upload' && (
          <>
            {!systemSettings.geminiApiKey && (
              <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-700 font-bold">
                <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
                Configura a chave API Gemini nas Definições para usar a leitura de albarán.
              </div>
            )}
            <p className="text-xs text-[var(--slate-dim)]">
              Sobe uma foto (ou várias) do albarán/guia de remessa da compra de EPI. O sistema identifica os artigos, tenta associá-los ao catálogo já existente e propõe o stock a somar — confirma ou ajusta antes de gravar.
            </p>
            <div
              className="border-2 border-dashed border-[var(--border)] rounded-2xl p-8 text-center cursor-pointer hover:border-[var(--slate)] hover:bg-[var(--surface)] transition-all"
              onClick={() => document.getElementById('epi-albaran-input')?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); handleFilesChange(e.dataTransfer.files); }}
            >
              <div className="flex flex-col items-center gap-2 text-[var(--slate-dim)]">
                <Upload size={32} />
                <p className="font-bold text-sm">Arrasta ou clica para carregar</p>
                <p className="text-xs">JPG, PNG, WEBP, PDF — podes selecionar várias fotos do mesmo albarán</p>
              </div>
              <input id="epi-albaran-input" type="file" accept="image/*,application/pdf" multiple className="hidden" onChange={(e) => handleFilesChange(e.target.files)} />
            </div>

            {files.length > 0 && (
              <div className="bg-[var(--surface)] rounded-xl border border-[var(--border-soft)] divide-y divide-[var(--border-soft)]">
                {files.map((f, i) => (
                  <div key={i} className="flex items-center gap-3 px-3 py-2">
                    <ScanSearch size={14} className="text-[var(--slate)] flex-shrink-0" />
                    <span className="text-xs font-bold text-[var(--ink-mid)] truncate flex-1">{f.name}</span>
                    <span className={`${SCALE.text.meta} text-[var(--slate-dim)] flex-shrink-0`}>{(f.size / 1024).toFixed(0)} KB</span>
                    <button onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))} className="text-[var(--slate)] hover:text-red-400 transition-colors flex-shrink-0"><X size={12} /></button>
                  </div>
                ))}
              </div>
            )}

            <button
              onClick={handleAnalyze}
              disabled={!files.length || !systemSettings.geminiApiKey}
              className="w-full flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed py-3 rounded-xl font-black text-sm uppercase shadow-lg transition-all"
              style={{ backgroundColor: FT.orange, color: FT.navy }}
            >
              <ScanSearch size={16} /> Ler {files.length > 0 ? `${files.length} ficheiro${files.length !== 1 ? 's' : ''}` : 'albarán'} com IA
            </button>
          </>
        )}

        {step === 'processing' && (
          <div className="flex flex-col items-center gap-4 py-12">
            <Loader2 size={40} style={{ color: FT.slate }} className="animate-spin" />
            <p className="font-black text-[var(--ink-soft)] text-sm text-center">{processingLabel}</p>
          </div>
        )}

        {step === 'review' && (
          <>
            {scanError && (
              <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl p-3 text-xs text-red-600 font-semibold whitespace-pre-line">
                <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
                {scanError}
              </div>
            )}

            {rows.length === 0 ? (
              <p className="text-sm text-[var(--slate-dim)] text-center py-8">Não foi identificado nenhum artigo. Confirma se a foto mostra claramente as linhas do albarán.</p>
            ) : (
              <div className="space-y-2">
                {rows.map((r) => {
                  const type = types.find((t) => t.id === r.tipoId) || null;
                  const currentStock = type ? (type.sizes?.length ? getStock(type, r.tamanhoEscolhido) : (type.stock || 0)) : null;
                  return (
                    <div key={r._id} className={`rounded-xl border px-3 py-2.5 space-y-2 ${r.incluir ? 'bg-white border-[var(--border-soft)]' : 'bg-[var(--surface-dim)] border-[var(--border-soft)] opacity-60'}`}>
                      <div className="flex items-start gap-2">
                        <input
                          type="checkbox"
                          checked={r.incluir}
                          onChange={(e) => updateRow(r._id, { incluir: e.target.checked })}
                          className="mt-1 flex-shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-[var(--ink)] truncate">{r.descricaoOriginal}</p>
                          <p className={`${SCALE.text.meta} text-[var(--slate-dim)] truncate`}>{r.fileName}</p>
                        </div>
                        {type ? <EpiIcon name={type.icon} size={14} className="text-[var(--navy)] flex-shrink-0 mt-0.5" /> : <AlertTriangle size={14} className="text-amber-500 flex-shrink-0 mt-0.5" />}
                      </div>

                      <div className="flex flex-wrap items-center gap-2 pl-6">
                        <select
                          value={r.tipoId}
                          onChange={(e) => handleTipoChange(r._id, e.target.value)}
                          disabled={!r.incluir}
                          className="border border-slate-200 rounded-lg px-2 py-1.5 text-xs flex-1 min-w-[140px] disabled:opacity-50"
                        >
                          <option value="">— sem correspondência, escolhe um tipo —</option>
                          {types.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
                        </select>

                        {type?.sizes?.length > 0 && (
                          <select
                            value={r.tamanhoEscolhido}
                            onChange={(e) => updateRow(r._id, { tamanhoEscolhido: e.target.value })}
                            disabled={!r.incluir}
                            className="border border-slate-200 rounded-lg px-2 py-1.5 text-xs w-24 disabled:opacity-50"
                          >
                            <option value="">tamanho…</option>
                            {type.sizes.map((s) => <option key={s.name} value={s.name}>{s.name}</option>)}
                          </select>
                        )}

                        <input
                          type="number"
                          min="1"
                          value={r.quantidade}
                          onChange={(e) => updateRow(r._id, { quantidade: Math.max(1, parseInt(e.target.value, 10) || 1) })}
                          disabled={!r.incluir}
                          className="border border-slate-200 rounded-lg px-2 py-1.5 text-xs w-16 disabled:opacity-50"
                        />

                        {currentStock != null && r.incluir && (
                          <span className={`${SCALE.text.meta} text-[var(--slate-dim)] whitespace-nowrap`}>
                            stock: {currentStock} → <span className="font-bold text-emerald-600">{currentStock + r.quantidade}</span>
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {applyError && <p className="text-xs text-red-600 font-bold bg-red-50 rounded-lg p-2">{applyError}</p>}

            <div className="flex gap-2">
              <button
                onClick={() => { setStep('upload'); setFiles([]); setRows([]); setScanError(''); }}
                className="flex-1 flex items-center justify-center gap-1.5 text-[var(--slate-dim)] hover:text-[var(--ink-mid)] py-2.5 rounded-xl font-bold text-xs uppercase transition-colors border border-[var(--border)]"
              >
                <RefreshCw size={13} /> Ler outro albarán
              </button>
              <button
                onClick={handleApply}
                disabled={applying || !includedRows.length}
                className="flex-1 flex items-center justify-center gap-1.5 disabled:opacity-50 py-2.5 rounded-xl font-black text-xs uppercase shadow-lg transition-all"
                style={{ backgroundColor: FT.orange, color: FT.navy }}
              >
                {applying ? <Loader2 size={14} className="animate-spin" /> : <PackagePlus size={14} />}
                Somar ao stock ({includedRows.length})
              </button>
            </div>
          </>
        )}
      </div>
    </ModalShell>
  );
}
