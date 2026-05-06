import React, { useState } from 'react';
import { 
  Receipt, Trash2 
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { toISODateLocal, isSameMonth } from '../../utils/dateUtils';
import { formatCurrency } from '../../utils/formatUtils';

const ExpenseManager = () => {
  const { 
    expenses, 
    currentMonth, 
    saveToDb, 
    handleDelete 
  } = useApp();

  const [isAddingInTab, setIsAddingInTab] = useState(false);
  const [expensesSort, setExpensesSort] = useState({ key: 'date', direction: 'desc' });
  const [expenseForm, setExpenseForm] = useState({ 
    id: null, name: '', amount: '', type: 'fixo', date: toISODateLocal(new Date()) 
  });

  const handleSaveExpense = async () => {
    if (!expenseForm.name || !expenseForm.amount) return alert('Descrição e valor são obrigatórios');
    const eId = expenseForm.id || `e${Date.now()}`;
    await saveToDb('expenses', eId, { ...expenseForm, id: eId });
    setIsAddingInTab(false);
    setExpenseForm({ id: null, name: '', amount: '', type: 'fixo', date: toISODateLocal(new Date()) });
  };

  const filteredExpenses = expenses.filter(e => isSameMonth(e.date, currentMonth));

  const sortedExpenses = [...filteredExpenses].sort((a, b) => {
    let res = 0;
    if (expensesSort.key === 'date') res = new Date(a.date) - new Date(b.date);
    if (expensesSort.key === 'name') res = a.name.localeCompare(b.name);
    if (expensesSort.key === 'type') res = a.type.localeCompare(b.type);
    if (expensesSort.key === 'amount') res = a.amount - b.amount;
    return expensesSort.direction === 'asc' ? res : -res;
  });

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-3xl font-black flex items-center gap-3"><Receipt size={32} className="text-rose-600" /> Balanço de Custos</h2>
        <button onClick={() => { setExpenseForm({ id: null, name: '', amount: '', type: 'fixo', date: toISODateLocal(new Date()) }); setIsAddingInTab(!isAddingInTab); }} className={`px-6 py-3 rounded-2xl font-black text-xs uppercase shadow-xl transition-all ${isAddingInTab ? 'bg-slate-800 text-white' : 'bg-rose-600 text-white'}`}>{isAddingInTab ? 'Fechar' : 'Nova Despesa'}</button>
      </div>

      {isAddingInTab && (
        <div className="mb-10 bg-white p-10 rounded-[3rem] shadow-xl border-2 border-rose-100">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase ml-1">Descrição</label><input type="text" value={expenseForm.name} onChange={e => setExpenseForm({ ...expenseForm, name: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm outline-none shadow-sm" /></div>
            <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase ml-1">Valor (€)</label><input type="number" value={expenseForm.amount} onChange={e => setExpenseForm({ ...expenseForm, amount: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm font-bold text-rose-600 outline-none shadow-sm" /></div>
            <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase ml-1">Tipo</label><select value={expenseForm.type} onChange={e => setExpenseForm({ ...expenseForm, type: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm outline-none shadow-sm"><option value="fixo">Fixo</option><option value="variável">Variável</option></select></div>
            <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase ml-1">Data</label><input type="date" value={expenseForm.date} onChange={e => setExpenseForm({ ...expenseForm, date: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm shadow-sm" /></div>
          </div>
          <div className="mt-6 flex items-center gap-3"><button onClick={handleSaveExpense} className="flex-1 bg-rose-600 text-white py-5 rounded-2xl font-black text-sm uppercase shadow-lg">Registar Gasto</button></div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="admin-table">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-100">
              <th onClick={() => setExpensesSort(prev => ({ key: 'date', direction: prev.key === 'date' && prev.direction === 'asc' ? 'desc' : 'asc' }))} className="text-left text-xs font-bold text-slate-400 uppercase tracking-wider cursor-pointer hover:text-rose-600 transition-colors">Data {expensesSort.key === 'date' ? (expensesSort.direction === 'asc' ? '↑' : '↓') : ''}</th>
              <th onClick={() => setExpensesSort(prev => ({ key: 'name', direction: prev.key === 'name' && prev.direction === 'asc' ? 'desc' : 'asc' }))} className="text-left text-xs font-bold text-slate-400 uppercase tracking-wider cursor-pointer hover:text-rose-600 transition-colors">Descrição {expensesSort.key === 'name' ? (expensesSort.direction === 'asc' ? '↑' : '↓') : ''}</th>
              <th onClick={() => setExpensesSort(prev => ({ key: 'type', direction: prev.key === 'type' && prev.direction === 'asc' ? 'desc' : 'asc' }))} className="text-center text-xs font-bold text-slate-400 uppercase tracking-wider cursor-pointer hover:text-rose-600 transition-colors">Tipo {expensesSort.key === 'type' ? (expensesSort.direction === 'asc' ? '↑' : '↓') : ''}</th>
              <th onClick={() => setExpensesSort(prev => ({ key: 'amount', direction: prev.key === 'amount' && prev.direction === 'asc' ? 'desc' : 'asc' }))} className="text-right text-xs font-bold text-slate-400 uppercase tracking-wider cursor-pointer hover:text-rose-600 transition-colors">Valor {expensesSort.key === 'amount' ? (expensesSort.direction === 'asc' ? '↑' : '↓') : ''}</th>
              <th className="text-right text-xs font-bold text-slate-400 uppercase tracking-wider">Ações</th>
            </tr>
          </thead>
          <tbody>
            {sortedExpenses.map(exp => (
              <tr key={exp.id} className="hover:bg-slate-50 transition-colors border-b border-slate-100">
                <td className="text-sm font-bold truncate">{new Date(exp.date).toLocaleDateString('pt-PT')}</td>
                <td className="text-sm font-bold text-slate-700 truncate">{exp.name}</td>
                <td className="text-center">
                  <span className={`px-4 py-1 rounded-full text-[9px] font-bold uppercase ${exp.type === 'fixo' ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-800'}`}>
                    {exp.type}
                  </span>
                </td>
                <td className="text-sm font-black text-rose-600 text-right">-{formatCurrency(exp.amount)}</td>
                <td className="text-right">
                  <div className="flex justify-end gap-3">
                    <button onClick={() => handleDelete('expenses', exp.id)} className="p-2 text-red-500 hover:bg-red-50 rounded-xl transition-all">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {sortedExpenses.length === 0 && (
          <div className="text-center py-10 bg-slate-50 rounded-b-2xl border-x border-b border-slate-100 text-slate-400 text-sm italic">
            Nenhuma despesa registada para este mês.
          </div>
        )}
      </div>
    </div>
  );
};

export default ExpenseManager;
