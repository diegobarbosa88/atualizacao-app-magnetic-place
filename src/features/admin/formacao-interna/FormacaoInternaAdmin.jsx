import React, { useState } from 'react';
import { GraduationCap, ListChecks, Plus, BarChart3, ShieldCheck, BookOpen } from 'lucide-react';
import ListaAcoesTab from './ListaAcoesTab';
import ElearningAcoesTab from './ElearningAcoesTab';
import NovaAcaoForm from './NovaAcaoForm';
import HorasPorTrabalhadorTab from './HorasPorTrabalhadorTab';
import CertificacoesValidadeTab from './CertificacoesValidadeTab';

const TABS = [
  { id: 'lista', label: 'Ações Presenciais', icon: ListChecks },
  { id: 'elearning', label: 'E-learning', icon: BookOpen },
  { id: 'nova', label: 'Nova Ação', icon: Plus },
  { id: 'certificacoes', label: 'Certificações e Validades', icon: ShieldCheck },
  { id: 'horas', label: 'Horas por Trabalhador', icon: BarChart3 },
];

export default function FormacaoInternaAdmin() {
  const [tab, setTab] = useState('lista');
  const [refreshKey, setRefreshKey] = useState(0);

  const handleCriada = () => {
    setRefreshKey(k => k + 1);
    setTab('lista');
  };

  return (
    <div className="bg-white rounded-2xl sm:rounded-[2.5rem] p-4 sm:p-6 lg:p-8 shadow-sm border border-slate-100 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center gap-3 mb-5 border-b border-slate-50 pb-4">
        <div className="bg-indigo-50 p-2 rounded-xl text-indigo-600">
          <GraduationCap size={20} />
        </div>
        <div className="flex-1">
          <h3 className="font-black text-base sm:text-xl text-slate-800 uppercase tracking-tight">Formação Interna</h3>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Art. 131.º CT — formação dada diretamente pela empresa</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-5">
        {TABS.map(t => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${
                tab === t.id ? 'text-white' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
              }`}
              style={tab === t.id ? { backgroundColor: '#1B3A57' } : {}}
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
    </div>
  );
}
