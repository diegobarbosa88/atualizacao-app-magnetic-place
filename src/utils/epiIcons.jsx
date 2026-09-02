import React from 'react';
import { HardHat, Hand, Footprints, Glasses, Shirt, Ear, Wind, Flame, Anchor, ShieldCheck, Zap, Package } from 'lucide-react';

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
