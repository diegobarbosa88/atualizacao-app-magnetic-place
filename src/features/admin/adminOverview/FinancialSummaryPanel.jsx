import React, { useState } from 'react';
import { Wallet, ChevronDown } from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { formatCurrency } from '../../../utils/formatUtils';

const PIE_SLICES = [
  { name: 'R. Cliente',  tipo: 'credito', badgeKey: 'cliente',     color: '#22c55e' },
  { name: 'R. Recibo',   tipo: 'credito', badgeKey: 'recibo',      color: '#16a34a' },
  { name: 'R. Fatura',   tipo: 'credito', badgeKey: 'fatura',      color: '#15803d' },
  { name: 'R. Justif.',  tipo: 'credito', badgeKey: 'justificado', color: '#166534' },
  { name: 'D. Cliente',  tipo: 'debito',  badgeKey: 'cliente',     color: '#ef4444' },
  { name: 'D. Recibo',   tipo: 'debito',  badgeKey: 'recibo',      color: '#dc2626' },
  { name: 'D. Fatura',   tipo: 'debito',  badgeKey: 'fatura',      color: '#b91c1c' },
  { name: 'D. Imposto',  tipo: 'debito',  badgeKey: 'imposto',     color: '#991b1b' },
  { name: 'D. Justif.',  tipo: 'debito',  badgeKey: 'justificado', color: '#7f1d1d' },
];

