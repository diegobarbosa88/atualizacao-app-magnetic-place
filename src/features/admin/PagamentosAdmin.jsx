import React, { useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowRightLeft, ListChecks } from 'lucide-react';
import PagamentosTab from './pagamentos/PagamentosTab';
import FilaAprovacaoTab from './pagamentos/FilaAprovacaoTab';
import SectionHeaderShell from '../../components/common/SectionHeaderShell';
import Card from "../../components/common/Card";

const SECTIONS = [
  { id: 'fornecedores', label: 'Fornecedores', icon: ArrowRightLeft },
  { id: 'fila',         label: 'Fila de Pag.', icon: ListChecks },
];


export default function PagamentosAdmin() {
  const navigate = useNavigate();
  const location = useLocation();

  const activeSection = useMemo(() => {
    const parts = location.pathname.replace(/^\/admin\/pagamentos\/?/, '').split('/').filter(Boolean);
    return parts[0] || 'fila';
  }, [location.pathname]);

  const navigateTo = (sectionId) => navigate(`/admin/pagamentos/${sectionId}`);

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <SectionHeaderShell
        icon={<ArrowRightLeft size={18} />}
        title="Pagamentos"
        subtitle="Pagamentos a fornecedores e fila de aprovação"
        tabs={SECTIONS}
        activeTab={activeSection}
        onTabChange={navigateTo}
      />

      {activeSection === 'fornecedores' && <PagamentosTab />}
      {activeSection === 'fila' && (
        <Card><FilaAprovacaoTab /></Card>
      )}
    </div>
  );
}
