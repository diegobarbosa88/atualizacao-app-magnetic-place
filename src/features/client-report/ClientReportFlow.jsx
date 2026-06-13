import React, { useMemo, useState } from 'react';
import { AlertCircle, CheckCircle, ChevronDown, ChevronLeft, MessageCircle, Sparkles } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { submitCorrection } from '../../utils/correctionsApi';
import MonthStatusBadge from './components/MonthStatusBadge';
import HistoryItem from './components/HistoryItem';
import StepQuick from './components/StepQuick';
import { StepPrecision } from './StepPrecision';

export { StepPrecision } from './StepPrecision';

const ClientReportFlow = ({ clientId, month, workers, logs, onClose, initialStep }) => {
  const { supabase, corrections, correctionItems, companySignature, clients } = useApp();
  const [step, setStep] = useState(initialStep || 'home');
  const [busy, setBusy] = useState(false);
  const clientObj = clients?.find((c) => String(c.id) === String(clientId));

  const myCorrections = useMemo(
    () => (corrections || [])
      .filter((c) => String(c.client_id) === String(clientId))
      .sort((a, b) => (b.submitted_at || '').localeCompare(a.submitted_at || '')),
    [corrections, clientId]
  );
  const thisMonthCorrections = myCorrections.filter((c) => c.month === month);
  const hasOpen = thisMonthCorrections.some((c) => c.status === 'submitted' || c.status === 'under_review');

  const handleSubmit = async ({ justification, items }, type) => {
    setBusy(true);
    try {
      await submitCorrection(supabase, { clientId, month, type, justification, items, adminEmail: companySignature?.responsibleEmail, clientName: clientObj?.name });
      setStep('success');
    } catch (e) {
      alert('Erro ao submeter: ' + e.message);
    } finally {
      setBusy(false);
    }
  };

  if (step === 'success') {
    return (
      <div className="max-w-xl mx-auto py-16 text-center animate-fade-in">
        <div className="w-24 h-24 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle size={48} />
        </div>
        <h2 className="text-3xl font-black text-slate-800 uppercase tracking-tighter mb-2">Pedido enviado</h2>
        <p className="text-slate-500 text-sm font-medium mb-8">O administrador foi notificado e vai analisar a sua correção.</p>
        <button onClick={() => { setStep('home'); onClose?.(); }} className="px-6 py-3 bg-slate-900 text-white rounded-xl font-black text-[10px] uppercase tracking-widest">Voltar ao Portal</button>
      </div>
    );
  }

  if (step === 'mode') return (
    <div className="max-w-2xl mx-auto py-6 animate-fade-in">
      <button onClick={() => initialStep === 'mode' ? onClose?.() : setStep('home')} className="flex items-center gap-2 text-slate-400 hover:text-slate-700 font-black text-[10px] uppercase tracking-widest mb-6">
        <ChevronLeft size={14} /> Voltar
      </button>
      <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tight mb-2">Tipo de reporte</h2>
      <p className="text-slate-500 text-sm font-medium mb-8">Escolha como quer reportar a divergência deste mês.</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <button onClick={() => setStep('quick')} className="text-left p-6 bg-white border-2 border-indigo-200 hover:border-indigo-400 rounded-2xl transition-all group">
          <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center mb-4 group-hover:bg-indigo-600 group-hover:text-white transition-colors"><MessageCircle size={24} /></div>
          <h3 className="text-lg font-black text-slate-800 mb-2">Mensagem Rápida</h3>
          <p className="text-slate-500 text-sm font-medium leading-relaxed">Descreva o problema em texto livre. Ideal para quando não sabe os detalhes exatos dos horários.</p>
          <div className="mt-4 flex items-center gap-1 text-indigo-600 font-black text-[10px] uppercase tracking-widest">Escolher este <ChevronDown size={12} className="-rotate-90" /></div>
        </button>
        <button onClick={() => setStep('precision')} className="text-left p-6 bg-white border-2 border-amber-200 hover:border-amber-400 rounded-2xl transition-all group">
          <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-xl flex items-center justify-center mb-4 group-hover:bg-amber-600 group-hover:text-white transition-colors"><Sparkles size={24} /></div>
          <h3 className="text-lg font-black text-slate-800 mb-2">Ajuste de Precisão</h3>
          <p className="text-slate-500 text-sm font-medium leading-relaxed">Edite os horários diretamente no relatório. Ideal para correções específicas de horas e pausas.</p>
          <div className="mt-4 flex items-center gap-1 text-amber-600 font-black text-[10px] uppercase tracking-widest">Escolher este <ChevronDown size={12} className="-rotate-90" /></div>
        </button>
      </div>
    </div>
  );

  if (step === 'quick') return <StepQuick onBack={() => setStep('mode')} busy={busy} onSubmit={(p) => handleSubmit(p, 'quick')} />;
  if (step === 'precision') return <StepPrecision workers={workers} logs={logs} month={month} onBack={() => setStep('mode')} busy={busy} onSubmit={(p) => handleSubmit(p, 'precision')} />;

  return (
    <div className="max-w-3xl mx-auto py-6 animate-fade-in">
      <header className="bg-white rounded-3xl border border-slate-100 p-6 mb-6 flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tight">Folha do mês {month}</h2>
          <div className="mt-2"><MonthStatusBadge corrections={thisMonthCorrections} /></div>
        </div>
        <button
          onClick={() => setStep('mode')}
          disabled={hasOpen}
          title={hasOpen ? 'Já existe uma correção em aberto para este mês' : ''}
          className="px-5 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black text-[10px] uppercase tracking-widest disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
        >
          <AlertCircle size={14} /> Reportar Divergência
        </button>
      </header>
      <section>
        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Histórico</h3>
        <div className="space-y-2">
          {myCorrections.length === 0 && (
            <div className="bg-white rounded-2xl border border-slate-100 p-6 text-sm text-slate-400 text-center">Ainda sem reportes submetidos.</div>
          )}
          {myCorrections.map((c) => (
            <HistoryItem key={c.id} correction={c} items={correctionItems || []} />
          ))}
        </div>
      </section>
      {onClose && (
        <div className="mt-8 text-center">
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 font-black text-[10px] uppercase tracking-widest">Voltar ao Portal</button>
        </div>
      )}
    </div>
  );
};

export default ClientReportFlow;
