import React, { useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Mail, Building2 } from 'lucide-react';
import FaturasAdmin from './FaturasAdmin';
import FaturasTab from './FaturasTab';

const SECTIONS = [
  { id: 'importar',     label: 'Importar',     icon: Mail },
  { id: 'fornecedores', label: 'Fornecedores', icon: Building2 },
];

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
      {/* Secções — sublinhado laranja, mesmo padrão de Equipa */}
      <div className="flex items-center gap-5 mb-5">
        {SECTIONS.map(sec => {
          const Icon = sec.icon;
          const isActive = activeSection === sec.id;
          return (
            <button
              key={sec.id}
              onClick={() => navigateTo(sec.id)}
              className={`flex items-center gap-1.5 text-sm transition-all ${
                isActive ? 'text-[#1B3A57] font-medium' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <Icon size={13} /> {sec.label}
            </button>
          );
        })}
      </div>

      {activeSection === 'importar' && <FaturasAdmin />}
      {activeSection === 'fornecedores' && <FaturasTab />}
    </div>
  );
}
