import React from 'react';
import { SCALE } from '../../styles/designTokens';

// Duas superfícies, uma fonte de verdade.
//
// `panel` é o contentor branco de uma página — substitui a string
// "bg-white rounded-2xl sm:rounded-[2.5rem] p-4 sm:p-6 lg:p-8 shadow-sm
// border border-slate-100", que estava copiada em 6 ficheiros como constante
// CARD_CLS e mais 16 vezes inline, metade delas com a ordem das classes
// trocada e paddings ligeiramente diferentes.
//
// `item` é o cartão de uma entidade numa grelha (colaborador, cliente,
// template). Aparecia com rounded-xl, rounded-2xl e rounded-[1.2rem]
// conforme o ficheiro, e só alguns tinham o hover-lift.

const VARIANTS = {
  panel: `bg-white border border-slate-100 shadow-sm ${SCALE.radius.panel} ${SCALE.pad.panel}`,
  item: `bg-white border border-[#E5E1D6] ${SCALE.radius.card} ${SCALE.pad.card} transition-all duration-200`,
  bare: `bg-white border border-slate-100 ${SCALE.radius.panel} overflow-hidden`,
};

export default function Card({
  variant = 'panel',
  interactive = false,
  className = '',
  as: Tag = 'div',
  children,
  ...rest
}) {
  const hover = interactive
    ? 'hover:border-[#c9d3db] hover:shadow-[0_8px_20px_-12px_rgba(18,39,65,0.25)] cursor-pointer'
    : '';

  return (
    <Tag className={`${VARIANTS[variant] || VARIANTS.panel} ${hover} ${className}`.trim()} {...rest}>
      {children}
    </Tag>
  );
}

/** Grelha densa de cartões de entidade — ver SCALE.grid. */
export function CardGrid({ className = '', children }) {
  return <div className={`${SCALE.grid} ${className}`.trim()}>{children}</div>;
}
