import React, { useState } from 'react';
import { Lock, Loader2, X } from 'lucide-react';

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
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <form
        onSubmit={handleSubmit}
        onClick={e => e.stopPropagation()}
        className="relative bg-white rounded-3xl shadow-2xl w-full max-w-sm p-6"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-50 text-amber-600"><Lock size={16} /></div>
            <h3 className="font-black text-sm text-slate-800 uppercase tracking-tight">{title || 'Confirmação de admin'}</h3>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors">
            <X size={16} />
          </button>
        </div>

        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1.5">Password de Administrador</label>
        <input
          type="password"
          autoFocus
          value={password}
          onChange={e => setPassword(e.target.value)}
          placeholder="••••••••"
          className="w-full p-3 rounded-xl border border-slate-200 text-sm outline-none focus:border-slate-400 transition-all font-medium"
        />

        {error && <p className="text-xs text-rose-600 font-bold mt-2">{error}</p>}

        <div className="flex gap-2 mt-5">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-500 text-xs font-black uppercase tracking-widest hover:bg-slate-50 transition-all"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={loading || !password.trim()}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-white text-xs font-black uppercase tracking-widest transition-all disabled:opacity-50"
            style={{ backgroundColor: '#1B3A57' }}
          >
            {loading ? <Loader2 size={13} className="animate-spin" /> : 'Confirmar'}
          </button>
        </div>
      </form>
    </div>
  );
}
