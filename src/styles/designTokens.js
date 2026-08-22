// Tokens de marca globais — navy/orange/slate, Barlow Condensed + IBM Plex
// Mono. Extraído do módulo de Formação Interna (onde nasceu este sistema
// visual) para ser reutilizável por toda a app — começando pela Dashboard
// do trabalhador. Qualquer ecrã novo que precise da identidade Magnetic
// Place deve importar daqui, não repetir hexadecimais.
export const FT = {
  navy: '#1B3A57',
  navyDeep: '#122741',
  navyMid: '#20415F',
  orange: '#EB8D00',
  orangeDeep: '#C97600',
  slate: '#869AAF',
  slateDim: '#5C7086',
  bg: '#EFEDE7',
  panel: '#FFFFFF',
  ink: '#1A1D21',
  inkSoft: '#51606E',
  ok: '#2E7D4F',
  okBg: '#E7F3EB',
  bad: '#B4432F',
  badBg: '#FBEAE6',
  warn: '#D98A2B',
  warnBg: '#FBF0DE',
  info: '#4F46C7',
  infoBg: '#ECEBFC',
  teal: '#0F7C6E',
  tealBg: '#E3F4F1',
  border: '#E2DED4',

  // Tons de contador/badge. São mais saturados do que os `warn`/`bad` acima,
  // que estão calibrados para texto sobre fundo claro e ficam apagados quando
  // usados como preenchimento de um círculo pequeno. Estavam copiados à mão
  // em seis sítios sem nunca terem sido formalizados como token.
  badgeWarn: '#E8A317',
  badgeBad: '#E0455A',
};

export const FONT_TITLE = "'Barlow Condensed', sans-serif";
export const FONT_MONO = "'IBM Plex Mono', monospace";

/**
 * Tons semânticos partilhados por todos os badges de estado.
 *
 * Cada domínio tem o seu próprio vocabulário — "pendente/visto/resolvido" nos
 * alertas, "valido/a_expirar/expirado" na formação, "submitted/applied" nas
 * correções — por isso não faz sentido um mapa único de estados. O que se
 * partilha é o TOM: cada domínio mapeia os seus estados para um destes seis e
 * as cores passam a vir de um sítio só, em vez de 10+ mapas locais onde umas
 * usavam a escala -50 e outras a -100.
 */
export const TONES = {
  neutral: { bg: 'bg-slate-100',   text: 'text-slate-500',   border: 'border-slate-200' },
  success: { bg: 'bg-emerald-50',  text: 'text-emerald-700', border: 'border-emerald-100' },
  warning: { bg: 'bg-amber-50',    text: 'text-amber-700',   border: 'border-amber-100' },
  danger:  { bg: 'bg-rose-50',     text: 'text-rose-700',    border: 'border-rose-100' },
  info:    { bg: 'bg-indigo-50',   text: 'text-indigo-700',  border: 'border-indigo-100' },
  pending: { bg: 'bg-teal-50',     text: 'text-teal-700',    border: 'border-teal-100' },
};

/**
 * Escala dimensional — valores medidos nos mockups aprovados, não arbitrados.
 * Serve para raios, paddings e corpos de letra deixarem de ser inventados em
 * cada ficheiro: hoje o mesmo "cartão" aparece com rounded-xl, rounded-2xl,
 * rounded-[1.2rem] e rounded-[2.5rem] conforme quem o escreveu.
 *
 * Fonte: proposta-clientes (cartão de entidade, stat), proposta-modal-cliente
 * (modal, campos) e opcoes-cabecalho opção A (cabeçalho de secção).
 */
export const SCALE = {
  radius: {
    chip:    'rounded-full',
    tab:     'rounded-[7px]',
    control: 'rounded-lg',          //  8px — botões de ação, toggles
    input:   'rounded-[0.85rem]',   // 13.6px — campos de formulário
    header:  'rounded-2xl',         // 16px — faixa de cabeçalho de secção
    card:    'rounded-[1.2rem]',    // 19.2px — cartão de entidade
    panel:   'rounded-[1.5rem]',    // 24px — painel de página
    modal:   'rounded-[2rem]',      // 32px
  },
  pad: {
    card:   'px-[1.1rem] py-[1.05rem]',
    // Degrau móvel mantido do CARD_CLS anterior — em ecrã pequeno 24px de
    // padding lateral comem largura de leitura a mais.
    panel:  'p-4 sm:px-[1.5rem] sm:pt-[1.4rem] sm:pb-[1.6rem]',
    stat:   'px-[0.9rem] py-3',
    badge:  'px-[0.6rem] py-[0.3rem]',
    input:  'px-[0.9rem] py-[0.72rem]',
  },
  text: {
    // Barlow Condensed — nomes de entidade e valores
    entityName: 'text-[1.05rem] font-bold leading-[1.15]',
    price:      'text-[1.15rem] font-bold leading-none',
    statValue:  'text-[1.35rem] font-bold leading-none',
    sectionTitle: 'text-[1.3rem] font-bold leading-none',
    // IBM Plex Mono — metadados e rótulos
    meta:       'text-[10px] font-semibold',
    badge:      'text-[9.5px] font-bold uppercase tracking-[0.04em]',
    statLabel:  'text-[8.5px] font-extrabold uppercase tracking-[0.11em]',
    // Inter — texto corrido
    body:       'text-[11px] font-semibold',
  },
  // Grelha de cartões: 230px é o ponto onde um cartão de colaborador ainda
  // mostra nome + profissão + estado sem truncar. Antes era lg:grid-cols-3,
  // que dava cartões largos e meio vazios em ecrãs grandes.
  grid: 'grid gap-[0.9rem] [grid-template-columns:repeat(auto-fill,minmax(230px,1fr))]',
};
