import React, { useState, useMemo } from 'react';
import { X, Wallet, BrainCircuit, Sparkles, Users, Receipt } from 'lucide-react';
import CompanyLogo from '../../components/common/CompanyLogo';
import { useApp } from '../../context/AppContext';
import { formatCurrency } from '../../utils/formatUtils';
import { callGemini } from '../../utils/aiUtils';

const FinancialReportOverlay = ({ logs, workers, clients, expenses, finFilter, setFinFilter, setShowFinReport }) => {
  const { systemSettings } = useApp();
  const [insight, setInsight] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [activeTab, setActiveTab] = useState('resumo');

  const { stats, filteredLogs, filteredExpenses } = useMemo(() => {
    let revenue = 0, teamCosts = 0, totalExpenses = 0;
    const fLogs = logs.filter(l => (finFilter.start ? l.date >= finFilter.start : true) && (finFilter.end ? l.date <= finFilter.end : true));
    fLogs.forEach(log => {
      const w = workers.find(work => work.id === log.workerId);
      const c = clients.find(cl => cl.id === log.clientId);
      revenue += log.hours * (Number(c?.valorHora) || 0);
      teamCosts += log.hours * (Number(w?.valorHora) || 0);
    });
    const fExpenses = expenses.filter(e => (finFilter.start ? e.date >= finFilter.start : true) && (finFilter.end ? e.date <= finFilter.end : true));
    fExpenses.forEach(exp => totalExpenses += Number(exp.amount) || 0);
    return {
      stats: { revenue, teamCosts, totalExpenses, netProfit: revenue - teamCosts - totalExpenses },
      filteredLogs: fLogs,
      filteredExpenses: fExpenses,
    };
  }, [logs, workers, clients, expenses, finFilter]);

  const workerCosts = useMemo(() => {
    const map = {};
    filteredLogs.forEach(log => {
      const w = workers.find(work => work.id === log.workerId);
      if (!w) return;
      if (!map[log.workerId]) map[log.workerId] = { name: w.name || w.nome || '—', valorHora: Number(w.valorHora) || 0, hours: 0 };
      map[log.workerId].hours += log.hours;
    });
    return Object.values(map)
      .map(r => ({ ...r, total: r.hours * r.valorHora }))
      .sort((a, b) => b.total - a.total);
  }, [filteredLogs, workers]);

  const generateInsight = async () => {
    setIsAnalyzing(true);
    try {
      const prompt = `Analise financeiramente os dados: Faturamento ${stats.revenue}€, Custos Staff ${stats.teamCosts}€, Outras Despesas ${stats.totalExpenses}€, Lucro ${stats.netProfit}€. Sugira 3 estratégias curtas para melhorar o lucro.`;
      const res = await callGemini(prompt, "Você é um consultor financeiro sênior da empresa.", systemSettings.geminiApiKey);
      setInsight(res);
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-lg z-[200] flex items-center justify-center p-4 font-sans text-slate-900">
      <div className="bg-white w-full max-w-6xl h-[94vh] rounded-[3rem] flex flex-col shadow-2xl overflow-hidden border border-white/20">
        {/* Header */}
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

        {/* Tabs */}
        <div className="flex gap-1 px-8 pt-4 pb-0 border-b border-slate-100 bg-white">
          {[{ id: 'resumo', label: 'Resumo' }, { id: 'custo', label: 'Custo' }].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-5 py-2 rounded-t-xl text-xs font-bold uppercase tracking-widest transition-all border-b-2 ${activeTab === tab.id ? 'border-indigo-600 text-indigo-600 bg-indigo-50' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8 space-y-8 bg-white text-slate-900">
          {activeTab === 'resumo' && (
            <>
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
            </>
          )}

          {activeTab === 'custo' && (
            <>
              {/* Custo por Trabalhador */}
              <div>
                <h4 className="flex items-center gap-2 font-black text-slate-700 text-sm uppercase tracking-widest mb-4"><Users size={16} className="text-indigo-500" /> Custo por Trabalhador</h4>
                {workerCosts.length === 0 ? (
                  <p className="text-slate-400 text-sm">Sem registos no período selecionado.</p>
                ) : (
                  <div className="rounded-2xl border border-slate-100 overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 text-slate-500 text-[10px] uppercase tracking-widest">
                        <tr>
                          <th className="text-left px-5 py-3 font-black">Trabalhador</th>
                          <th className="text-right px-5 py-3 font-black">Horas</th>
                          <th className="text-right px-5 py-3 font-black">Custo/h</th>
                          <th className="text-right px-5 py-3 font-black">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {workerCosts.map((r, i) => (
                          <tr key={i} className="hover:bg-slate-50/60 transition-colors">
                            <td className="px-5 py-3 font-semibold text-slate-800">{r.name}</td>
                            <td className="px-5 py-3 text-right text-slate-600 font-mono">{r.hours.toFixed(1)}h</td>
                            <td className="px-5 py-3 text-right text-slate-600 font-mono">{formatCurrency(r.valorHora)}</td>
                            <td className="px-5 py-3 text-right font-black text-slate-800">{formatCurrency(r.total)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-indigo-50">
                        <tr>
                          <td colSpan={3} className="px-5 py-3 text-xs font-black text-indigo-700 uppercase tracking-widest">Subtotal Staff</td>
                          <td className="px-5 py-3 text-right font-black text-indigo-700">{formatCurrency(stats.teamCosts)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </div>

              {/* Outras Despesas */}
              <div>
                <h4 className="flex items-center gap-2 font-black text-slate-700 text-sm uppercase tracking-widest mb-4"><Receipt size={16} className="text-rose-500" /> Outras Despesas</h4>
                {filteredExpenses.length === 0 ? (
                  <p className="text-slate-400 text-sm">Sem despesas no período selecionado.</p>
                ) : (
                  <div className="rounded-2xl border border-slate-100 overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 text-slate-500 text-[10px] uppercase tracking-widest">
                        <tr>
                          <th className="text-left px-5 py-3 font-black">Data</th>
                          <th className="text-left px-5 py-3 font-black">Descrição</th>
                          <th className="text-right px-5 py-3 font-black">Valor</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {filteredExpenses.map((exp, i) => (
                          <tr key={i} className="hover:bg-slate-50/60 transition-colors">
                            <td className="px-5 py-3 text-slate-500 font-mono text-xs">{exp.date}</td>
                            <td className="px-5 py-3 text-slate-700 font-semibold">{exp.description || exp.descricao || '—'}</td>
                            <td className="px-5 py-3 text-right font-black text-slate-800">{formatCurrency(Number(exp.amount) || 0)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-rose-50">
                        <tr>
                          <td colSpan={2} className="px-5 py-3 text-xs font-black text-rose-700 uppercase tracking-widest">Subtotal Despesas</td>
                          <td className="px-5 py-3 text-right font-black text-rose-700">{formatCurrency(stats.totalExpenses)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </div>

              {/* Totais */}
              <div className="rounded-3xl border border-slate-200 overflow-hidden">
                <div className="bg-slate-50 px-5 py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest">Resumo de Custos</div>
                <div className="divide-y divide-slate-100">
                  <div className="flex justify-between px-5 py-3 text-sm text-slate-600"><span>Custo Staff</span><span className="font-bold font-mono">{formatCurrency(stats.teamCosts)}</span></div>
                  <div className="flex justify-between px-5 py-3 text-sm text-slate-600"><span>Outras Despesas</span><span className="font-bold font-mono">{formatCurrency(stats.totalExpenses)}</span></div>
                  <div className="flex justify-between px-5 py-4 bg-slate-900 text-white"><span className="font-black uppercase text-xs tracking-widest">Total de Custos</span><span className="font-black font-mono text-lg">{formatCurrency(stats.teamCosts + stats.totalExpenses)}</span></div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default FinancialReportOverlay;
