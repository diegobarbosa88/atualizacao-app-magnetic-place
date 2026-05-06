import React, { useState, useMemo } from 'react';
import { X, Wallet, BrainCircuit, Sparkles } from 'lucide-react';
import CompanyLogo from '../../components/common/CompanyLogo';
import { useApp } from '../../context/AppContext';
import { formatCurrency } from '../../utils/formatUtils';
import { callGemini } from '../../utils/aiUtils';

const FinancialReportOverlay = ({ logs, workers, clients, expenses, finFilter, setFinFilter, setShowFinReport }) => {
  const { systemSettings } = useApp();
  const [insight, setInsight] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const stats = useMemo(() => {
    let revenue = 0, teamCosts = 0, totalExpenses = 0;
    const filteredLogs = logs.filter(l => (finFilter.start ? l.date >= finFilter.start : true) && (finFilter.end ? l.date <= finFilter.end : true));
    filteredLogs.forEach(log => {
      const w = workers.find(work => work.id === log.workerId);
      const c = clients.find(cl => cl.id === log.clientId);
      revenue += log.hours * (Number(c?.valorHora) || 0);
      teamCosts += log.hours * (Number(w?.valorHora) || 0);
    });
    const filteredExpenses = expenses.filter(e => (finFilter.start ? e.date >= finFilter.start : true) && (finFilter.end ? e.date <= finFilter.end : true));
    filteredExpenses.forEach(exp => totalExpenses += Number(exp.amount) || 0);
    return { revenue, teamCosts, totalExpenses, netProfit: revenue - teamCosts - totalExpenses };
  }, [logs, workers, clients, expenses, finFilter]);

  const generateInsight = async () => {
    setIsAnalyzing(true);
    const prompt = `Analise financeiramente os dados: Faturamento ${stats.revenue}€, Custos Staff ${stats.teamCosts}€, Outras Despesas ${stats.totalExpenses}€, Lucro ${stats.netProfit}€. Sugira 3 estratégias curtas para melhorar o lucro.`;
    const res = await callGemini(prompt, "Você é um consultor financeiro sênior da empresa.", systemSettings.geminiApiKey);
    setInsight(res);
    setIsAnalyzing(false);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-lg z-[200] flex items-center justify-center p-4 font-sans text-slate-900">
      <div className="bg-white w-full max-w-6xl h-[94vh] rounded-[3rem] flex flex-col shadow-2xl overflow-hidden border border-white/20">
        <div className="p-8 border-b border-slate-100 flex flex-col md:flex-row justify-between items-center gap-6 bg-slate-50/80">
          <div className="flex items-center gap-4">
            <CompanyLogo className="h-10 w-10" />
            <div>
              <h3 className="font-black text-slate-800 text-2xl tracking-tighter">Relatório Financeiro Interno</h3>
              <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">Gestão de Rentabilidade</p>
            </div>
          </div>
          <div className="flex items-center gap-4 bg-white p-3 rounded-3xl border border-slate-200 shadow-sm text-slate-900">
            <input type="date" className="bg-slate-50 border-none rounded-xl p-2 text-xs font-bold text-slate-600 outline-none" value={finFilter.start} onChange={e => setFinFilter({ ...finFilter, start: e.target.value })} />
            <span className="text-slate-300">→</span>
            <input type="date" className="bg-slate-50 border-none rounded-xl p-2 text-xs font-bold text-slate-600 outline-none" value={finFilter.end} onChange={e => setFinFilter({ ...finFilter, end: e.target.value })} />
            <button onClick={() => setShowFinReport(false)} className="p-2.5 bg-slate-100 text-slate-400 hover:text-red-500 rounded-xl transition-all shadow-sm"><X size={20} /></button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-8 space-y-8 bg-white text-slate-900">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-indigo-50 p-6 rounded-3xl border border-indigo-100"><div className="flex items-center gap-3 text-indigo-600 mb-2 font-black uppercase text-[10px] tracking-widest">Faturação Potencial</div><p className="text-3xl font-black">{formatCurrency(stats.revenue)}</p></div>
            <div className="bg-red-50 p-6 rounded-3xl border border-red-100"><div className="flex items-center gap-3 text-red-600 mb-2 font-black uppercase text-[10px] tracking-widest">Despesas + Staff</div><p className="text-3xl font-black">{formatCurrency(stats.teamCosts + stats.totalExpenses)}</p></div>
            <div className={`p-6 rounded-3xl border ${stats.netProfit >= 0 ? 'bg-emerald-50 border-emerald-100' : 'bg-rose-50 border-rose-100'}`}>
              <div className={`flex items-center gap-3 mb-2 ${stats.netProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}><Wallet size={20} /><span className="text-[10px] font-black uppercase tracking-widest">Resultado Líquido Estimado</span></div>
              <p className="text-3xl font-black">{formatCurrency(stats.netProfit)}</p>
            </div>
          </div>
          <div className="p-8 rounded-[2.5rem] bg-slate-900 text-white relative overflow-hidden">
            <div className="absolute right-0 top-0 p-8 opacity-10"><BrainCircuit size={120} /></div>
            <div className="relative z-10">
              <div className="flex justify-between items-center mb-4">
                <h4 className="font-bold flex items-center gap-2"><Sparkles className="text-amber-400" size={20} /> Insights do Consultor AI</h4>
                <button onClick={generateInsight} disabled={isAnalyzing} className="bg-indigo-600 hover:bg-indigo-700 px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-lg border border-indigo-400/30 text-white">
                  {isAnalyzing ? "Analisando..." : "Gerar Análise Estratégica"}
                </button>
              </div>
              <p className="text-sm text-slate-300 italic whitespace-pre-line leading-relaxed">{insight || "Clique no botão para que a inteligência artificial analise o desempenho financeiro."}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FinancialReportOverlay;
