export function PhaseTitle({ meta }) {
  const Icon = meta.icon;
  return (
    <div className="flex min-w-0 items-center gap-3">
      <div className="grid size-12 shrink-0 place-items-center rounded-xl bg-slate-900 text-safety-400">
        <Icon className="size-6" />
      </div>
      <div className="min-w-0">
        <p className="truncate text-xs font-bold uppercase tracking-[0.16em] text-tech-600">
          Fase {meta.number} de 3 · {meta.subtitle}
        </p>
        <h2 className="truncate text-xl font-bold sm:text-2xl">{meta.title}</h2>
      </div>
    </div>
  );
}
