import React, { useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowRightLeft, ListChecks } from 'lucide-react';
import PagamentosTab from './pagamentos/PagamentosTab';
import FilaAprovacaoTab from './pagamentos/FilaAprovacaoTab';
import SectionHeaderShell from '../../components/common/SectionHeaderShell';

const SECTIONS = [
  { id: 'fornecedores', label: 'Fornecedores', icon: ArrowRightLeft },
  { id: 'fila',         label: 'Fila de Pag.', icon: ListChecks },
];
const LABELS = { fornecedores: 'Pagamentos a fornecedores', fila: 'Fila de aprovação' };

const CARD_CLS = "bg-white rounded-2xl sm:rounded-[2.5rem] p-4 sm:p-6 lg:p-8 shadow-sm border border-slate-100";

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
        breadcrumbLabel={LABELS[activeSection]}
        tabs={SECTIONS}
        activeTab={activeSection}
        onTabChange={navigateTo}
      />

      {activeSection === 'fornecedores' && <PagamentosTab />}
      {activeSection === 'fila' && (
        <div className={CARD_CLS}><FilaAprovacaoTab /></div>
      )}
    </div>
  );
}
