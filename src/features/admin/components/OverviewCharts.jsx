import { useState } from 'react'
import { useAdminData } from '../context/AdminDataProvider'
import { useAdminOverviewData } from '../hooks/useAdminOverviewData'
import { formatCurrency } from '../../../utils/formatUtils'
import { TrendingUp, Wallet, ChevronDown } from 'lucide-react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts'

export default function OverviewCharts() {
  const { currentMonth } = useAdminData()
  const {
    areaData, pieData, subCategoriasCredito, subCategoriasDebito,
    badgeTotals, ytdTotals, badgeDetails, resultado
  } = useAdminOverviewData()

  const [expandedItems, setExpandedItems] = useState([])
  const [detailsPage, setDetailsPage] = useState(1)

  return (
    <>
      {/* Area Chart - 1/2 */}
      <div className="bg-white p-4 sm:p-6 lg:p-8 rounded-2xl sm:rounded-[2.5rem] shadow-sm border border-slate-100">
        <div className="flex items-center gap-3 mb-6">
          <div className="bg-indigo-50 p-2 rounded-xl text-indigo-600"><TrendingUp size={20} /></div>
          <h3 className="font-black text-lg text-slate-800">Fluxo de Faturamento Diário</h3>
        </div>
        {areaData.length > 0 ? (
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={areaData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorValor" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="date" stroke="#94a3b8" fontSize={10} tickLine={false} />
              <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} tickFormatter={(v) => `€${v}`} />
              <Tooltip
                contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                formatter={(value) => [`€${value}`, 'Faturamento']}
              />
              <Area type="monotone" dataKey="valor" stroke="#6366f1" strokeWidth={2} fill="url(#colorValor)" />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[280px] flex items-center justify-center text-slate-400 text-sm">
            Sem dados de faturação para exibir
          </div>
        )}
      </div>

      {/* Pie Chart - 1/2 */}
      <div className="bg-white p-4 sm:p-6 lg:p-8 rounded-2xl sm:rounded-[2.5rem] shadow-sm border border-slate-100">
        <div className="flex items-center gap-3 mb-6">
          <div className="bg-indigo-50 p-2 rounded-xl text-indigo-600"><Wallet size={20} /></div>
          <h3 className="font-black text-lg text-slate-800">Resumo Financeiro</h3>
        </div>
        {pieData.some(p => p.value > 0) ? (
          <div className="relative flex items-center justify-center">
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={70}
                  outerRadius={105}
                  paddingAngle={2}
                  dataKey="value"
                  startAngle={90}
                  endAngle={-270}
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} stroke="white" strokeWidth={2} />
                  ))}
                </Pie>
                <Tooltip formatter={(value, name) => formatCurrency(value)} />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-[9px] font-black text-slate-400 uppercase">{currentMonth.getFullYear()}</span>
              <span className={`text-lg font-black ${ytdTotals.receitas - ytdTotals.despesas >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                {formatCurrency(ytdTotals.receitas - ytdTotals.despesas)}
              </span>
            </div>
          </div>
        ) : null}
        <div className="space-y-3 mt-4">
          {['Receitas', 'Despesa'].map(tipoNome => {
            const tipoKey = tipoNome === 'Receitas' ? 'credito' : 'debito'
            const itemData = pieData.filter(p => p.tipo === tipoKey)
            const totalValue = tipoKey === 'credito' ? badgeTotals.receitas : badgeTotals.despesas
            const isExpanded = expandedItems.includes(tipoNome)
            const subCats = tipoKey === 'credito' ? subCategoriasCredito : subCategoriasDebito

            return (
              <div key={tipoNome}>
                <div
                  onClick={() => {
                    setExpandedItems(prev => isExpanded ? prev.filter(i => i !== tipoNome) : [...prev, tipoNome])
                    setDetailsPage(1)
                  }}
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
                      const isSubExpanded = expandedItems.includes(`${tipoNome}-${sub.name}`)
                      const subBadgeItems = badgeDetails.filter(t => t.badge === sub.badgeKey && t.tipo === tipoKey)
                      const totalPages = Math.ceil(subBadgeItems.length / 10)
                      const paginatedItems = subBadgeItems
                        .sort((a, b) => new Date(b.date) - new Date(a.date))
                        .slice((detailsPage - 1) * 10, detailsPage * 10)

                      return (
                        <div key={sub.name}>
                          <div
                            onClick={(e) => {
                              e.stopPropagation()
                              const key = `${tipoNome}-${sub.name}`
                              setExpandedItems(prev => isSubExpanded ? prev.filter(i => i !== key) : [...prev, key])
                              setDetailsPage(1)
                            }}
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

                          {isSubExpanded && (
                            <div className="mt-1 pl-4 border-l border-slate-100">
                              <table className="w-full text-[11px]">
                                <thead>
                                  <tr className="text-[9px] font-black uppercase text-slate-400">
                                    <th className="text-left py-1 pr-4">Data</th>
                                    <th className="text-left py-1 pr-4">Descrição</th>
                                    <th className="text-right py-1 pr-4">Valor</th>
                                    <th className="text-right py-1">Detalhe</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {subBadgeItems.length === 0 ? (
                                    <tr><td colSpan="4" className="text-xs text-slate-400 py-2 text-center">Sem dados</td></tr>
                                  ) : (
                                    paginatedItems.map((tx, idx) => (
                                      <tr key={idx} className="hover:bg-slate-50">
                                        <td className="py-1.5 pr-4 font-mono text-slate-500 whitespace-nowrap">{tx.date}</td>
                                        <td className="py-1.5 pr-4 text-slate-600 truncate max-w-[150px]" title={tx.descricao}>{tx.descricao}</td>
                                        <td className={`py-1.5 pr-4 text-right font-bold whitespace-nowrap ${tx.tipo === 'credito' ? 'text-emerald-600' : 'text-rose-600'}`}>
                                          {formatCurrency(tx.valor)}
                                        </td>
                                        <td className="py-1.5 text-right text-slate-400 truncate max-w-[100px]" title={tx.clienteNome || tx.workerName || tx.faturaFornecedor || tx.justificacao || '—'}>
                                          {tx.clienteNome || tx.workerName || tx.faturaFornecedor || tx.justificacao || '—'}
                                        </td>
                                      </tr>
                                    ))
                                  )}
                                </tbody>
                              </table>
                              {totalPages > 1 && (
                                <div className="flex justify-center gap-1 pt-2">
                                  <button
                                    onClick={(e) => { e.stopPropagation(); setDetailsPage(p => Math.max(1, p - 1)) }}
                                    disabled={detailsPage === 1}
                                    className="px-2 py-1 text-xs font-bold bg-slate-100 rounded-lg disabled:opacity-40 hover:bg-slate-200 transition-colors"
                                  >‹</button>
                                  <span className="px-2 py-1 text-xs font-bold text-slate-500">{detailsPage}/{totalPages}</span>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); setDetailsPage(p => Math.min(totalPages, p + 1)) }}
                                    disabled={detailsPage === totalPages}
                                    className="px-2 py-1 text-xs font-bold bg-slate-100 rounded-lg disabled:opacity-40 hover:bg-slate-200 transition-colors"
                                  >›</button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
        <div className="mt-4 pt-4 border-t border-slate-100 flex justify-between items-center">
          <span className="text-sm font-black text-slate-700">Resultado</span>
          <span className={`text-sm font-black ${resultado >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
            {formatCurrency(resultado)}
          </span>
        </div>
      </div>
    </>
  )
}