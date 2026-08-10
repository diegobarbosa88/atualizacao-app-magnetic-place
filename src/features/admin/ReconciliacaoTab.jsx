import React, { useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ReceiptText, Coins, Landmark } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import ValidarReciboAdmin from '../../components/admin/ValidarReciboAdmin';
import SalariosTab from './SalariosTab';
import ReconciliacaoAdmin from './ReconciliacaoAdmin';

const SECTIONS = [
  { id: 'recibos',  label: 'Recibos',  icon: ReceiptText },
  { id: 'salarios', label: 'Salários', icon: Coins },
  { id: 'bancaria', label: 'Bancária', icon: Landmark },
];

const CARD_CLS = "bg-white rounded-2xl sm:rounded-[2.5rem] p-4 sm:p-6 lg:p-8 shadow-sm border border-slate-100";

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
      {/* Secções — sublinhado laranja, mesmo padrão de Equipa */}
      <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-2xl mb-5 w-full sm:w-auto inline-flex overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
        {SECTIONS.map(sec => {
          const Icon = sec.icon;
          const isActive = activeSection === sec.id;
          return (
            <button
              key={sec.id}
              onClick={() => navigateTo(sec.id)}
              className={`flex-shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                isActive ? 'bg-white text-[#1B3A57] shadow-sm' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <Icon size={13} /> {sec.label}
            </button>
          );
        })}
      </div>

      {activeSection === 'recibos' && (
        <div className={CARD_CLS}><ValidarReciboAdmin workers={workers} /></div>
      )}
      {activeSection === 'salarios' && (
        <div className={CARD_CLS}><SalariosTab /></div>
      )}
      {activeSection === 'bancaria' && (
        <div className={CARD_CLS}><ReconciliacaoAdmin /></div>
      )}
    </div>
  );
}
