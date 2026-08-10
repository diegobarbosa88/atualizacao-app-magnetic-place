import React, { useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowRightLeft, ListChecks } from 'lucide-react';
import PagamentosTab from './pagamentos/PagamentosTab';
import FilaAprovacaoTab from './pagamentos/FilaAprovacaoTab';

const SECTIONS = [
  { id: 'fornecedores', label: 'Fornecedores', icon: ArrowRightLeft },
  { id: 'fila',         label: 'Fila de Pag.', icon: ListChecks },
];

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

      {activeSection === 'fornecedores' && <PagamentosTab />}
      {activeSection === 'fila' && (
        <div className={CARD_CLS}><FilaAprovacaoTab /></div>
      )}
    </div>
  );
}
