import React from 'react';
import { Loader2, Send, Users } from 'lucide-react';
import Modal from './Modal';

export default function TemplateGenerateModal({
  template,
  workers,
  clients,
  selectedWorkers, setSelectedWorkers,
  selectedClientId, setSelectedClientId,
  generating,
  genProgress,
  onClose,
  onSubmit,
}) {
  return (
    <Modal
      onClose={onClose}
      title={`Gerar "${template.name}"`}
    >
      <div className="space-y-3">
        <p className="text-sm text-slate-600">
          Seleciona os trabalhadores que vão receber este documento. Será enviado um email se o trabalhador tiver email definido.
        </p>
        <div>
          <label className="block text-xs font-bold text-slate-600 uppercase tracking-widest mb-1">
            Cliente (para tags <code className="font-mono text-[10px]">{'{client_*}'}</code>)
          </label>
          <select
            value={selectedClientId}
            onChange={(e) => setSelectedClientId(e.target.value)}
            disabled={generating}
            className="w-full border border-slate-200 rounded-xl p-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
          >
            <option value="">— Sem cliente —</option>
            {(clients || []).map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <p className="text-[10px] text-slate-400 mt-1">Se omitido, as tags client_* ficam vazias no documento.</p>
        </div>
        <div className="max-h-80 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100">
          {workers.length === 0 ? (
            <div className="p-4 text-sm text-slate-400 text-center">Nenhum trabalhador na lista.</div>
          ) : workers.map(w => {
            const checked = selectedWorkers.includes(w.id);
            return (
              <label key={w.id} className="flex items-center gap-3 p-3 cursor-pointer hover:bg-slate-50">
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={generating}
                  onChange={(e) => {
                    if (e.target.checked) setSelectedWorkers([...selectedWorkers, w.id]);
                    else setSelectedWorkers(selectedWorkers.filter(id => id !== w.id));
                  }}
                />
                <Users className="w-4 h-4 text-slate-400" />
                <span className="text-sm flex-1">{w.name}</span>
                {!w.email && (
                  <span className="text-[10px] font-bold text-amber-600" title="Sem email — não receberá notificação">
                    sem email
                  </span>
                )}
              </label>
            );
          })}
        </div>

        {generating && genProgress && (
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-700">{genProgress.current} / {genProgress.total}</span>
              <span className="text-slate-500 truncate ml-2">
                {genProgress.workerName && `A processar ${genProgress.workerName}...`}
              </span>
            </div>
            <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-indigo-500 transition-all"
                style={{ width: `${(genProgress.current / Math.max(genProgress.total, 1)) * 100}%` }}
              />
            </div>
          </div>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={onClose}
            disabled={generating}
            className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={onSubmit}
            disabled={generating || selectedWorkers.length === 0}
            className="flex items-center gap-2 px-6 py-2 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 disabled:opacity-50"
          >
            {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Gerar {selectedWorkers.length} documento(s)
          </button>
        </div>
      </div>
    </Modal>
  );
}
