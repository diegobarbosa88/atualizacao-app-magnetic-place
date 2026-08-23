import { useState } from 'react';
import { Bell, Mail, Check } from 'lucide-react';
import ModalShell from '../common/ModalShell';

const NOTIFICATION_TYPES = [
  { key: 'correction_applied', label: 'Correção Aplicada', desc: 'Quando uma correção é aplicada ao relatório' },
  { key: 'correction_resolved', label: 'Correção Resolvida', desc: 'Quando uma correção é resolvida sem alterações' },
  { key: 'creation_request_approved', label: 'Pedido de Registo Aprovado', desc: 'Quando um pedido de criação/eliminação é aprovado' },
  { key: 'correction_rejected', label: 'Correção Rejeitada', desc: 'Quando uma correção é rejeitada pelo administrador' },
  { key: 'correcao_aplicada', label: 'Correção Rápida Aplicada', desc: 'Quando uma correção rápida é aplicada' },
  { key: 'correcao_aplicada_precision', label: 'Correção de Precisão Aplicada', desc: 'Quando uma correção de precisão é aplicada' },
  { key: 'correcao_rejeitada', label: 'Correção Rejeitada (Legacy)', desc: 'Quando uma correção é rejeitada (sistema antigo)' },
  { key: 'reporte_divergencia_rejeitado', label: 'Reporte de Divergência Rejeitado', desc: 'Quando um reporte de divergência é rejeitado' },
  { key: 'validacao_anulada', label: 'Validação Anulada', desc: 'Quando uma validação de relatório é anulada' },
];

const DEFAULT_PREFS = {
  correction_applied: { db: false, email: false },
  correction_resolved: { db: false, email: false },
  creation_request_approved: { db: false, email: false },
  correction_rejected: { db: false, email: false },
  correcao_aplicada: { db: false, email: false },
  correcao_aplicada_precision: { db: false, email: false },
  correcao_rejeitada: { db: false, email: false },
  reporte_divergencia_rejeitado: { db: false, email: false },
  validacao_anulada: { db: false, email: false },
};

export default function NotificationPreferences({ isOpen, onClose, preferences, onSave }) {
  const [localPrefs, setLocalPrefs] = useState(preferences || DEFAULT_PREFS);
  const [saved, setSaved] = useState(false);

  if (!isOpen) return null;

  const handleToggle = (typeKey, channel) => {
    setLocalPrefs(prev => ({
      ...prev,
      [typeKey]: {
        ...prev[typeKey],
        [channel]: !prev[typeKey][channel]
      }
    }));
    setSaved(false);
  };

  const handleSave = async () => {
    await onSave(localPrefs);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleRestore = () => {
    setLocalPrefs(DEFAULT_PREFS);
    setSaved(false);
  };

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      title="Notificações ao Cliente"
      meta="Selecione quais notificações.enviar"
      icon={<Bell size={20} />}
      size="lg"
      closeOnOverlay={false}
      footer={
        <div className="p-6 flex gap-3">
          <button
            onClick={handleRestore}
            className="px-4 py-2.5 bg-slate-100 text-slate-600 rounded-xl font-black text-xs uppercase hover:bg-slate-200 transition-colors"
          >
            Restaurar Defaults
          </button>
          <button
            onClick={handleSave}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-[var(--orange)] text-[var(--navy)] rounded-xl font-black text-xs uppercase hover:bg-[var(--orange-deep)] transition-colors"
          >
            {saved ? (
              <>
                <Check size={14} />
                Guardado!
              </>
            ) : (
              'Guardar Preferências'
            )}
          </button>
        </div>
      }
    >
        {/* Content */}
        <div className="p-6 space-y-4">
          {NOTIFICATION_TYPES.map(({ key, label, desc }) => (
            <div key={key} className="bg-slate-50 rounded-2xl p-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="font-black text-sm text-slate-800">{label}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{desc}</p>
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => handleToggle(key, 'db')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-black text-xs uppercase transition-all ${
                    localPrefs[key]?.db
                      ? 'bg-emerald-600 text-white'
                      : 'bg-white border border-slate-200 text-slate-400 hover:border-emerald-300'
                  }`}
                >
                  <Bell size={14} />
                  App
                </button>
                <button
                  onClick={() => handleToggle(key, 'email')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-black text-xs uppercase transition-all ${
                    localPrefs[key]?.email
                      ? 'bg-emerald-600 text-white'
                      : 'bg-white border border-slate-200 text-slate-400 hover:border-emerald-300'
                  }`}
                >
                  <Mail size={14} />
                  Email
                </button>
              </div>
            </div>
          ))}
        </div>
    </ModalShell>
  );
}