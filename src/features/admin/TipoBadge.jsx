import React from 'react';
import { ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import Badge from '../../components/common/Badge';

// Primeiro consumidor real do Badge/TONES partilhados (fase 4 do plano de
// design) — mantém a API pública (`tipo`) para não tocar nos 4 call sites em
// ReconciliacaoAdmin.jsx e ResultadosTabs.jsx.
export default function TipoBadge({ tipo }) {
  if (tipo === 'credito') return (
    <Badge tone="success" icon={ArrowDownLeft}>Entrada</Badge>
  );
  return (
    <Badge tone="danger" icon={ArrowUpRight}>Saída</Badge>
  );
}
