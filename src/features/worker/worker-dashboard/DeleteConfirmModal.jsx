import React from 'react';
import { Trash2, Loader2 } from 'lucide-react';
import ModalShell from '../../../components/common/ModalShell';

export default function DeleteConfirmModal({ deleteConfirm, setDeleteConfirm, deleteSubmitting, onConfirm }) {
  return (
    <ModalShell
      isOpen={!!deleteConfirm}
      onClose={() => setDeleteConfirm(null)}
      title="Eliminar Registo"
      icon={<Trash2 size={16} />}
      accent="rose"
    >
      <div className="px-5 py-5">
        <p className="text-sm text-slate-600 mb-6">
          Ao confirmar, será enviado um pedido para eliminar o registo de <strong>{deleteConfirm?.date}</strong>. O administrador analisará o pedido.
        </p>
        <div className="flex gap-3">
          <button
            onClick={() => setDeleteConfirm(null)}
            className="flex-1 py-2.5 bg-slate-100 text-slate-700 rounded-xl font-bold text-sm uppercase hover:bg-slate-200 transition-colors"
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
    </ModalShell>
  );
}
