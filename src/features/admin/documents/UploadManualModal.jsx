import React from 'react';
import { Upload, Loader2 } from 'lucide-react';
import ModalShell from '../../../components/common/ModalShell';
import { CATEGORIAS_RH_ACT, AUTO_CATEGORIA_TIPO, CATEGORIAS_COM_VALIDADE } from '../../../constants/rhCategories';

const TIPOS_MANUAIS = ['Recibo de Vencimento', 'Mapa de Ajudas de Custo', 'Mapa de Deslocamento', 'Contrato de Trabalho', 'Outro'];

export default function UploadManualModal({
  workers,
  uploading,
  selWorker, setSelWorker,
  selTipo, setSelTipo,
  selCategoria, setSelCategoria,
  selValidade, setSelValidade,
  selFile, setSelFile,
  onClose,
  onUpload,
  hideWorkerSelect = false,
}) {
  const handleTipoChange = (val) => {
    setSelTipo(val);
    const auto = AUTO_CATEGORIA_TIPO[val];
    if (auto) setSelCategoria(auto);
  };

  const mostraValidade = CATEGORIAS_COM_VALIDADE.includes(selCategoria);

  return (
    <ModalShell
      isOpen
      onClose={() => !uploading && onClose()}
      title="Upload Manual"
      icon={<Upload size={20} />}
      accent="brand"
      size="xl"
      layer="nested"
      closeOnOverlay={false}
      footer={
        <div className="flex justify-end gap-2 px-6 py-4">
          <button
            onClick={onClose}
            disabled={uploading}
            className="px-5 py-2.5 text-xs font-black uppercase tracking-widest text-slate-600 hover:bg-slate-100 rounded-xl transition-all disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={onUpload}
            disabled={uploading || (!hideWorkerSelect && !selWorker) || !selFile}
            className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl font-black uppercase text-xs tracking-widest flex items-center gap-2 disabled:opacity-50 transition-all hover:bg-indigo-700 shadow-lg shadow-indigo-200"
          >
            {uploading ? <Loader2 className="animate-spin" size={16} /> : <Upload size={16} />}
            {uploading ? 'A Enviar...' : 'Submeter'}
          </button>
        </div>
      }
    >
        <div className="space-y-4 px-6 py-5">
          {!hideWorkerSelect && (
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Colaborador</label>
              <select
                className="w-full p-3 rounded-xl border border-slate-200 bg-white text-sm focus:ring-2 focus:ring-indigo-500 outline-none font-medium"
                value={selWorker}
                onChange={(e) => setSelWorker(e.target.value)}
                disabled={uploading}
              >
                <option value="">Selecionar...</option>
                {workers.map(w => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
            </div>
          )}

          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Tipo</label>
            <select
              className="w-full p-3 rounded-xl border border-slate-200 bg-white text-sm focus:ring-2 focus:ring-indigo-500 outline-none font-medium"
              value={selTipo}
              onChange={(e) => handleTipoChange(e.target.value)}
              disabled={uploading}
            >
              {TIPOS_MANUAIS.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">
              Categoria RH <span className="text-indigo-500">(ACT)</span>
            </label>
            <select
              className="w-full p-3 rounded-xl border border-slate-200 bg-white text-sm focus:ring-2 focus:ring-indigo-500 outline-none font-medium"
              value={selCategoria || ''}
              onChange={(e) => setSelCategoria(e.target.value)}
              disabled={uploading}
            >
              <option value="">Sem categoria</option>
              {CATEGORIAS_RH_ACT.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            {selCategoria && (
              <p className="text-[10px] text-indigo-500 font-bold ml-1">Pasta: {selCategoria}</p>
            )}
          </div>

          {mostraValidade && (
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">
                Data de Validade <span className="text-amber-500">⚠ recomendado para esta categoria</span>
              </label>
              <input
                type="date"
                value={selValidade || ''}
                onChange={(e) => setSelValidade(e.target.value)}
                className="w-full p-3 rounded-xl border border-amber-200 bg-amber-50/30 text-sm focus:ring-2 focus:ring-amber-400 outline-none font-medium"
                disabled={uploading}
              />
            </div>
          )}

          {!mostraValidade && (
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">
                Data de Validade <span className="text-slate-400">(opcional)</span>
              </label>
              <input
                type="date"
                value={selValidade || ''}
                onChange={(e) => setSelValidade(e.target.value)}
                className="w-full p-3 rounded-xl border border-slate-200 bg-white text-sm focus:ring-2 focus:ring-indigo-500 outline-none font-medium"
                disabled={uploading}
              />
            </div>
          )}

          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Ficheiro (PDF)</label>
            <input
              type="file"
              accept=".pdf"
              className="w-full p-2.5 rounded-xl border border-slate-200 bg-white text-xs cursor-pointer"
              onChange={(e) => setSelFile(e.target.files?.[0])}
              disabled={uploading}
            />
            {selFile && (
              <p className="text-[10px] text-slate-500 mt-1 ml-1 truncate">{selFile.name}</p>
            )}
          </div>
        </div>
    </ModalShell>
  );
}
