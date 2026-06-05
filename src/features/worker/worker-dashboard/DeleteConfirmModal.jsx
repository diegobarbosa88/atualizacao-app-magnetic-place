import React from 'react';
import { Loader2 } from 'lucide-react';

export default function DeleteConfirmModal({ deleteConfirm, setDeleteConfirm, deleteSubmitting, onConfirm }) {
  if (!deleteConfirm) return null;
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl">
        <h3 className="text-lg font-black text-slate-800 mb-2">Confirmar pedido de exclusão</h3>
        <p className="text-sm text-slate-600 mb-6">
          Ao confirmar, será enviado um pedido para eliminar o registo de <strong>{deleteConfirm.date}</strong>. O administrador analisará o pedido.
        </p>
        <div className="flex gap-3">
          <button
            onClick={() => setDeleteConfirm(null)}
            className="flex-1 py-2.5 bg-slate-200 text-slate-700 rounded-xl font-bold text-sm uppercase hover:bg-slate-300 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            disabled={deleteSubmitting}
            className="flex-1 py-2.5 bg-rose-600 text-white rounded-xl font-bold text-sm uppercase hover:bg-rose-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {deleteSubmitting && <Loader2 size={14} className="animate-spin" />}
            Confirmar
          </button>
        </div>
      </div>
    </div>
  );
}
