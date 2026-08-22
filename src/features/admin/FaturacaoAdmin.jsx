import React, { useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Mail, Building2, MessageSquareText, Receipt } from 'lucide-react';
import FaturasAdmin from './FaturasAdmin';
import FaturasTab from './FaturasTab';
import ContadorEmailsAdmin from './faturas/ContadorEmailsAdmin';
import SectionHeaderShell from '../../components/common/SectionHeaderShell';

const SECTIONS = [
  { id: 'importar',     label: 'Importar',     icon: Mail },
  { id: 'fornecedores', label: 'Fornecedores', icon: Building2 },
  { id: 'contador',     label: 'Contador',     icon: MessageSquareText },
];
const LABELS = { importar: 'Importar faturas', fornecedores: 'Fornecedores', contador: 'Contador' };

export default function FaturacaoAdmin() {
  const navigate = useNavigate();
  const location = useLocation();

  const activeSection = useMemo(() => {
    const parts = location.pathname.replace(/^\/admin\/faturacao\/?/, '').split('/').filter(Boolean);
    return parts[0] || 'importar';
  }, [location.pathname]);

  const navigateTo = (sectionId) => navigate(`/admin/faturacao/${sectionId}`);

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <SectionHeaderShell
        icon={<Receipt size={18} />}
        title="Faturação"
        subtitle="Importação e gestão de faturas de fornecedores"
        breadcrumbLabel={LABELS[activeSection]}
        tabs={SECTIONS}
        activeTab={activeSection}
        onTabChange={navigateTo}
      />

      {activeSection === 'importar' && <FaturasAdmin />}
      {activeSection === 'fornecedores' && <FaturasTab />}
      {activeSection === 'contador' && <ContadorEmailsAdmin />}
    </div>
  );
}
