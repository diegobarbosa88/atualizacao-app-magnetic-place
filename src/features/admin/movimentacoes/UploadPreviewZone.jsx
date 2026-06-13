import React, { useRef } from 'react';
import { Upload, Loader2, X } from 'lucide-react';

export function UploadDropZone({ onFiles, dragging, onDragOver, onDragLeave, onDrop }) {
  const inputRef = useRef(null);
  return (
    <div
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onClick={() => inputRef.current?.click()}
      className={`bg-white rounded-2xl border-2 border-dashed p-6 text-center cursor-pointer transition-all ${dragging ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200 hover:border-indigo-300'}`}
    >
      <input ref={inputRef} type="file" accept=".csv,.ofx,.qfx" multiple onChange={onFiles} className="hidden" />
      <div className="flex flex-col items-center gap-2">
        <Upload size={24} className={dragging ? 'text-indigo-500' : 'text-slate-400'} />
        <p className="text-sm font-semibold text-slate-600">
          {dragging ? 'Largue o ficheiro aqui' : 'Arraste CSV, OFX ou QFX ou clique para selecionar'}
        </p>
        <p className="text-[10px] text-slate-400">Suporta múltiplos ficheiros</p>
      </div>
    </div>
  );
}

export default function UploadPreviewZone({ upload }) {
  const {
    ficheiros, previewing, processando, erro,
    previewTransacoes, previewFilename, selTransacoes, setSelTransacoes,
    txSearch, setTxSearch, txTipoFiltro, setTxTipoFiltro,
    csvMapping, colMap, setColMap,
    previsar, confirmarMapeamento, processar,
    cancelarFicheiros, cancelarPreview, cancelarMapeamento,
  } = upload;

  return (
    <div className="space-y-3">
      {ficheiros.length > 0 && (
        <div className="bg-white rounded-2xl border-2 border-dashed border-indigo-200 p-6 text-center">
          <div className="flex flex-col items-center gap-3">
            <Upload size={28} className="text-indigo-400" />
            <p className="text-sm font-semibold text-slate-700">{ficheiros.length} ficheiro(s) pronto(s) para processar</p>
            <p className="text-xs text-slate-400">{ficheiros.map(f => f.name).join(', ')}</p>
            <div className="flex gap-2">
              <button onClick={cancelarFicheiros} className="px-4 py-2 text-xs font-bold uppercase tracking-widest border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50">Cancelar</button>
              <button onClick={previsar} disabled={previewing} className="flex items-center gap-2 px-4 py-2 text-xs font-bold uppercase tracking-widest bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50">
                {previewing ? <Loader2 size={13} className="animate-spin" /> : null}
                Pré-visualizar
              </button>
            </div>
          </div>
        </div>
      )}

      {csvMapping && (
        <div className="bg-white rounded-2xl border border-indigo-100 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold text-indigo-700">Mapeamento de Colunas — {previewFilename}</p>
            <button onClick={cancelarMapeamento} className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50">Cancelar</button>
          </div>
          <p className="text-[10px] text-slate-500">Selecione qual coluna corresponde a cada campo:</p>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Data',             key: 'dataCol',       optional: false },
              { label: 'Valor',            key: 'valorCol',      optional: false },
              { label: 'Descrição',        key: 'descricaoCol',  optional: false },
              { label: 'Tipo (opcional)',   key: 'tipoCol',       optional: true },
              { label: 'Débito (opcional)', key: 'debitoCol',     optional: true },
              { label: 'Crédito (opcional)',key: 'creditoCol',    optional: true },
            ].map(({ label, key, optional }) => (
              <div key={key}>
                <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">{label}</label>
                <select value={colMap[key]} onChange={e => setColMap(p => ({ ...p, [key]: e.target.value }))} className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-xl">
                  <option value="">{optional ? '— Nenhum —' : '— Selecionar —'}</option>
                  {(csvMapping.columns || []).map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            ))}
          </div>
          {csvMapping.preview?.length > 0 && (
            <div className="mt-2">
              <p className="text-[10px] font-black uppercase text-slate-400 mb-1">Pré-visualização (primeiras 3 linhas)</p>
              <div className="overflow-x-auto">
                <table className="w-full text-[10px] border border-slate-100 rounded-lg">
                  <thead>
                    <tr className="bg-slate-50">
                      {(csvMapping.columns || []).map(c => <th key={c} className="px-2 py-1 text-slate-500 font-bold">{c}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {csvMapping.preview.slice(0, 3).map((row, i) => (
                      <tr key={i} className="border-t border-slate-100">
                        {(csvMapping.columns || []).map(c => <td key={c} className="px-2 py-1 text-slate-600">{String(row[c] || '')}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          <button
            onClick={confirmarMapeamento}
            disabled={previewing || !colMap.dataCol || (!colMap.valorCol && !colMap.debitoCol) || !colMap.descricaoCol}
            className="flex items-center gap-2 px-4 py-2 text-xs font-bold uppercase tracking-widest bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50"
          >
            {previewing ? <Loader2 size={13} className="animate-spin" /> : null}
            Confirmar Mapeamento
          </button>
        </div>
      )}

      {previewTransacoes && (
        <div className="bg-white rounded-2xl border border-slate-100 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold text-slate-700">{previewFilename}</p>
            <div className="flex gap-2">
              <button onClick={cancelarPreview} className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50">Cancelar</button>
              <button onClick={processar} disabled={processando} className="flex items-center gap-2 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 disabled:opacity-50">
                {processando ? <Loader2 size={11} className="animate-spin" /> : null}
                Processar
              </button>
            </div>
          </div>
          <div className="flex gap-2 mb-2">
            <input type="text" placeholder="Filtrar descrição…" value={txSearch} onChange={e => setTxSearch(e.target.value)} className="flex-1 px-3 py-1.5 text-xs border border-slate-200 rounded-xl" />
            <select value={txTipoFiltro} onChange={e => setTxTipoFiltro(e.target.value)} className="px-3 py-1.5 text-xs border border-slate-200 rounded-xl">
              <option value="todos">Todos</option>
              <option value="credito">Entradas</option>
              <option value="debito">Saídas</option>
            </select>
          </div>
          <div className="max-h-64 overflow-y-auto space-y-1">
            {previewTransacoes.filter(tx => {
              const matchSearch = !txSearch || tx.descricao?.toLowerCase().includes(txSearch.toLowerCase());
              const matchTipo = txTipoFiltro === 'todos' || tx.tipo === txTipoFiltro;
              return matchSearch && matchTipo;
            }).map((tx, i) => (
              <div key={i} className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs ${selTransacoes.has(i) ? 'bg-indigo-50 border border-indigo-200' : 'bg-slate-50 border border-transparent'}`}>
                <input type="checkbox" checked={selTransacoes.has(i)} onChange={e => { const s = new Set(selTransacoes); e.target.checked ? s.add(i) : s.delete(i); setSelTransacoes(s); }} className="accent-indigo-600" />
                <span className="w-20 text-slate-500">{tx.data}</span>
                <span className={`w-16 text-right font-bold ${tx.tipo === 'credito' ? 'text-emerald-600' : 'text-rose-600'}`}>{parseFloat(tx.valor || 0).toLocaleString('pt-PT', { minimumFractionDigits: 2 })} €</span>
                <span className="flex-1 truncate text-slate-600">{tx.descricao}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {erro && (
        <div className="flex items-center gap-2 p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-600">
          <X size={14} /> {erro}
        </div>
      )}
    </div>
  );
}
