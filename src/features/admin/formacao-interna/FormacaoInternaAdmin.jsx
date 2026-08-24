import React, { useState } from 'react';
import { GraduationCap, ListChecks, Plus, BarChart3, ShieldCheck, BookOpen, FileText } from 'lucide-react';
import ListaAcoesTab from './ListaAcoesTab';
import ElearningAcoesTab from './ElearningAcoesTab';
import NovaAcaoForm from './NovaAcaoForm';
import HorasPorTrabalhadorTab from './HorasPorTrabalhadorTab';
import { FT, SCALE } from '../../../styles/designTokens';
import CertificacoesValidadeTab from './CertificacoesValidadeTab';
import RegistoIndividualTab from './RegistoIndividualTab';
import SectionHeaderShell from '../../../components/common/SectionHeaderShell';
import Card from "../../../components/common/Card";

const TABS = [
  { id: 'lista', label: 'Ações Presenciais', icon: ListChecks },
  { id: 'elearning', label: 'E-learning', icon: BookOpen },
  { id: 'nova', label: 'Nova Ação', icon: Plus },
  { id: 'certificacoes', label: 'Certificações e Validades', icon: ShieldCheck },
  { id: 'horas', label: 'Horas por Trabalhador', icon: BarChart3 },
  { id: 'registo-individual', label: 'Registo Individual', icon: FileText },
];

export default function FormacaoInternaAdmin() {
  const [tab, setTab] = useState('lista');
  const [refreshKey, setRefreshKey] = useState(0);

  const handleCriada = () => {
    setRefreshKey(k => k + 1);
    setTab('lista');
  };

  return (
    <Card className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <SectionHeaderShell
        icon={<GraduationCap size={18} />}
        title="Formação Interna"
        subtitle="Art. 131.º CT — formação dada diretamente pela empresa"
      />

      <div className="flex flex-wrap gap-2 mb-5">
        {TABS.map(t => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl ${SCALE.text.badge} transition-all ${
                tab === t.id ? 'text-white' : 'bg-[var(--surface-dim)] text-[var(--ink-soft)] hover:bg-[var(--border)]'
              }`}
              style={tab === t.id ? { backgroundColor: FT.navy } : {}}
            >
              <Icon size={12} /> {t.label}
            </button>
          );
        })}
      </div>

      {tab === 'lista' && <ListaAcoesTab refreshKey={refreshKey} />}
      {tab === 'elearning' && <ElearningAcoesTab refreshKey={refreshKey} />}
      {tab === 'nova' && <NovaAcaoForm onCriada={handleCriada} />}
      {tab === 'certificacoes' && <CertificacoesValidadeTab key={refreshKey} />}
      {tab === 'horas' && <HorasPorTrabalhadorTab />}
      {tab === 'registo-individual' && <RegistoIndividualTab />}
    </Card>
  );
}
