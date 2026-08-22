import React, { useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ReceiptText, Coins, Landmark, BarChart2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import ValidarReciboAdmin from '../../components/admin/ValidarReciboAdmin';
import SalariosTab from './SalariosTab';
import ReconciliacaoAdmin from './ReconciliacaoAdmin';
import SectionHeaderShell from '../../components/common/SectionHeaderShell';
import Card from "../../components/common/Card";

const SECTIONS = [
  { id: 'recibos',  label: 'Recibos',  icon: ReceiptText },
  { id: 'salarios', label: 'Salários', icon: Coins },
  { id: 'bancaria', label: 'Bancária', icon: Landmark },
];


export default function ReconciliacaoTab() {
  const navigate = useNavigate();
  const location = useLocation();
  const { workers = [] } = useApp();

  const activeSection = useMemo(() => {
    const parts = location.pathname.replace(/^\/admin\/reconciliacao\/?/, '').split('/').filter(Boolean);
    return parts[0] || 'recibos';
  }, [location.pathname]);

  const navigateTo = (sectionId) => navigate(`/admin/reconciliacao/${sectionId}`);

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <SectionHeaderShell
        icon={<BarChart2 size={18} />}
        title="Reconciliação"
        subtitle="Recibos, salários e extratos bancários"
        tabs={SECTIONS}
        activeTab={activeSection}
        onTabChange={navigateTo}
      />

      {activeSection === 'recibos' && (
        <Card><ValidarReciboAdmin workers={workers} /></Card>
      )}
      {activeSection === 'salarios' && (
        <Card><SalariosTab /></Card>
      )}
      {activeSection === 'bancaria' && (
        <Card><ReconciliacaoAdmin /></Card>
      )}
    </div>
  );
}
