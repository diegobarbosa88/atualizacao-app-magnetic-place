import React, { useState, useRef } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { X, Upload, Sparkles, Loader2, CheckCircle } from 'lucide-react';
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl;

const TIPOS = ['IRC', 'IVA', 'IRS', 'SS', 'Outro'];

const EMPTY = {
  tipo: 'IVA',
  periodo: '',
  valor: '',
  data_vencimento: '',
  referencia: '',
  iban_destino: '',
  descricao: '',
};

function ibanValido(iban) {
  return /^[A-Z]{2}\d{2}[A-Z0-9]{4,}$/.test(iban.replace(/\s/g, '').toUpperCase());
}

export default function ImpostoPdfUploadModal({ onClose, onSaved }) {
  const [fields, setFields] = useState(EMPTY);
  const [pdfFile, setPdfFile] = useState(null);
  const [pdfBase64, setPdfBase64] = useState('');
  const [extraindo, setExtraindo] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [erro, setErro] = useState('');
  const [extraido, setExtraido] = useState(false);
  const inputRef = useRef(null);

  const set = (k, v) => setFields(f => ({ ...f, [k]: v }));

  const handleFile = (file) => {
    if (!file || file.type !== 'application/pdf') {
      setErro('Por favor selecione um ficheiro PDF.');
      return;
    }
    setPdfFile(file);
    setErro('');
    setExtraido(false);
    const reader = new FileReader();
    reader.onload = (e) => setPdfBase64(btoa(String.fromCharCode(...new Uint8Array(e.target.result))));
    reader.readAsArrayBuffer(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    handleFile(e.dataTransfer.files[0]);
  };

  const extrairComIA = async () => {
    if (!pdfFile) return;
    setExtraindo(true);
    setErro('');
    try {
      const arrayBuffer = await pdfFile.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      let texto = '';
      for (let p = 1; p <= pdf.numPages; p++) {
        const page = await pdf.getPage(p);
        const content = await page.getTextContent();
        texto += content.items.map(it => it.str).join(' ') + '\n';
      }

      const res = await fetch('/api/parse-imposto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texto }),
      });
      const dados = await res.json();
      if (!res.ok) throw new Error(dados.error || 'Erro na extração');

      setFields(f => ({
        ...f,
        tipo: dados.tipo || f.tipo,
        periodo: dados.periodo || f.periodo,
        valor: dados.valor != null ? String(dados.valor) : f.valor,
        data_vencimento: dados.data_vencimento || f.data_vencimento,
        referencia: dados.referencia || f.referencia,
        iban_destino: dados.iban_destino || f.iban_destino,
        descricao: dados.descricao || f.descricao,
      }));
      setExtraido(true);
    } catch (e) {
      setErro(`Erro ao extrair: ${e.message}`);
    } finally {
      setExtraindo(false);
    }
  };

  const handleGuardar = async () => {
    if (!fields.tipo || !fields.valor || !fields.iban_destino) {
      setErro('Tipo, valor e IBAN são obrigatórios.');
      return;
    }
    const iban = fields.iban_destino.replace(/\s/g, '').toUpperCase();
    if (!ibanValido(iban)) {
      setErro('IBAN inválido.');
      return;
    }
    setGuardando(true);
    setErro('');
    try {
      const res = await fetch('/api/pagamentos?action=importar-imposto-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...fields,
          iban_destino: iban,
          valor: parseFloat(fields.valor),
          pdf_base64: pdfBase64 || undefined,
          filename: pdfFile?.name || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao guardar');
      onSaved(data.data);
    } catch (e) {
      setErro(e.message);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div
        className="relative bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[92vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-slate-100">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Novo Imposto</p>
            <p className="text-sm font-black text-slate-800">Importar Guia de Pagamento</p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {/* PDF drop zone */}
          <div
            onDrop={handleDrop}
            onDragOver={e => e.preventDefault()}
            className={`border-2 border-dashed rounded-2xl p-5 text-center cursor-pointer transition-colors ${
              pdfFile ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/30'
            }`}
            onClick={() => inputRef.current?.click()}
          >
            <input ref={inputRef} type="file" accept="application/pdf" className="hidden" onChange={e => handleFile(e.target.files[0])} />
            {pdfFile ? (
              <div className="flex items-center justify-center gap-2 text-emerald-700">
                <CheckCircle size={16} />
                <span className="text-xs font-black truncate max-w-[260px]">{pdfFile.name}</span>
              </div>
            ) : (
              <>
                <Upload size={20} className="text-slate-300 mx-auto mb-2" />
                <p className="text-xs font-bold text-slate-400">Arraste o PDF aqui ou clique para selecionar</p>
              </>
            )}
          </div>

          {pdfFile && (
            <button
              onClick={extrairComIA}
              disabled={extraindo}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-black bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-60 transition-all"
            >
              {extraindo ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
              {extraindo ? 'A extrair...' : extraido ? 'Re-extrair com IA' : 'Extrair campos com IA'}
            </button>
          )}

          {/* Fields */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Tipo *</label>
              <select
                value={fields.tipo}
                onChange={e => set('tipo', e.target.value)}
                className="w-full px-3 py-2 text-xs font-bold border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
              >
                {TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Período</label>
              <input
                type="text"
                placeholder="ex: 2026-06"
                value={fields.periodo}
                onChange={e => set('periodo', e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-300"
              />
            </div>
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Valor (€) *</label>
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={fields.valor}
                onChange={e => set('valor', e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-300"
              />
            </div>
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Data Vencimento</label>
              <input
                type="date"
                value={fields.data_vencimento}
                onChange={e => set('data_vencimento', e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-300"
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">IBAN Destino *</label>
            <input
              type="text"
              placeholder="PT50..."
              value={fields.iban_destino}
              onChange={e => set('iban_destino', e.target.value.toUpperCase())}
              className={`w-full px-3 py-2 text-xs border rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-300 ${
                fields.iban_destino && !ibanValido(fields.iban_destino) ? 'border-red-300 bg-red-50' : 'border-slate-200'
              }`}
            />
          </div>
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Referência</label>
            <input
              type="text"
              placeholder="Referência MB ou número de documento"
              value={fields.referencia}
              onChange={e => set('referencia', e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-300"
            />
          </div>
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Descrição</label>
            <input
              type="text"
              placeholder="ex: IVA Mensal Jun 2026"
              value={fields.descricao}
              onChange={e => set('descricao', e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-300"
            />
          </div>

          {erro && (
            <div className="px-4 py-3 rounded-xl text-[11px] font-bold bg-red-50 border border-red-200 text-red-700">{erro}</div>
          )}
        </div>

        <div className="px-6 pb-6 pt-4 border-t border-slate-100 flex gap-3">
          <button onClick={onClose} className="flex-1 py-3 rounded-2xl text-xs font-black bg-slate-100 text-slate-600 hover:bg-slate-200 transition-all">
            Cancelar
          </button>
          <button
            onClick={handleGuardar}
            disabled={guardando}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl text-xs font-black bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60 transition-all shadow-sm"
          >
            {guardando ? <Loader2 size={14} className="animate-spin" /> : null}
            {guardando ? 'A guardar...' : 'Adicionar à Fila'}
          </button>
        </div>
      </div>
    </div>
  );
}
