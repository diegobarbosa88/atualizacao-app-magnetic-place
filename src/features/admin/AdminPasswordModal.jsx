import React, { useState } from 'react';
import { Lock, Loader2 } from 'lucide-react';
import ModalShell from '../../components/common/ModalShell';
import { FT, SCALE } from '../../styles/designTokens';

// Modal genérico para pedir a password de admin antes de uma ação sensível
// que precisa de validação server-side (nunca envia a password para mais
// lado nenhum além do endpoint que a valida contra system_settings).
export default function AdminPasswordModal({ open, title, onConfirm, onClose, loading, error }) {
  const [password, setPassword] = useState('');

  if (!open) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!password.trim()) return;
    onConfirm(password);
  };

  return (
    <ModalShell
      isOpen={open}
      onClose={onClose}
      busy={loading}
      title={title || 'Confirmação de admin'}
      icon={<Lock size={16} />}
      size="sm"
      layer="nested"
    >
      <form
        onSubmit={handleSubmit}
        className="p-6"
      >
        <label className={`${SCALE.text.statLabel} text-[var(--slate-dim)] block mb-1.5`}>Password de Administrador</label>
        <input
          type="password"
          autoFocus
          value={password}
          onChange={e => setPassword(e.target.value)}
          placeholder="••••••••"
          className="w-full p-3 rounded-xl border border-[var(--border)] text-sm outline-none focus:border-[var(--slate)] transition-all font-medium"
        />

        {error && <p className="text-xs text-rose-600 font-bold mt-2">{error}</p>}

        <div className="flex gap-2 mt-5">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-[var(--border)] text-[var(--slate-dim)] text-xs font-black uppercase tracking-widest hover:bg-[var(--surface)] transition-all"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={loading || !password.trim()}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-white text-xs font-black uppercase tracking-widest transition-all disabled:opacity-50"
            style={{ backgroundColor: FT.navy }}
          >
            {loading ? <Loader2 size={13} className="animate-spin" /> : 'Confirmar'}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}