export default function FinancialSummaryPanel({ badgeTotals, badgeDetails, ytdTotals, currentMonth }) {
  const [expandedItems, setExpandedItems] = useState([]);
  const [detailsPage, setDetailsPage] = useState(1);

  const pieData = PIE_SLICES
    .map(item => {
      const value = badgeDetails
        .filter(t => t.badge === item.badgeKey && t.tipo === item.tipo)
        .reduce((sum, t) => sum + t.valor, 0);
      return { ...item, value };
    })
    .filter(p => p.value > 0);

  const resultado = badgeTotals.receitas - badgeTotals.despesas;
  const ytdResult = ytdTotals.receitas - ytdTotals.despesas;

  const toggle = (key) => {
    setExpandedItems(prev => prev.includes(key) ? prev.filter(i => i !== key) : [...prev, key]);
    setDetailsPage(1);
  };

  return (
    <div className="bg-white p-4 sm:p-6 lg:p-8 rounded-2xl sm:rounded-[2.5rem] shadow-sm border border-slate-100">
      <div className="flex items-center gap-3 mb-6">
        <div className="bg-indigo-50 p-2 rounded-xl text-indigo-600"><Wallet size={20} /></div>
        <h3 className="font-black text-lg text-slate-800">Resumo Financeiro</h3>
      </div>

      {pieData.some(p => p.value > 0) && (
        <div className="relative flex items-center justify-center">
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={pieData} cx="50%" cy="50%"
                innerRadius={70} outerRadius={105}
                paddingAngle={2} dataKey="value"
                startAngle={90} endAngle={-270}
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} stroke="white" strokeWidth={2} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => formatCurrency(value)} />
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-[9px] font-black text-slate-400 uppercase">{currentMonth.getFullYear()}</span>
            <span className={`text-lg font-black ${ytdResult >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
              {formatCurrency(ytdResult)}
            </span>
          </div>
        </div>
      )}

      <div className="space-y-3 mt-4">
        {['Receitas', 'Despesa'].map(tipoNome => {
          const tipoKey = tipoNome === 'Receitas' ? 'credito' : 'debito';
          const itemData = pieData.filter(p => p.tipo === tipoKey);
          const totalValue = tipoKey === 'credito' ? badgeTotals.receitas : badgeTotals.despesas;
          const isExpanded = expandedItems.includes(tipoNome);

          return (
            <div key={tipoNome}>
              <div
                onClick={() => toggle(tipoNome)}
                className="flex items-center justify-between cursor-pointer hover:bg-slate-50 p-2 rounded-xl transition-colors"
              >
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: tipoKey === 'credito' ? '#22c55e' : '#ef4444' }} />
                  <span className="text-sm font-bold text-slate-700">{tipoNome}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-black text-slate-800">{formatCurrency(totalValue)}</span>
                  <ChevronDown size={14} className={`text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                </div>
              </div>

              {isExpanded && itemData.length > 0 && (
                <div className="mt-2 pl-4 border-l-2 border-slate-200 space-y-2">
                  {itemData.map(sub => {
                    const subKey = `${tipoNome}-${sub.name}`;
                    const isSubExpanded = expandedItems.includes(subKey);
                    const subBadgeItems = badgeDetails
                      .filter(t => t.badge === sub.badgeKey && t.tipo === tipoKey)
                      .sort((a, b) => new Date(b.date) - new Date(a.date));
                    const totalPages = Math.ceil(subBadgeItems.length / 10);
                    const paginatedItems = subBadgeItems.slice((detailsPage - 1) * 10, detailsPage * 10);

                    return (
                      <div key={sub.name}>
                        <div
                          onClick={(e) => { e.stopPropagation(); toggle(subKey); }}
                          className="flex items-center justify-between cursor-pointer hover:bg-slate-50 p-2 rounded-lg transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: sub.color }} />
                            <span className="text-xs font-bold text-slate-600">{sub.name}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-black text-slate-700">{formatCurrency(sub.value)}</span>
                            <ChevronDown size={12} className={`text-slate-400 transition-transform ${isSubExpanded ? 'rotate-180' : ''}`} />
                          </div>
                        </div>

                        {isSubExpanded && subBadgeItems.length > 0 && (
                          <div className="mt-1 ml-4 bg-slate-50 rounded-xl overflow-hidden">
                            <table className="w-full text-[10px]">
                              <thead>
                                <tr className="border-b border-slate-200">
                                  <th className="px-3 py-2 text-left font-black text-slate-500 uppercase tracking-widest">Data</th>
                                  <th className="px-3 py-2 text-left font-black text-slate-500 uppercase tracking-widest">Descrição</th>
                                  <th className="px-3 py-2 text-right font-black text-slate-500 uppercase tracking-widest">Valor</th>
                                </tr>
                              </thead>
                              <tbody>
                                {paginatedItems.map((item, idx) => (
                                  <tr key={idx} className="border-b border-slate-100 last:border-0">
                                    <td className="px-3 py-2 text-slate-600 font-mono whitespace-nowrap">{item.date}</td>
                                    <td className="px-3 py-2 text-slate-600 truncate max-w-[120px]">
                                      {item.clienteNome || item.workerName || item.faturaFornecedor || item.justificacao || item.descricao}
                                    </td>
                                    <td className="px-3 py-2 text-right font-black text-slate-700">{formatCurrency(item.valor)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                            {totalPages > 1 && (
                              <div className="flex justify-center gap-1 pt-2">
                                <button
                                  onClick={(e) => { e.stopPropagation(); setDetailsPage(p => Math.max(1, p - 1)); }}
                                  disabled={detailsPage === 1}
                                  className="px-2 py-1 text-xs font-bold bg-slate-100 rounded-lg disabled:opacity-40 hover:bg-slate-200 transition-colors"
                                >‹</button>
                                <span className="px-2 py-1 text-xs font-bold text-slate-500">{detailsPage}/{totalPages}</span>
                                <button
                                  onClick={(e) => { e.stopPropagation(); setDetailsPage(p => Math.min(totalPages, p + 1)); }}
                                  disabled={detailsPage === totalPages}
                                  className="px-2 py-1 text-xs font-bold bg-slate-100 rounded-lg disabled:opacity-40 hover:bg-slate-200 transition-colors"
                                >›</button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-4 pt-4 border-t border-slate-100 flex justify-between items-center">
        <span className="text-sm font-black text-slate-700">Resultado</span>
        <span className={`text-sm font-black ${resultado >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
          {formatCurrency(resultado)}
        </span>
      </div>
    </div>
  );
}
