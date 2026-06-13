import React from 'react';
import { ArrowLeftRight, Loader2 } from 'lucide-react';

export default function CsvMappingCard({ csvMapping, colMap, setColMap, previewing, confirmarMapeamento, onCancel }) {
  const cols = csvMapping.columns;
  const canConfirm = colMap.dataCol && (colMap.modo === 'valor' ? colMap.valorCol : (colMap.debitoCol || colMap.creditoCol));

  const colSamples = (col) =>
    csvMapping.preview.slice(0, 3).map(r => r[col]).filter(v => v != null && v !== '').join(', ');

  const mkSelect = (field) => (
    <select
      value={colMap[field]}
      onChange={e => setColMap(p => ({ ...p, [field]: e.target.value }))}
      className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
    >
      <option value="">— não usar —</option>
      {cols.map(c => {
        const samples = colSamples(c);
        return <option key={c} value={c}>{c}{samples ? ` — ${samples}` : ''}</option>;
      })}
    </select>
  );

  return (
    <div className="bg-white rounded-[2.5rem] shadow-sm border border-amber-100 p-6 sm:p-8 space-y-5">
      <div>
        <h3 className="text-[10px] font-black uppercase tracking-widest text-amber-600">Mapear Colunas do CSV</h3>
        <p className="text-xs text-slate-400 mt-0.5">As colunas deste ficheiro não foram reconhecidas automaticamente. Indica qual coluna corresponde a cada campo.</p>
      </div>

      {/* Layout: prévia à esquerda, dropdowns à direita */}
      <div className="flex flex-col lg:flex-row gap-6">

        {/* Prévia da tabela — sempre visível enquanto mapeia */}
        <div className="lg:flex-1 overflow-auto max-h-80 rounded-xl border border-slate-100">
          <table className="text-[11px] w-full">
            <thead className="bg-slate-50 sticky top-0">
              <tr>{cols.map(c => <th key={c} className="px-3 py-2 text-left text-slate-500 font-black uppercase tracking-widest whitespace-nowrap">{c}</th>)}</tr>
            </thead>
            <tbody>
              {csvMapping.preview.map((row, i) => (
                <tr key={i} className="border-t border-slate-50">
                  {cols.map(c => <td key={c} className="px-3 py-2 text-slate-600 whitespace-nowrap">{row[c]}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Dropdowns de mapeamento */}
        <div className="lg:w-72 space-y-4">
          {/* Seletor modo valor vs débito/crédito */}
          <div className="flex gap-2 flex-wrap">
            {[{ k: 'valor', l: 'Valor único' }, { k: 'debcred', l: 'Déb + Créd' }].map(({ k, l }) => (
              <button key={k} onClick={() => setColMap(p => ({ ...p, modo: k }))}
                className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${colMap.modo === k ? 'bg-indigo-100 text-indigo-700 ring-2 ring-indigo-300' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                {l}
              </button>
            ))}
          </div>

          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Data <span className="text-rose-400">*</span></label>
            {mkSelect('dataCol')}
          </div>
          {colMap.modo === 'valor' ? (
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Valor <span className="text-rose-400">*</span></label>
              {mkSelect('valorCol')}
            </div>
          ) : (
            <>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Débito (saída)</label>
                {mkSelect('debitoCol')}
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Crédito (entrada)</label>
                {mkSelect('creditoCol')}
              </div>
            </>
          )}
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Descrição</label>
            {mkSelect('descricaoCol')}
          </div>
          {colMap.modo === 'valor' && (
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Tipo (C/D, Entrada/Saída)</label>
              {mkSelect('tipoCol')}
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button onClick={confirmarMapeamento} disabled={!canConfirm || previewing}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all text-[10px] font-black uppercase tracking-widest disabled:opacity-40">
              {previewing ? <Loader2 size={12} className="animate-spin" /> : <ArrowLeftRight size={12} />}
              Aplicar
            </button>
            <button onClick={onCancel}
              className="px-4 py-2 text-slate-400 hover:text-slate-600 rounded-xl text-[10px] font-black uppercase tracking-widest">
              Cancelar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
