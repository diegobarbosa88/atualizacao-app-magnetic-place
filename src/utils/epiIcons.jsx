import React from 'react';
import { HardHat, Hand, Footprints, Glasses, Shirt, Ear, Wind, Flame, Anchor, ShieldCheck, Zap, Package } from 'lucide-react';

// Lucide não tem ícone literal de "calça" — desenhado à mão (mesmo estilo
// dos ícones lucide: só traço, sem preenchimento) em vez de mapear para um
// conceito próximo, para ficar reconhecível como calça e não como pessoa.
function Pants({ size = 24, className, ...rest }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...rest}
    >
      <path d="M7 2h10v4l-1.8 16h-2.4L12 12l-0.8 10h-2.4L7 6V2Z" />
    </svg>
  );
}

// Catálogo de EPI não tem ícone lucide literal para "luva"/"bota"/"colete" —
// mapeados para o conceito mais próximo (mesma lógica já usada para
// REASON_ICONS dos motivos de falta). Curado, não a lista lucide inteira:
// o admin escolhe de entre estes ao criar/editar um tipo.
export const EPI_ICON_OPTIONS = [
  { name: 'HardHat', Icon: HardHat },
  { name: 'Hand', Icon: Hand },
  { name: 'Footprints', Icon: Footprints },
  { name: 'Glasses', Icon: Glasses },
  { name: 'Shirt', Icon: Shirt },
  { name: 'Pants', Icon: Pants },
  { name: 'Ear', Icon: Ear },
  { name: 'Wind', Icon: Wind },
  { name: 'Flame', Icon: Flame },
  { name: 'Anchor', Icon: Anchor },
  { name: 'ShieldCheck', Icon: ShieldCheck },
  { name: 'Zap', Icon: Zap },
  { name: 'Package', Icon: Package },
];

const ICON_MAP = Object.fromEntries(EPI_ICON_OPTIONS.map((o) => [o.name, o.Icon]));

export function EpiIcon({ name, ...rest }) {
  const Cmp = ICON_MAP[name] || Package;
  return <Cmp {...rest} />;
}
