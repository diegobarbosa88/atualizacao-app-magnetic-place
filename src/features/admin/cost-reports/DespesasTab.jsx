import React, { useState } from 'react';
import { Trash2, ChevronDown, Loader2 } from 'lucide-react';
import { formatCurrency, parseFaturaValor, getMonthLabel } from './costReportsUtils';
import { toISODateLocal } from '../../../utils/dateUtils';
import '../reconciliacao/reconciliacao-mockup.css';
import { FT } from '../../../styles/designTokens';

function TypeBadge({ tipo }) {
  if (tipo === 'fornecedor') return <span className="px-2 py-0.5 rounded-md text-[9px] font-black uppercase bg-rose-100 text-rose-700">Fornecedor</span>;
  if (tipo === 'cliente') return <span className="px-2 py-0.5 rounded-md text-[9px] font-black uppercase bg-emerald-100 text-emerald-700">Cliente</span>;
  return <span className="px-2 py-0.5 rounded-md text-[9px] font-black uppercase bg-slate-100 text-slate-500">Sem tipo</span>;
}

export default function DespesasTab({
  allExpensesSorted, totalAllExpenses, selectedMonth,
  faturasExcluidas, faturasClienteExcluidas, faturasSemData,
  excluirFaturaDespesa, restaurarFaturaDespesa,
  saveToDb, handleDelete,
}) {
  const [isAddingExpense, setIsAddingExpense] = useState(false);
  const [expenseForm, setExpenseForm] = useState({ id: null, name: '', amount: '', type: 'fixo', date: toISODateLocal(new Date()) });
  const [showExcluidas, setShowExcluidas] = useState(false);
  const [showSemData, setShowSemData] = useState(false);

  const handleSaveExpense = async () => {
    if (!expenseForm.name || !expenseForm.amount) return alert('Descrição e valor são obrigatórios');
    const eId = expenseForm.id || `e${Date.now()}`;
    await saveToDb('expenses', eId, { ...expenseForm, id: eId });
    setIsAddingExpense(false);
    setExpenseForm({ id: null, name: '', amount: '', type: 'fixo', date: toISODateLocal(new Date()) });
  };

  const nFornecedor = allExpensesSorted.filter(e => e._isFatura).length;

  return (
    <div>
      <div className="flex items-center justify-end mb-4">
        <button onClick={() => { setExpenseForm({ id: null, name: '', amount: '', type: 'fixo', date: toISODateLocal(new Date()) }); setIsAddingExpense(!isAddingExpense); }} className={`px-3 py-2 rounded-xl font-black text-xs uppercase shadow-sm transition-all border-2 ${isAddingExpense ? 'text-white' : 'hover:bg-slate-50'}`} style={isAddingExpense ? { backgroundColor: FT.navy, borderColor: FT.navy } : { borderColor: FT.slate, color: 'var(--navy)' }}>
          {isAddingExpense ? 'Fechar' : '+ Despesa'}
        </button>
      </div>

      {isAddingExpense && (
        <div className="mb-6 bg-white p-4 sm:p-6 rounded-2xl shadow-inner border border-slate-100">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Descrição</label>
              <input type="text" value={expenseForm.name} onChange={e => setExpenseForm({ ...expenseForm, name: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm outline-none shadow-sm font-bold" placeholder="Descrição..." />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Valor (€)</label>
              <input type="number" value={expenseForm.amount} onChange={e => setExpenseForm({ ...expenseForm, amount: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm font-bold text-rose-600 outline-none shadow-sm" placeholder="0.00" />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Tipo</label>
              <select value={expenseForm.type} onChange={e => setExpenseForm({ ...expenseForm, type: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm outline-none shadow-sm font-bold">
                <option value="fixo">Fixo</option>
                <option value="variável">Variável</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Data</label>
              <input type="date" value={expenseForm.date} onChange={e => setExpenseForm({ ...expenseForm, date: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm shadow-sm" />
            </div>
          </div>
          <div className="mt-6 flex items-center gap-3">
            <button onClick={handleSaveExpense} className="flex-1 text-white py-5 rounded-2xl font-black text-sm uppercase shadow-lg transition-colors hover:opacity-90" style={{ backgroundColor: FT.navy }}>Registar Gasto</button>
            <button onClick={() => { setIsAddingExpense(false); setExpenseForm({ id: null, name: '', amount: '', type: 'fixo', date: toISODateLocal(new Date()) }); }} className="px-6 py-5 bg-slate-100 text-slate-600 rounded-2xl font-black text-sm uppercase shadow-sm hover:bg-slate-200 transition-colors">Cancelar</button>
          </div>
        </div>
      )}

      {/* Faixa de estatísticas — mesmo padrão visual da Reconciliação Bancária */}
      <div className="recon-scope">
        <div className="recon-stat-strip mb-6" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
          <div className="recon-stat">
            <p className="recon-stat-label">Total Despesas — {getMonthLabel(selectedMonth)}</p>
            <p className="recon-stat-value" style={{ color: 'var(--navy)' }}>{formatCurrency(totalAllExpenses)}</p>
          </div>
          <div className="recon-stat">
            <p className="recon-stat-label">Faturas de Fornecedor</p>
            <p className="recon-stat-value" style={{ color: 'var(--navy)' }}>{nFornecedor}</p>
            <p className="recon-stat-sub">contam para despesas</p>
          </div>
          <div className="recon-stat">
            <p className="recon-stat-label">Excluídas (cliente)</p>
            <p className="recon-stat-value" style={{ color: 'var(--red)' }}>{faturasClienteExcluidas.length}</p>
            <p className="recon-stat-sub">receita, não despesa — já não entram</p>
          </div>
        </div>
      </div>

      {/* Banner da fonte de verdade da data */}
      <div className="flex items-start gap-2.5 bg-white border border-slate-200 rounded-2xl px-4 py-3 mb-5 text-xs text-slate-500" style={{ borderLeftWidth: '3px', borderLeftColor: FT.slate }}>
        <span className="shrink-0">ℹ️</span>
        <p>Mês definido por <strong className="text-slate-700 font-black">data de pagamento</strong> quando disponível, senão <strong className="text-slate-700 font-black">data da fatura</strong>. Faturas sem nenhuma das duas aparecem em <strong className="text-slate-700 font-black">Faturas sem data</strong> — nunca atribuídas silenciosamente a um mês.</p>
      </div>

      <div className="overflow-x-auto -mx-2">
        <table className="w-full text-left border-separate border-spacing-y-2">
          <thead>
            <tr className="text-slate-400">
              <th className="px-4 py-2 text-[10px] font-black uppercase tracking-widest">Data</th>
              <th className="px-4 py-2 text-[10px] font-black uppercase tracking-widest">Descrição</th>
              <th className="px-4 py-2 text-[10px] font-black uppercase tracking-widest">Tipo</th>
              <th className="px-4 py-2 text-[10px] font-black uppercase tracking-widest text-right">Valor</th>
              <th className="px-4 py-2 text-[10px] font-black uppercase tracking-widest text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {allExpensesSorted.length === 0 ? (
              <tr><td colSpan="5" className="py-16 text-center text-slate-400 text-sm font-medium">Sem despesas para o período selecionado.</td></tr>
            ) : allExpensesSorted.map((exp) => (
              <tr key={exp.id} className="bg-slate-50/30 hover:bg-white hover:shadow-md transition-all duration-300">
                <td className="px-4 py-3 rounded-l-2xl border-y border-l border-slate-100 text-xs font-bold text-slate-500 whitespace-nowrap font-mono">
                  {new Date(exp.date).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                </td>
                <td className="px-4 py-3 border-y border-slate-100 text-sm font-bold text-slate-800">{exp.name}</td>
                <td className="px-4 py-3 border-y border-slate-100">
                  {exp._isFatura ? (
                    <TypeBadge tipo={exp._tipo === 'fornecedor' ? 'fornecedor' : exp._tipo ? exp._tipo : 'indefinido'} />
                  ) : (
                    <span className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase ${exp.type === 'fixo' ? 'bg-slate-100 text-slate-600' : 'bg-amber-100 text-amber-700'}`}>{exp.type}</span>
                  )}
                </td>
                <td className="px-4 py-3 border-y border-slate-100 font-black text-rose-600 text-right whitespace-nowrap">-{formatCurrency(exp.amount)}</td>
                <td className="px-4 py-3 rounded-r-2xl border-y border-r border-slate-100 text-right">
                  {exp._isFatura ? (
                    <button onClick={() => excluirFaturaDespesa(exp._faturaId)} className="p-1.5 text-rose-400 hover:bg-rose-50 rounded-xl transition-all" title="Excluir das despesas"><Trash2 size={15} /></button>
                  ) : (
                    <button onClick={() => handleDelete('expenses', exp.id)} className="p-1.5 text-rose-400 hover:bg-rose-50 rounded-xl transition-all"><Trash2 size={15} /></button>
                  )}
                </td>
              </tr>
            ))}
            {allExpensesSorted.length > 0 && (
              <tr className="bg-slate-100/60">
                <td colSpan="3" className="px-4 py-3 rounded-l-2xl text-[10px] font-black uppercase text-slate-500">Total</td>
                <td className="px-4 py-3 font-black text-rose-600 text-right">-{formatCurrency(totalAllExpenses)}</td>
                <td className="px-4 py-3 rounded-r-2xl"></td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Excluídas — faturas de cliente (estrutural: tipo='cliente', nunca contam como despesa) */}
      {faturasClienteExcluidas.length > 0 && (
        <div className="mt-8">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-3">
            Excluídas deste total — faturas de cliente
            <span className="ml-2 text-slate-400 font-bold normal-case tracking-normal">
              {faturasClienteExcluidas.length} faturas · {formatCurrency(faturasClienteExcluidas.reduce((s, f) => s + parseFaturaValor(f), 0))}
            </span>
          </p>
          <div className="overflow-x-auto -mx-2">
            <table className="w-full text-left border-separate border-spacing-y-1">
              <thead>
                <tr className="text-slate-300">
                  <th className="px-4 py-2 text-[10px] font-black uppercase tracking-widest">Cliente</th>
                  <th className="px-4 py-2 text-[10px] font-black uppercase tracking-widest">Tipo</th>
                  <th className="px-4 py-2 text-[10px] font-black uppercase tracking-widest">Data</th>
                  <th className="px-4 py-2 text-[10px] font-black uppercase tracking-widest text-right">Valor</th>
                </tr>
              </thead>
              <tbody>
                {faturasClienteExcluidas.map(f => {
                  const data_ref = f.dados?.data_pagamento || f.dados?.data_fatura;
                  return (
                    <tr key={f.id}>
                      <td className="px-4 py-2 rounded-l-xl border-y border-l border-slate-100 text-sm text-slate-700 font-bold">{f.dados?.fornecedor || f.entidade || '—'}</td>
                      <td className="px-4 py-2 border-y border-slate-100"><TypeBadge tipo="cliente" /></td>
                      <td className="px-4 py-2 border-y border-slate-100 text-xs font-bold text-slate-400 font-mono whitespace-nowrap">
                        {data_ref ? new Date(data_ref).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '—'}
                      </td>
                      <td className="px-4 py-2 rounded-r-xl border-y border-r border-slate-100 text-sm font-black text-emerald-600 text-right whitespace-nowrap">{formatCurrency(parseFaturaValor(f))}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Faturas sem data — nunca atribuídas silenciosamente a um mês */}
      {faturasSemData.length > 0 && (
        <div className="mt-6">
          <button onClick={() => setShowSemData(p => !p)} className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 transition-colors">
            <ChevronDown size={13} className={`transition-transform ${showSemData ? 'rotate-180' : ''}`} />
            Faturas sem data ({faturasSemData.length})
          </button>
          {showSemData && (
            <div className="mt-3 overflow-x-auto -mx-2">
              <table className="w-full text-left border-separate border-spacing-y-1">
                <thead>
                  <tr className="text-slate-300">
                    <th className="px-4 py-2 text-[10px] font-black uppercase tracking-widest">Fornecedor</th>
                    <th className="px-4 py-2 text-[10px] font-black uppercase tracking-widest">Tipo</th>
                    <th className="px-4 py-2 text-[10px] font-black uppercase tracking-widest text-right">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {faturasSemData.map(f => (
                    <tr key={f.id}>
                      <td className="px-4 py-2 rounded-l-xl border-y border-l border-slate-100 text-sm text-slate-600">{f.dados?.fornecedor || f.entidade || f.filename || '—'}</td>
                      <td className="px-4 py-2 border-y border-slate-100"><TypeBadge tipo={f.tipo || 'indefinido'} /></td>
                      <td className="px-4 py-2 rounded-r-xl border-y border-r border-slate-100 text-sm font-bold text-slate-500 text-right whitespace-nowrap">{formatCurrency(parseFaturaValor(f))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Excluídas manualmente das despesas (botão de excluir na tabela principal) */}
      {faturasExcluidas.length > 0 && (
        <div className="mt-6">
          <button onClick={() => setShowExcluidas(p => !p)} className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 transition-colors">
            <ChevronDown size={13} className={`transition-transform ${showExcluidas ? 'rotate-180' : ''}`} />
            Excluídas das despesas ({faturasExcluidas.length})
          </button>
          {showExcluidas && (
            <div className="mt-3 overflow-x-auto -mx-2">
              <table className="w-full text-left border-separate border-spacing-y-1">
                <thead>
                  <tr className="text-slate-300">
                    <th className="px-4 py-2 text-[10px] font-black uppercase tracking-widest">Data</th>
                    <th className="px-4 py-2 text-[10px] font-black uppercase tracking-widest">Fornecedor</th>
                    <th className="px-4 py-2 text-[10px] font-black uppercase tracking-widest text-right">Valor</th>
                    <th className="px-4 py-2 text-[10px] font-black uppercase tracking-widest text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {faturasExcluidas.map(f => {
                    const data_ref = f.dados?.data_pagamento || f.dados?.data_fatura;
                    return (
                      <tr key={f.id} className="opacity-50 hover:opacity-80 transition-opacity">
                        <td className="px-4 py-2 rounded-l-xl border-y border-l border-slate-100 text-xs font-bold text-slate-400 font-mono whitespace-nowrap">
                          {data_ref ? new Date(data_ref).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '—'}
                        </td>
                        <td className="px-4 py-2 border-y border-slate-100 text-sm text-slate-500">{f.dados?.fornecedor || f.entidade || f.descricao || f.filename || '—'}</td>
                        <td className="px-4 py-2 border-y border-slate-100 text-sm font-bold text-slate-400 text-right whitespace-nowrap">{formatCurrency(parseFaturaValor(f))}</td>
                        <td className="px-4 py-2 rounded-r-xl border-y border-r border-slate-100 text-right">
                          <button onClick={() => restaurarFaturaDespesa(f.id)} className="px-3 py-1 text-[10px] font-black uppercase tracking-widest bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded-lg transition-all">Restaurar</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
