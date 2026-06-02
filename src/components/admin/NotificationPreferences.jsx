import { useState } from 'react';
import { X, Bell, Mail, Check } from 'lucide-react';

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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center">
              <Bell size={20} />
            </div>
            <div>
              <h2 className="font-black text-lg text-slate-800">Notificações ao Cliente</h2>
              <p className="text-xs text-slate-400">Selecione quais notificações.enviar</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-slate-100 text-slate-400 hover:text-slate-600 hover:bg-slate-200 flex items-center justify-center transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
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

        {/* Footer */}
        <div className="p-6 border-t border-slate-100 flex gap-3">
          <button
            onClick={handleRestore}
            className="px-4 py-2.5 bg-slate-100 text-slate-600 rounded-xl font-black text-xs uppercase hover:bg-slate-200 transition-colors"
          >
            Restaurar Defaults
          </button>
          <button
            onClick={handleSave}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-indigo-600 text-white rounded-xl font-black text-xs uppercase hover:bg-indigo-700 transition-colors"
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
      </div>
    </div>
  );
}