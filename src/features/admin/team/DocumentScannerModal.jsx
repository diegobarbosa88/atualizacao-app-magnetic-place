import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../../../context/AppContext';
import { useTeam } from '../contexts/TeamContext';
import { callGeminiVision } from '../../../utils/aiUtils';
import { encontrarWorker } from '../../../utils/validacaoHelpers';
import { MAPA_SCANNER_ACT, inferirCategoria } from '../../../constants/rhCategories';
import {
  ScanSearch, X, Upload, Loader2, CheckCircle, AlertTriangle,
  User, FileText, Save, Search, RefreshCw, ChevronDown, ChevronUp
} from 'lucide-react';

const DOCUMENT_SCANNER_PROMPT = `A tua função é analisar imagens e PDFs de documentos de trabalhadores em Portugal (como Cartão de Cidadão, Título de Residência, Comprovativo de NIF, NISS, Ficha de Aptidão Médica SST, Contratos de Trabalho, Comprovativo de IBAN, etc.).

Ao receberes uma imagem ou documento, deves extrair as informações e responder EXCLUSIVAMENTE num formato JSON válido, sem texto adicional antes ou depois.

Regras de Extração e Validação para Portugal:
1. Identifica o Nome Completo do trabalhador.
2. Identifica o NIF (Número de Identificação Fiscal) com exatamente 9 dígitos.
3. Identifica o NISS (Número de Identificação da Segurança Social) com exatamente 11 dígitos.
4. Classifica o documento numa das seguintes categorias exatas:
   - "Identificação e Legalização" (Cartão de Cidadão, Título de Residência, Passaporte, Carta de Condução)
   - "Fiscal e Segurança Social" (Comprovativo NIF, NISS, Início de Atividade, Comprovativo IBAN)
   - "Saúde e Segurança no Trabalho" (Ficha de Aptidão Médica SST, Baixa Médica)
   - "Contratual e Habilitações" (Contrato de Trabalho, Comprovativo de Morada, Certificado de Habilitações)
   - "Outros"

5. Extrai as datas no formato AAAA-MM-DD:
   - data_nascimento
   - data_emissao
   - data_validade (se aplicável)

A tua resposta DEVE seguir rigorosamente esta estrutura JSON:

{
  "trabalhador": {
    "nome_completo": "string ou null",
    "nif": "string de 9 digitos ou null",
    "niss": "string de 11 digitos ou null",
    "data_nascimento": "YYYY-MM-DD ou null"
  },
  "documento": {
    "categoria": "Nome da Categoria",
    "tipo_documento": "Nome do Tipo de Documento",
    "numero_documento": "string ou null",
    "data_emissao": "YYYY-MM-DD ou null",
    "data_validade": "YYYY-MM-DD ou null"
  }
}`;

const slugify = (str) => (str || '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');

const readFileAsBase64 = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = (e) => resolve(e.target.result.split(',')[1]);
  reader.onerror = reject;
  reader.readAsDataURL(file);
});

