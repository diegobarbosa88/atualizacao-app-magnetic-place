import { useEffect } from 'react';
import { TriangleAlert } from 'lucide-react';
import { cn } from '../../lib/cn.js';
import { Button } from './Button.jsx';

export function ConfirmDialog({ open, title, description, confirmLabel, cancelLabel = 'Cancelar', tone = 'danger', onConfirm, onCancel }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-slate-950/70 p-4 print:hidden"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
    >
      <div className="w-full max-w-md animate-pop rounded-2xl bg-white p-6 shadow-2xl">
        <div className="flex items-start gap-4">
          <div
            className={cn(
              'grid size-12 shrink-0 place-items-center rounded-full',
              tone === 'danger' ? 'bg-red-100 text-red-600' : 'bg-safety-100 text-safety-700',
            )}
          >
            <TriangleAlert className="size-6" />
          </div>
          <div>
            <h2 id="confirm-title" className="text-lg font-bold">
              {title}
            </h2>
            <div className="mt-1 text-slate-600">{description}</div>
          </div>
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <Button variant="outline" onClick={onCancel} autoFocus>
            {cancelLabel}
          </Button>
          <Button variant={tone === 'danger' ? 'danger' : 'primary'} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
