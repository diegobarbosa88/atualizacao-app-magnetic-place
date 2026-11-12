import { LOGO_SRC, ORG_NAME, TEST_TITLE } from '../config.js';

/**
 * Logótipo + nome da empresa + título da prova, para fundos azul-marinho.
 * `compacto`: uma linha só (durante a prova, para sobrar altura para o plano).
 */
export function Marca({ compacto = false }) {
  if (compacto) {
    return (
      <div className="flex min-w-0 items-center gap-2.5">
        <img src={LOGO_SRC} alt="" className="size-8 shrink-0 object-contain" draggable={false} />
        <p className="truncate text-base font-bold leading-tight" style={{ fontFamily: 'var(--heading)' }}>
          {TEST_TITLE}
        </p>
      </div>
    );
  }
  return (
    <div className="flex min-w-0 items-center gap-3">
      <img src={LOGO_SRC} alt="" className="size-11 shrink-0 object-contain baixo:size-8" draggable={false} />
      <div className="min-w-0">
        <p className="truncate font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-mp-orange-400">{ORG_NAME}</p>
        <p className="truncate text-lg font-bold leading-tight sm:text-xl baixo:text-base" style={{ fontFamily: 'var(--heading)' }}>
          {TEST_TITLE}
        </p>
      </div>
    </div>
  );
}
