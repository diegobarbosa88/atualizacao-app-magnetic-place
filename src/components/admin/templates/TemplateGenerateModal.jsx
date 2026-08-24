import React from 'react';
import { Loader2, Send, Users } from 'lucide-react';
import ModalShell from '../../common/ModalShell';
import { FT, SCALE } from '../../../styles/designTokens';

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
    <ModalShell
      isOpen
      onClose={onClose}
      title={`Gerar "${template.name}"`}
      icon={<Send size={18} />}
      size="lg"
      busy={generating}
      footer={
        <div className="flex justify-end gap-2 px-6 py-4">
          <button
            onClick={onClose}
            disabled={generating}
            className="px-4 py-2 text-[var(--ink-soft)] hover:bg-[var(--surface-dim)] rounded-xl disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={onSubmit}
            disabled={generating || selectedWorkers.length === 0}
 className="flex items-center gap-2 px-6 py-2 font-bold rounded-xl hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: FT.orange, color: FT.navy }}
          >
            {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Gerar {selectedWorkers.length} documento(s)
          </button>
        </div>
      }
    >
      <div className="space-y-3 px-6 py-4">
        <p className="text-sm text-[var(--ink-soft)]">
          Seleciona os trabalhadores que vão receber este documento. Será enviado um email se o trabalhador tiver email definido.
        </p>
        <div>
          <label className="block text-xs font-bold text-[var(--ink-soft)] uppercase tracking-widest mb-1">
            Cliente (para tags <code className={`font-mono ${SCALE.text.meta}`}>{'{client_*}'}</code>)
          </label>
          <select
            value={selectedClientId}
            onChange={(e) => setSelectedClientId(e.target.value)}
            disabled={generating}
            className="w-full border border-[var(--border)] rounded-xl p-2 text-sm focus:ring-2 focus:ring-[#1B3A57]/30 outline-none"
          >
            <option value="">— Sem cliente —</option>
            {(clients || []).map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <p className={`${SCALE.text.meta} text-[var(--slate-dim)] mt-1`}>Se omitido, as tags client_* ficam vazias no documento.</p>
        </div>
        <div className="max-h-80 overflow-y-auto border border-[var(--border)] rounded-xl divide-y divide-[var(--border-soft)]">
          {workers.length === 0 ? (
            <div className="p-4 text-sm text-[var(--slate-dim)] text-center">Nenhum trabalhador na lista.</div>
          ) : workers.map(w => {
            const checked = selectedWorkers.includes(w.id);
            return (
              <label key={w.id} className="flex items-center gap-3 p-3 cursor-pointer hover:bg-[var(--surface)]">
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={generating}
                  onChange={(e) => {
                    if (e.target.checked) setSelectedWorkers([...selectedWorkers, w.id]);
                    else setSelectedWorkers(selectedWorkers.filter(id => id !== w.id));
                  }}
                />
                <Users className="w-4 h-4 text-[var(--slate)]" />
                <span className="text-sm flex-1">{w.name}</span>
                {!w.email && (
                  <span className={`${SCALE.text.meta} text-amber-600`} title="Sem email — não receberá notificação">
                    sem email
                  </span>
                )}
              </label>
            );
          })}
        </div>

        {generating && genProgress && (
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-3 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-[var(--ink-mid)]">{genProgress.current} / {genProgress.total}</span>
              <span className="text-[var(--slate-dim)] truncate ml-2">
                {genProgress.workerName && `A processar ${genProgress.workerName}...`}
              </span>
            </div>
            <div className="w-full h-2 bg-[var(--border)] rounded-full overflow-hidden">
              <div
                className="h-full transition-all"
                style={{ backgroundColor: FT.navy, width: `${(genProgress.current / Math.max(genProgress.total, 1)) * 100}%` }}
              />
            </div>
          </div>
        )}
      </div>
    </ModalShell>
  );
}
