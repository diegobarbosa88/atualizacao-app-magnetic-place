import React from 'react';
import { TONES, SCALE } from '../../styles/designTokens';

// Badge de estado. O tom vem de designTokens.TONES; o vocabulário fica com
// cada domínio, que mapeia os seus próprios estados para um tom.
//
// Substitui 10+ mapas locais (AlertasAdmin, PagamentosTab, ListaAcoesTab,
// correctionsUtils, txUtils, …) que repetiam as mesmas cores com escalas
// diferentes — uns em -50, outros em -100 — e tamanhos entre 8px e 10px.
//
//   <Badge tone="warning">Pendente</Badge>
//   <Badge tone="success" icon={Check}>Assinado</Badge>

export default function Badge({
  tone = 'neutral',
  icon: Icon,
  bordered = false,
  className = '',
  children,
}) {
  const t = TONES[tone] || TONES.neutral;
  return (
    <span
      style={{ fontFamily: 'var(--mono)' }}
      className={`inline-flex items-center gap-1 whitespace-nowrap ${SCALE.radius.chip} ${SCALE.pad.badge} ${SCALE.text.badge} ${t.bg} ${t.text} ${bordered ? `border ${t.border}` : ''} ${className}`.trim()}
    >
      {Icon && <Icon size={10} className="shrink-0" />}
      {children}
    </span>
  );
}

/**
 * Constrói um componente de badge a partir do mapa de estados de um domínio.
 * Evita repetir o switch em cada sítio onde o estado é mostrado.
 *
 * @example
 *   const AlertaBadge = createStatusBadge({
 *     pendente:  { label: 'Pendente',  tone: 'warning' },
 *     resolvido: { label: 'Resolvido', tone: 'success' },
 *   });
 *   <AlertaBadge status="pendente" />
 */
export function createStatusBadge(mapa, { fallbackTone = 'neutral' } = {}) {
  return function StatusBadge({ status, ...rest }) {
    const cfg = mapa[status];
    // Um estado desconhecido mostra o valor em bruto em vez de desaparecer —
    // sem isto, um estado novo na base de dados dava um badge vazio.
    return (
      <Badge tone={cfg?.tone || fallbackTone} icon={cfg?.icon} {...rest}>
        {cfg?.label || status || '—'}
      </Badge>
    );
  };
}
