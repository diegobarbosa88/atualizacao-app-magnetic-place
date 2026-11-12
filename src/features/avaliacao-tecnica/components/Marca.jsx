import { LOGO_SRC, ORG_NAME, TEST_TITLE } from '../config.js';

/** Logótipo + nome da empresa + título da prova, para fundos azul-marinho */
export function Marca({ compacto = false }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <img
        src={LOGO_SRC}
        alt=""
        className={compacto ? 'size-8 shrink-0 object-contain' : 'size-11 shrink-0 object-contain baixo:size-8'}
        draggable={false}
      />
      <div className="min-w-0">
        <p className="truncate font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-mp-orange-400">{ORG_NAME}</p>
        <p className="truncate text-lg font-bold leading-tight sm:text-xl baixo:text-base" style={{ fontFamily: 'var(--heading)' }}>
          {TEST_TITLE}
        </p>
      </div>
    </div>
  );
}
