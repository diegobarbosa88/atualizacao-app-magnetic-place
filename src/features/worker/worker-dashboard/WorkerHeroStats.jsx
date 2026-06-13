import React from 'react';
import { ChevronLeft, Calendar, CheckCircle, TrendingUp } from 'lucide-react';
import CompanyLogo from '../../../components/common/CompanyLogo';
import { formatHours } from '../../../utils/formatUtils';

export default function WorkerHeroStats({ currentUser, currentMonth, setCurrentMonth, todayHours, totalMonthHours, expectedHours, myApproval, showProgress, setShowProgress }) {
  return (
    <div className="bg-slate-900 rounded-2xl md:rounded-[3rem] p-4 md:p-8 mb-4 md:mb-8 shadow-lg md:shadow-2xl text-white flex flex-col md:flex-row justify-between items-center gap-3 md:gap-8 relative overflow-hidden group">
      <div className="absolute top-0 right-0 p-10 opacity-10 group-hover:rotate-12 transition-transform duration-700 hidden sm:block">
        <CompanyLogo className="h-64 w-64 filter invert grayscale" />
      </div>
      <div className="relative z-10 w-full md:flex-1 mb-1 md:mb-0">
        <div className="mb-2 md:mb-4 text-center md:text-left">
          <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-300/70 mb-0.5">Bem-vindo</p>
          <div className="text-2xl md:text-5xl font-black leading-tight text-white uppercase tracking-tighter">
            {currentUser?.name?.split(' ')[0]}
          </div>
          {currentUser?.name?.split(' ').slice(1).join(' ') && (
            <div className="text-xs md:text-sm font-semibold text-white/40 uppercase tracking-widest mt-0.5">
              {currentUser.name.split(' ').slice(1).join(' ')}
            </div>
          )}
        </div>
        <div className="flex items-center justify-center md:justify-start gap-2 bg-white/10 p-1.5 md:p-2 rounded-xl md:rounded-2xl w-full sm:w-fit">
          <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))} className="p-1.5 md:p-2 hover:bg-white/20 rounded-lg md:rounded-xl text-white">
            <ChevronLeft size={14} />
          </button>
          <div className="text-indigo-200 flex items-center gap-1.5 text-xs md:text-sm font-bold font-mono uppercase tracking-widest min-w-[110px] md:min-w-[120px] justify-center">
            <Calendar size={14} className="md:w-[18px] md:h-[18px]" /> {new Date(currentMonth).toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' })}
          </div>
          <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))} className="p-1.5 md:p-2 hover:bg-white/20 rounded-lg md:rounded-xl text-white">
            <ChevronLeft size={14} className="rotate-180" />
          </button>
        </div>
        {expectedHours > 0 && (
          <button
            onClick={() => setShowProgress(!showProgress)}
            className="mt-2 md:mt-4 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-indigo-300/80 hover:text-indigo-200 transition-colors bg-white/5 px-3 md:px-4 py-1.5 md:py-2 rounded-xl border border-white/5 mx-auto md:mx-0"
          >
            <TrendingUp size={12} className="md:w-[14px] md:h-[14px]" /> {showProgress ? 'Ocultar Progresso' : 'Ver Meta Mensal'}
          </button>
        )}
      </div>
      <div className="relative z-10 flex flex-row gap-2 md:gap-4 w-full md:w-auto">
        <div className="bg-white/10 backdrop-blur-xl px-3 py-2 md:p-8 rounded-xl md:rounded-[2.5rem] border border-white/10 flex flex-row md:flex-col items-center justify-between md:justify-center gap-2 md:gap-0 flex-1 md:min-w-[150px]">
          <p className="text-[9px] md:text-[10px] font-black uppercase opacity-60 md:mb-1 shrink-0">Hoje</p>
          <div className="text-lg md:text-5xl font-black">{formatHours(todayHours)}</div>
        </div>
        <div className="bg-indigo-500/20 backdrop-blur-xl px-3 py-2 md:p-8 rounded-xl md:rounded-[2.5rem] border border-indigo-400/30 flex flex-row md:flex-col items-center justify-between md:justify-center gap-2 md:gap-0 flex-1 md:min-w-[150px] shadow-inner relative">
          <p className="text-[9px] md:text-[10px] font-black uppercase text-indigo-300 md:mb-1 shrink-0">Mês</p>
          <div className="text-lg md:text-5xl font-black text-indigo-50 flex items-baseline gap-1 justify-center">
            {formatHours(totalMonthHours)}
            {myApproval && <CheckCircle size={12} className="text-emerald-400 md:hidden" />}
          </div>
          {myApproval && (
            <div className="hidden md:flex items-center justify-center gap-1 text-[9px] font-black uppercase text-emerald-300 bg-emerald-500/20 px-3 py-1 rounded-full border border-emerald-400/30 w-full text-center mt-2">
              <CheckCircle size={12} className="shrink-0" /> Aprovado
              <span className="opacity-90">{new Date(myApproval.timestamp).toLocaleDateString('pt-PT')}</span>
            </div>
          )}
        </div>
      </div>
      {expectedHours > 0 && showProgress && (
        <div className="relative z-10 w-full mt-8 md:mt-12 pt-6 md:pt-10 border-t border-white/10 animate-in slide-in-from-top-4 duration-500">
          <div className="flex justify-between items-end mb-4">
            <div className="flex flex-col gap-0.5">
              <p className="text-[10px] font-black uppercase text-indigo-300 tracking-[0.2em]">Meta Mensal</p>
              <span className="text-3xl md:text-5xl font-black text-white">{formatHours(expectedHours)}</span>
            </div>
            <div className="bg-indigo-500/30 px-4 py-2 rounded-2xl border border-indigo-400/40 shadow-lg">
              <span className="text-xl md:text-2xl font-black text-indigo-100">{Math.round((totalMonthHours / expectedHours) * 100)}%</span>
            </div>
          </div>
          <div className="h-4 bg-slate-800/80 rounded-full p-1 border border-white/5 shadow-inner backdrop-blur-sm">
            <div
              className="h-full bg-gradient-to-r from-indigo-600 via-indigo-400 to-indigo-300 rounded-full shadow-[0_0_20px_rgba(99,102,241,0.5)] transition-all duration-[1500ms] ease-out relative overflow-hidden"
              style={{ width: `${Math.min(100, (totalMonthHours / expectedHours) * 100)}%` }}
            >
              <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent_0%,rgba(255,255,255,0.2)_50%,transparent_100%)]" style={{ backgroundSize: '200% 100%' }} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
