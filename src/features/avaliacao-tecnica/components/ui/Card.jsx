import { cn } from '../../lib/cn.js';

export function Card({ className, children }) {
  return <section className={cn('rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 print:shadow-none', className)}>{children}</section>;
}

export function CardHeader({ icon: Icon, title, subtitle, right }) {
  return (
    <header className="flex items-center gap-3 border-b border-slate-200 px-4 py-3 sm:px-5">
      {Icon && (
        <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-mp-navy-50 text-mp-navy-700">
          <Icon className="size-5" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <h3 className="truncate font-bold text-slate-900">{title}</h3>
        {subtitle && <p className="truncate text-sm text-slate-500">{subtitle}</p>}
      </div>
      {right}
    </header>
  );
}