const DocumentScannerModal = ({ open, onClose }) => {
  const { workers, supabase, systemSettings, saveToDb } = useApp();
  const { setWorkerForm, setIsAddingInTab } = useTeam();

  const [step, setStep] = useState('upload'); // 'upload' | 'processing' | 'results'
  const [files, setFiles] = useState([]);
  const [results, setResults] = useState([]); // { file, preview, status, extractedData, matchedWorker, manualSearch, saving, saved, savedUrl, error, expanded }
  const [processingLabel, setProcessingLabel] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    if (!open) {
      setStep('upload');
      setFiles([]);
      setResults([]);
      setProcessingLabel('');
    }
  }, [open]);

  if (!open) return null;

  const handleFilesChange = (newFiles) => {
    const arr = Array.from(newFiles);
    setFiles(arr);
  };

  const handleAnalyze = async () => {
    if (!files.length) return;
    setStep('processing');

    // Inicializa resultados
    const initial = files.map(f => ({
      file: f,
      preview: f.type.startsWith('image/') ? URL.createObjectURL(f) : null,
      status: 'pending',
      extractedData: null,
      matchedWorker: undefined,
      manualSearch: '',
      saving: false,
      saved: false,
      savedUrl: null,
      error: null,
      expanded: true,
    }));
    setResults(initial);

    const updated = [...initial];

    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      setProcessingLabel(`A analisar ${i + 1} de ${files.length}: ${f.name}`);
      updated[i] = { ...updated[i], status: 'analyzing' };
      setResults([...updated]);

      try {
        const base64 = await readFileAsBase64(f);
        const raw = await callGeminiVision(base64, f.type || 'image/jpeg', DOCUMENT_SCANNER_PROMPT, systemSettings.geminiApiKey);
        console.log(`[Scanner] ${f.name}:`, raw);

        const jsonMatch = raw.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error('Sem JSON na resposta: ' + raw.substring(0, 200));
        const data = JSON.parse(jsonMatch[0]);

        const t = data.trabalhador;
        let found = null;
        if (t?.nif) found = workers.find(w => w.nif === t.nif) || null;
        if (!found && t?.niss) found = workers.find(w => w.nis === t.niss) || null;
        if (!found && t?.nome_completo) found = encontrarWorker(t.nome_completo, workers);

        updated[i] = { ...updated[i], status: 'done', extractedData: data, matchedWorker: found };
      } catch (err) {
        updated[i] = { ...updated[i], status: 'error', error: err.message };
      }

      setResults([...updated]);
    }

    setStep('results');
  };

  const handleSave = async (idx) => {
    const r = results[idx];
    const worker = r.matchedWorker;
    if (!worker || !r.file || !supabase) return;

    setResults(prev => prev.map((x, i) => i === idx ? { ...x, saving: true, error: null } : x));

    try {
      const ext = r.file.name.split('.').pop().toLowerCase();
      const categoriaAI = r.extractedData?.documento?.categoria || '';
      const tipoDocStr  = r.extractedData?.documento?.tipo_documento || '';
      const categoriaACT = MAPA_SCANNER_ACT[categoriaAI] || inferirCategoria(categoriaAI) || inferirCategoria(tipoDocStr) || 'Outros';
      const tipoDoc = slugify(r.extractedData?.documento?.tipo_documento || 'documento');
      const path = `${worker.id}/${slugify(categoriaACT)}/${tipoDoc}_${Date.now()}.${ext}`;

      const { error: upErr } = await supabase.storage.from('documentos').upload(path, r.file);
      if (upErr) throw upErr;

      const { data: urlData } = supabase.storage.from('documentos').getPublicUrl(path);
      const docId = `doc_${Date.now()}`;
      await saveToDb('documents', docId, {
        id: docId,
        workerId: worker.id,
        tipo: r.extractedData?.documento?.tipo_documento || 'Documento',
        nomeFicheiro: r.file.name,
        url: urlData.publicUrl,
        status: 'Pendente',
        categoria: categoriaACT,
        dataEmissao: r.extractedData?.documento?.data_emissao
          ? new Date(r.extractedData.documento.data_emissao).toISOString()
          : new Date().toISOString(),
        data_validade: r.extractedData?.documento?.data_validade || null,
      });

      setResults(prev => prev.map((x, i) => i === idx ? { ...x, saving: false, saved: true, savedUrl: urlData.publicUrl } : x));
    } catch (err) {
      setResults(prev => prev.map((x, i) => i === idx ? { ...x, saving: false, error: 'Erro ao guardar: ' + (err.message || err) } : x));
    }
  };

  const handleSaveAll = () => {
    results.forEach((r, i) => {
      if (r.matchedWorker && !r.saved && !r.saving) handleSave(i);
    });
  };

  const handleCreateNewWorker = (r) => {
    const t = r.extractedData?.trabalhador || {};
    setWorkerForm(prev => ({ ...prev, id: null, name: t.nome_completo || '', nif: t.nif || '', nis: t.niss || '', status: 'ativo', dataInicio: '', dataFim: '' }));
    setIsAddingInTab(true);
    onClose();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const setManualSearch = (idx, val) => setResults(prev => prev.map((x, i) => i === idx ? { ...x, manualSearch: val } : x));
  const setMatchedWorker = (idx, w) => setResults(prev => prev.map((x, i) => i === idx ? { ...x, matchedWorker: w, manualSearch: '' } : x));
  const toggleExpanded = (idx) => setResults(prev => prev.map((x, i) => i === idx ? { ...x, expanded: !x.expanded } : x));

  const savedCount = results.filter(r => r.saved).length;
  const matchedCount = results.filter(r => r.matchedWorker && !r.saved).length;

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-violet-100 text-violet-600 rounded-xl"><ScanSearch size={18} /></div>
            <h3 className="font-black text-slate-800 text-base uppercase tracking-tight">Scanner de Documentos</h3>
            {step === 'results' && <span className="text-xs font-black text-slate-400">{results.length} ficheiro{results.length !== 1 ? 's' : ''}</span>}
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"><X size={18} /></button>
        </div>

        <div className="overflow-y-auto flex-1 p-5 space-y-4">

          {/* FASE: upload */}
          {step === 'upload' && (
            <>
              {!systemSettings.geminiApiKey && (
                <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-700 font-bold">
                  <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
                  Configura a chave API Gemini nas Definições para usar o scanner.
                </div>
              )}

              <div
                className="border-2 border-dashed border-slate-200 rounded-2xl p-8 text-center cursor-pointer hover:border-violet-300 hover:bg-violet-50/30 transition-all"
                onClick={() => inputRef.current?.click()}
                onDragOver={e => e.preventDefault()}
                onDrop={e => { e.preventDefault(); handleFilesChange(e.dataTransfer.files); }}
              >
                <div className="flex flex-col items-center gap-2 text-slate-400">
                  <Upload size={32} />
                  <p className="font-bold text-sm">Arrasta ou clica para carregar</p>
                  <p className="text-xs">JPG, PNG, WEBP, PDF — podes selecionar vários ficheiros</p>
                </div>
                <input ref={inputRef} type="file" accept="image/*,application/pdf" multiple className="hidden" onChange={e => handleFilesChange(e.target.files)} />
              </div>

              {files.length > 0 && (
                <div className="bg-slate-50 rounded-xl border border-slate-100 divide-y divide-slate-100">
                  {files.map((f, i) => (
                    <div key={i} className="flex items-center gap-3 px-3 py-2">
                      <FileText size={14} className="text-slate-400 flex-shrink-0" />
                      <span className="text-xs font-bold text-slate-700 truncate flex-1">{f.name}</span>
                      <span className="text-[10px] text-slate-400 font-bold flex-shrink-0">{(f.size / 1024).toFixed(0)} KB</span>
                      <button onClick={() => setFiles(prev => prev.filter((_, j) => j !== i))} className="text-slate-300 hover:text-red-400 transition-colors flex-shrink-0"><X size={12} /></button>
                    </div>
                  ))}
                </div>
              )}

              <button
                onClick={handleAnalyze}
                disabled={!files.length || !systemSettings.geminiApiKey}
                className="w-full flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed text-white py-3 rounded-xl font-black text-sm uppercase shadow-lg shadow-violet-200 transition-all"
              >
                <ScanSearch size={16} /> Analisar {files.length > 0 ? `${files.length} ficheiro${files.length !== 1 ? 's' : ''}` : 'com IA'}
              </button>
            </>
          )}

          {/* FASE: processing */}
          {step === 'processing' && (
            <div className="flex flex-col items-center gap-4 py-12">
              <Loader2 size={40} className="text-violet-600 animate-spin" />
              <p className="font-black text-slate-600 text-sm text-center">{processingLabel}</p>
              <div className="w-full bg-slate-100 rounded-full h-2">
                <div
                  className="bg-violet-500 h-2 rounded-full transition-all"
                  style={{ width: `${(results.filter(r => r.status === 'done' || r.status === 'error').length / files.length) * 100}%` }}
                />
              </div>
              <p className="text-xs text-slate-400">{results.filter(r => r.status === 'done' || r.status === 'error').length} de {files.length} processados</p>
            </div>
          )}

          {/* FASE: results */}
          {step === 'results' && (
            <>
              {/* Sumário */}
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3">
                  <p className="text-lg font-black text-emerald-700">{savedCount}</p>
                  <p className="text-[10px] font-black text-emerald-600 uppercase">Guardados</p>
                </div>
                <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3">
                  <p className="text-lg font-black text-indigo-700">{matchedCount}</p>
                  <p className="text-[10px] font-black text-indigo-600 uppercase">Para guardar</p>
                </div>
                <div className="bg-amber-50 border border-amber-100 rounded-xl p-3">
                  <p className="text-lg font-black text-amber-700">{results.filter(r => !r.matchedWorker && r.status === 'done').length}</p>
                  <p className="text-[10px] font-black text-amber-600 uppercase">Sem match</p>
                </div>
              </div>

              {matchedCount > 0 && (
                <button
                  onClick={handleSaveAll}
                  className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 rounded-xl font-black text-xs uppercase shadow-lg shadow-emerald-200 transition-all"
                >
                  <Save size={14} /> Guardar todos os encontrados ({matchedCount})
                </button>
              )}

              {/* Cards por ficheiro */}
              {results.map((r, idx) => (
                <div key={idx} className="border border-slate-200 rounded-xl overflow-hidden">
                  {/* Header do card */}
                  <button
                    onClick={() => toggleExpanded(idx)}
                    className="w-full flex items-center gap-3 p-3 bg-slate-50 hover:bg-slate-100 transition-colors text-left"
                  >
                    <FileText size={14} className="text-slate-400 flex-shrink-0" />
                    <span className="text-xs font-black text-slate-700 truncate flex-1">{r.file.name}</span>
                    {r.status === 'analyzing' && <Loader2 size={14} className="text-violet-500 animate-spin flex-shrink-0" />}
                    {r.status === 'error' && <AlertTriangle size={14} className="text-red-500 flex-shrink-0" />}
                    {r.status === 'done' && r.saved && <CheckCircle size={14} className="text-emerald-500 flex-shrink-0" />}
                    {r.status === 'done' && !r.saved && r.matchedWorker && <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full flex-shrink-0">{r.matchedWorker.name}</span>}
                    {r.status === 'done' && !r.saved && !r.matchedWorker && <span className="text-[10px] font-black text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full flex-shrink-0">Sem match</span>}
                    {r.expanded ? <ChevronUp size={14} className="text-slate-400 flex-shrink-0" /> : <ChevronDown size={14} className="text-slate-400 flex-shrink-0" />}
                  </button>

                  {r.expanded && (
                    <div className="p-3 space-y-3">
                      {r.status === 'error' && (
                        <p className="text-xs text-red-600 font-bold bg-red-50 rounded-lg p-2">{r.error}</p>
                      )}

                      {r.status === 'done' && r.extractedData && (
                        <>
                          {/* Dados extraídos */}
                          <div className="grid grid-cols-2 gap-2">
                            <div className="bg-slate-50 rounded-lg p-3 space-y-1.5">
                              <div className="flex items-center gap-1 mb-1"><User size={11} className="text-indigo-600" /><span className="text-[9px] font-black text-slate-400 uppercase">Trabalhador</span></div>
                              {[['Nome', r.extractedData.trabalhador?.nome_completo], ['NIF', r.extractedData.trabalhador?.nif], ['NISS', r.extractedData.trabalhador?.niss]].map(([l, v]) => v && (
                                <div key={l}><span className="text-[9px] text-slate-400 font-bold">{l}: </span><span className="text-[10px] font-black text-slate-700">{v}</span></div>
                              ))}
                            </div>
                            <div className="bg-slate-50 rounded-lg p-3 space-y-1.5">
                              <div className="flex items-center gap-1 mb-1"><FileText size={11} className="text-indigo-600" /><span className="text-[9px] font-black text-slate-400 uppercase">Documento</span></div>
                              {[['Tipo', r.extractedData.documento?.tipo_documento], ['Emissão', r.extractedData.documento?.data_emissao], ['Validade', r.extractedData.documento?.data_validade]].map(([l, v]) => v && (
                                <div key={l}><span className="text-[9px] text-slate-400 font-bold">{l}: </span><span className="text-[10px] font-black text-slate-700">{v}</span></div>
                              ))}
                            </div>
                          </div>

                          {/* Ações */}
                          {r.saved ? (
                            <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                              <div className="flex items-center gap-2"><CheckCircle size={14} className="text-emerald-600" /><span className="text-xs font-black text-emerald-800">Guardado</span></div>
                              {r.savedUrl && <a href={r.savedUrl} target="_blank" rel="noreferrer" className="text-[10px] font-black text-emerald-700 underline">Abrir →</a>}
                            </div>
                          ) : r.matchedWorker ? (
                            <>
                              {r.error && <p className="text-xs text-red-600 font-bold bg-red-50 rounded-lg p-2">{r.error}</p>}
                              <button
                                onClick={() => handleSave(idx)}
                                disabled={r.saving}
                                className="w-full flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white py-2 rounded-lg font-black text-xs uppercase transition-all"
                              >
                                {r.saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                                Guardar em {r.matchedWorker.name}
                              </button>
                            </>
                          ) : (
                            <div className="space-y-2">
                              <button
                                onClick={() => handleCreateNewWorker(r)}
                                className="w-full flex items-center justify-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white py-2 rounded-lg font-black text-xs uppercase transition-all"
                              >
                                <User size={13} /> Criar Novo Colaborador
                              </button>
                              <div className="relative">
                                <Search size={12} className="absolute left-2.5 top-2.5 text-slate-400" />
                                <input
                                  type="text"
                                  value={r.manualSearch}
                                  onChange={e => setManualSearch(idx, e.target.value)}
                                  placeholder="Associar a colaborador..."
                                  className="w-full pl-7 pr-3 py-2 text-xs font-bold border border-slate-200 rounded-lg outline-none focus:border-violet-400 transition-all"
                                />
                              </div>
                              {r.manualSearch.length >= 2 && (
                                <div className="border border-slate-200 rounded-lg overflow-hidden divide-y divide-slate-100">
                                  {workers.filter(w => w.name.toLowerCase().includes(r.manualSearch.toLowerCase())).slice(0, 5).map(w => (
                                    <button key={w.id} onClick={() => setMatchedWorker(idx, w)} className="w-full text-left px-3 py-2 hover:bg-violet-50 transition-colors text-xs font-bold text-slate-700">
                                      {w.name}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
              ))}

              <button
                onClick={() => { setStep('upload'); setFiles([]); setResults([]); }}
                className="w-full flex items-center justify-center gap-2 text-slate-500 hover:text-slate-700 py-2 rounded-xl font-bold text-xs uppercase transition-colors"
              >
                <RefreshCw size={13} /> Analisar novos documentos
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default DocumentScannerModal;
