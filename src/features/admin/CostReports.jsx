import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { Users, Building2, TrendingUp, Receipt, CalendarRange, FileText, Trash2, X, Download } from 'lucide-react';
import { toISODateLocal } from '../../utils/dateUtils';

const CostReports = () => {
  const { workers, clients, logs, expenses, saveToDb, handleDelete } = useApp();
  
  const [activeTab, setActiveTab] = useState('workers');
  const [selectedMonth, setSelectedMonth] = useState(
    new Date().toISOString().substring(0, 7)
  );
  const [isAddingExpense, setIsAddingExpense] = useState(false);
  const [expenseForm, setExpenseForm] = useState({ 
    id: null, name: '', amount: '', type: 'fixo', date: toISODateLocal(new Date()) 
  });

  const monthOptions = useMemo(() => {
    const options = [];
    const d = new Date();
    for (let i = 0; i < 12; i++) {
      const val = d.toISOString().substring(0, 7);
      const label = d.toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' });
      options.push({ val, label: label.charAt(0).toUpperCase() + label.slice(1) });
      d.setMonth(d.getMonth() - 1);
    }
    return options;
  }, []);

  const handleSaveExpense = async () => {
    if (!expenseForm.name || !expenseForm.amount) return alert('Descrição e valor são obrigatórios');
    const eId = expenseForm.id || `e${Date.now()}`;
    await saveToDb('expenses', eId, { ...expenseForm, id: eId });
    setIsAddingExpense(false);
    setExpenseForm({ id: null, name: '', amount: '', type: 'fixo', date: toISODateLocal(new Date()) });
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const getReportTitle = () => {
    if (activeTab === 'workers') return 'CUSTOS POR TRABALHADOR';
    if (activeTab === 'clients') return 'FATURAÇÃO POR CLIENTE';
    if (activeTab === 'margins') return 'MARGEM BRUTA POR CLIENTE';
    if (activeTab === 'expenses') return 'DESPESAS';
    return 'RELATÓRIO';
  };

  const getMonthLabel = () => {
    const [year, month] = selectedMonth.split('-');
    const date = new Date(year, month - 1);
    return date.toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' }).toUpperCase();
  };

  const exportToCSV = () => {
    let csv = '';
    const filename = `relatorio-${activeTab}-${selectedMonth}.csv`;
    const today = formatDate(new Date());
    const reportTitle = getReportTitle();
    const monthLabel = getMonthLabel();

    csv += `${reportTitle}\n`;
    csv += `Período: ${monthLabel}\n`;
    csv += `Gerado em: ${today}\n`;
    csv += '\n';

    if (activeTab === 'workers') {
      csv += 'Nome;Total Horas;Custo (€)\n';
      csv += ';;\n';
      workerCosts.forEach(item => {
        csv += `${item.name};${item.totalHours.toFixed(2)};${item.cost.toFixed(2).replace('.', ',')}\n`;
      });
      const totalHours = workerCosts.reduce((a, i) => a + i.totalHours, 0);
      const totalCost = workerCosts.reduce((a, i) => a + i.cost, 0);
      csv += `TOTAL;${totalHours.toFixed(2)};${totalCost.toFixed(2).replace('.', ',')}\n`;
    } else if (activeTab === 'clients') {
      csv += 'Nome;Total Horas;Faturação (€)\n';
      csv += ';;\n';
      clientCosts.forEach(item => {
        csv += `${item.name};${item.totalHours.toFixed(2)};${item.cost.toFixed(2).replace('.', ',')}\n`;
      });
      const totalHours = clientCosts.reduce((a, i) => a + i.totalHours, 0);
      const total = clientCosts.reduce((a, i) => a + i.cost, 0);
      csv += `TOTAL;${totalHours.toFixed(2)};${total.toFixed(2).replace('.', ',')}\n`;
    } else if (activeTab === 'margins') {
      csv += 'Cliente;Horas;Faturação (€);Custo (€);Margem (€)\n';
      csv += ';;;;\n';
      clientMargins.forEach(item => {
        const marginColor = item.margin >= 0 ? '+' : '';
        csv += `${item.name};${item.totalHours.toFixed(2)};${item.faturation.toFixed(2).replace('.', ',')};${item.cost.toFixed(2).replace('.', ',')};${marginColor}${item.margin.toFixed(2).replace('.', ',')}\n`;
      });
      const totalF = clientMargins.reduce((a, i) => a + i.faturation, 0);
      const totalC = clientMargins.reduce((a, i) => a + i.cost, 0);
      const totalM = clientMargins.reduce((a, i) => a + i.margin, 0);
      const totalH = clientMargins.reduce((a, i) => a + i.totalHours, 0);
      csv += `TOTAL;${totalH.toFixed(2)};${totalF.toFixed(2).replace('.', ',')};${totalC.toFixed(2).replace('.', ',')};${totalM >= 0 ? '+' : ''}${totalM.toFixed(2).replace('.', ',')}\n`;
    } else if (activeTab === 'expenses') {
      csv += 'Data;Descrição;Tipo;Valor (€)\n';
      csv += ';;;\n';
      sortedExpenses.forEach(exp => {
        csv += `${formatDate(exp.date)};${exp.name};${exp.type};${Number(exp.amount).toFixed(2).replace('.', ',')}\n`;
      });
      csv += `TOTAL;;;${totalExpenses.toFixed(2).replace('.', ',')}\n`;
    }

    csv += '\n---\n';
    csv += 'Magnetic Place - Sistema de Gestão de Horas';

    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const workerCosts = useMemo(() => {
    if (!logs || !workers) return [];
    
    const filteredLogs = logs.filter(log => log.date?.startsWith(selectedMonth));
    
    const grouped = filteredLogs.reduce((acc, log) => {
      acc[log.workerId] = (acc[log.workerId] || 0) + (Number(log.hours) || 0);
      return acc;
    }, {});

    return Object.entries(grouped).map(([workerId, totalHours]) => {
      const worker = workers.find(w => w.id === workerId);
      const workerName = worker?.name || 'Desconhecido';
      const valorHora = Number(worker?.valorHora) || 0;
      const cost = totalHours * valorHora;
      
      return { id: workerId, name: workerName, totalHours, cost };
    }).sort((a, b) => b.cost - a.cost);
  }, [logs, workers, selectedMonth]);

  const clientCosts = useMemo(() => {
    if (!logs || !clients) return [];
    
    const filteredLogs = logs.filter(log => log.date?.startsWith(selectedMonth));
    
    const grouped = filteredLogs.reduce((acc, log) => {
      acc[log.clientId] = (acc[log.clientId] || 0) + (Number(log.hours) || 0);
      return acc;
    }, {});

    return Object.entries(grouped).map(([clientId, totalHours]) => {
      const client = clients.find(c => c.id === clientId);
      const clientName = client?.name || 'Desconhecido';
      const valorHora = Number(client?.valorHora) || 0;
      const cost = totalHours * valorHora;
      
      return { id: clientId, name: clientName, totalHours, cost };
    }).sort((a, b) => b.cost - a.cost);
  }, [logs, clients, selectedMonth]);

  const clientMargins = useMemo(() => {
    if (!logs || !clients || !workers) return [];
    
    const filteredLogs = logs.filter(log => log.date?.startsWith(selectedMonth));
    
    const grouped = filteredLogs.reduce((acc, log) => {
      if (!acc[log.clientId]) {
        acc[log.clientId] = { totalHours: 0, faturation: 0, cost: 0 };
      }
      const hours = Number(log.hours) || 0;
      const client = clients.find(c => c.id === log.clientId);
      const worker = workers.find(w => w.id === log.workerId);
      
      const clientValor = Number(client?.valorHora) || 0;
      const workerValor = Number(worker?.valorHora) || 0;
      
      acc[log.clientId].totalHours += hours;
      acc[log.clientId].faturation += hours * clientValor;
      acc[log.clientId].cost += hours * workerValor;
      
      return acc;
    }, {});

    return Object.entries(grouped).map(([clientId, data]) => {
      const client = clients.find(c => c.id === clientId);
      const clientName = client?.name || 'Desconhecido';
      
      return {
        id: clientId,
        name: clientName,
        totalHours: data.totalHours,
        faturation: data.faturation,
        cost: data.cost,
        margin: data.faturation - data.cost
      };
    }).sort((a, b) => b.margin - a.margin);
  }, [logs, clients, workers, selectedMonth]);

  const filteredExpenses = useMemo(() => {
    return expenses.filter(e => e.date?.startsWith(selectedMonth));
  }, [expenses, selectedMonth]);

  const sortedExpenses = useMemo(() => {
    return [...filteredExpenses].sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [filteredExpenses]);

  const totalExpenses = useMemo(() => {
    return filteredExpenses.reduce((acc, e) => acc + (Number(e.amount) || 0), 0);
  }, [filteredExpenses]);

  const formatCurrency = (value) => new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(value);

  const renderTable = () => {
    if (activeTab === 'workers') {
      return (
        <div className="overflow-x-auto rounded-[2rem] border border-slate-100">
          <table className="min-w-full divide-y divide-slate-200 text-left">
            <thead className="bg-indigo-600">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase">Nome</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase">Total Horas</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase">Custo (€)</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {workerCosts.length > 0 ? workerCosts.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <p className="font-bold text-slate-800">{item.name}</p>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-slate-600">
                    {item.totalHours.toFixed(2)}h
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap font-black text-indigo-700">
                    {formatCurrency(item.cost)}
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan="3" className="px-6 py-8 text-center text-slate-400 font-medium">
                    Sem dados para o período selecionado.
                  </td>
                </tr>
              )}
            </tbody>
            {workerCosts.length > 0 && (
              <tfoot className="bg-slate-50 border-t-2 border-slate-200">
                <tr>
                  <td className="px-6 py-4 font-black uppercase text-slate-800">Total Custo</td>
                  <td className="px-6 py-4 font-black text-slate-800">{workerCosts.reduce((a, i) => a + i.totalHours, 0).toFixed(2)}h</td>
                  <td className="px-6 py-4 font-black text-indigo-700 text-lg">
                    {formatCurrency(workerCosts.reduce((a, i) => a + i.cost, 0))}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      );
    }

    if (activeTab === 'clients') {
      return (
        <div className="overflow-x-auto rounded-[2rem] border border-slate-100">
          <table className="min-w-full divide-y divide-slate-200 text-left">
            <thead className="bg-indigo-600">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase">Nome</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase">Total Horas</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase">Faturação (€)</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {clientCosts.length > 0 ? clientCosts.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <p className="font-bold text-slate-800">{item.name}</p>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-slate-600">
                    {item.totalHours.toFixed(2)}h
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap font-black text-indigo-700">
                    {formatCurrency(item.cost)}
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan="3" className="px-6 py-8 text-center text-slate-400 font-medium">
                    Sem dados para o período selecionado.
                  </td>
                </tr>
              )}
            </tbody>
            {clientCosts.length > 0 && (
              <tfoot className="bg-slate-50 border-t-2 border-slate-200">
                <tr>
                  <td className="px-6 py-4 font-black uppercase text-slate-800">Total Faturação</td>
                  <td className="px-6 py-4 font-black text-slate-800">{clientCosts.reduce((a, i) => a + i.totalHours, 0).toFixed(2)}h</td>
                  <td className="px-6 py-4 font-black text-indigo-700 text-lg">
                    {formatCurrency(clientCosts.reduce((a, i) => a + i.cost, 0))}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      );
    }

    if (activeTab === 'margins') {
      return (
        <div className="overflow-x-auto rounded-[2rem] border border-slate-100">
          <table className="min-w-full divide-y divide-slate-200 text-left">
            <thead className="bg-indigo-600">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase">Cliente</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase">Horas</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase">Faturação (€)</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase">Custo (€)</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase">Margem (€)</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {clientMargins.length > 0 ? clientMargins.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <p className="font-bold text-slate-800">{item.name}</p>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-slate-600">
                    {item.totalHours.toFixed(2)}h
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap font-black text-indigo-700">
                    {formatCurrency(item.faturation)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap font-black text-rose-600">
                    {formatCurrency(item.cost)}
                  </td>
                  <td className={`px-6 py-4 whitespace-nowrap font-black ${item.margin >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {formatCurrency(item.margin)}
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan="5" className="px-6 py-8 text-center text-slate-400 font-medium">
                    Sem dados para o período selecionado.
                  </td>
                </tr>
              )}
            </tbody>
            {clientMargins.length > 0 && (
              <tfoot className="bg-slate-50 border-t-2 border-slate-200">
                <tr>
                  <td className="px-6 py-4 font-black uppercase text-slate-800">Total</td>
                  <td className="px-6 py-4 font-black text-slate-800">{clientMargins.reduce((a, i) => a + i.totalHours, 0).toFixed(2)}h</td>
                  <td className="px-6 py-4 font-black text-indigo-700">{formatCurrency(clientMargins.reduce((a, i) => a + i.faturation, 0))}</td>
                  <td className="px-6 py-4 font-black text-rose-600">{formatCurrency(clientMargins.reduce((a, i) => a + i.cost, 0))}</td>
                  <td className="px-6 py-4 font-black text-lg text-emerald-600">{formatCurrency(clientMargins.reduce((a, i) => a + i.margin, 0))}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      );
    }

    if (activeTab === 'expenses') {
      return (
        <div>
          {isAddingExpense && (
            <div className="mb-8 bg-white p-8 rounded-[2rem] shadow-inner border border-slate-100">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
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
                <button onClick={handleSaveExpense} className="flex-1 bg-rose-600 text-white py-5 rounded-2xl font-black text-sm uppercase shadow-lg hover:bg-rose-700 transition-colors">Registar Gasto</button>
                <button onClick={() => { setIsAddingExpense(false); setExpenseForm({ id: null, name: '', amount: '', type: 'fixo', date: toISODateLocal(new Date()) }); }} className="px-6 py-5 bg-slate-100 text-slate-600 rounded-2xl font-black text-sm uppercase shadow-sm hover:bg-slate-200 transition-colors">Cancelar</button>
              </div>
            </div>
          )}

          <div className="overflow-x-auto rounded-[2rem] border border-slate-100">
            <table className="min-w-full divide-y divide-slate-200 text-left">
              <thead className="bg-indigo-600">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase">Data</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase">Descrição</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-white uppercase">Tipo</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-white uppercase">Valor</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-white uppercase">Ações</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-200">
                {sortedExpenses.length > 0 ? sortedExpenses.map((exp) => (
                  <tr key={exp.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-slate-600">
                      {new Date(exp.date).toLocaleDateString('pt-PT')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-slate-700">
                      {exp.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span className={`px-4 py-1 rounded-full text-[9px] font-bold uppercase ${exp.type === 'fixo' ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-800'}`}>
                        {exp.type}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap font-black text-rose-600 text-right">
                      -{formatCurrency(exp.amount)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <button onClick={() => handleDelete('expenses', exp.id)} className="p-2 text-red-500 hover:bg-red-50 rounded-xl transition-all">
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan="5" className="px-6 py-8 text-center text-slate-400 font-medium">
                      Sem despesas para o período selecionado.
                    </td>
                  </tr>
                )}
              </tbody>
              {sortedExpenses.length > 0 && (
                <tfoot className="bg-slate-50 border-t-2 border-slate-200">
                  <tr>
                    <td colSpan="3" className="px-6 py-4 font-black uppercase text-slate-800">Total Despesas</td>
                    <td className="px-6 py-4 font-black text-rose-600 text-right text-lg">-{formatCurrency(totalExpenses)}</td>
                    <td></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      );
    }
  };

  const getTitle = () => {
    if (activeTab === 'workers') return 'Custos por Trabalhador';
    if (activeTab === 'clients') return 'Faturação por Cliente';
    if (activeTab === 'margins') return 'Margem Bruta por Cliente';
    if (activeTab === 'expenses') return 'Despesas';
    return 'Relatórios';
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-3xl font-black flex items-center gap-3">
          <FileText size={32} className="text-indigo-600" /> {getTitle()}
        </h2>
        <div className="flex items-center gap-4">
          {activeTab === 'expenses' && (
            <button onClick={() => { setExpenseForm({ id: null, name: '', amount: '', type: 'fixo', date: toISODateLocal(new Date()) }); setIsAddingExpense(!isAddingExpense); }} className={`px-6 py-3 rounded-2xl font-black text-xs uppercase shadow-xl transition-all ${isAddingExpense ? 'bg-slate-800 text-white' : 'bg-rose-600 text-white hover:bg-rose-700'}`}>
              {isAddingExpense ? 'Fechar' : 'Nova Despesa'}
            </button>
          )}
          <button onClick={exportToCSV} className="flex items-center gap-2 px-4 py-3 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase shadow-xl hover:bg-indigo-700 transition-all">
            <Download size={16} />
            Exportar
          </button>
          <div className="flex items-center gap-4 bg-white p-2 rounded-2xl shadow-sm border border-slate-200">
            <div className="flex items-center gap-2">
              <CalendarRange size={16} className="text-slate-400" />
              <select
                value={selectedMonth}
                onChange={e => setSelectedMonth(e.target.value)}
                className="bg-transparent border-none outline-none text-sm font-bold text-slate-700 cursor-pointer"
              >
                {monthOptions.map(opt => (
                  <option key={opt.val} value={opt.val}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white p-10 rounded-[3rem] shadow-xl border border-slate-200">
        <div className="flex gap-4 mb-8 border-b border-slate-100 pb-4">
          <button 
            onClick={() => setActiveTab('workers')} 
            className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-black text-sm uppercase tracking-widest transition-all ${
              activeTab === 'workers' 
                ? 'bg-indigo-600 text-white shadow-md' 
                : 'text-slate-500 hover:bg-slate-50'
            }`}
          >
            <Users size={18} />
            Trabalhadores
          </button>
          <button 
            onClick={() => setActiveTab('clients')} 
            className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-black text-sm uppercase tracking-widest transition-all ${
              activeTab === 'clients' 
                ? 'bg-indigo-600 text-white shadow-md' 
                : 'text-slate-500 hover:bg-slate-50'
            }`}
          >
            <Building2 size={18} />
            Clientes
          </button>
          <button 
            onClick={() => setActiveTab('margins')} 
            className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-black text-sm uppercase tracking-widest transition-all ${
              activeTab === 'margins' 
                ? 'bg-indigo-600 text-white shadow-md' 
                : 'text-slate-500 hover:bg-slate-50'
            }`}
          >
            <TrendingUp size={18} />
            Margem Bruta
          </button>
          <button 
            onClick={() => setActiveTab('expenses')} 
            className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-black text-sm uppercase tracking-widest transition-all ${
              activeTab === 'expenses' 
                ? 'bg-indigo-600 text-white shadow-md' 
                : 'text-slate-500 hover:bg-slate-50'
            }`}
          >
            <Receipt size={18} />
            Despesas
          </button>
        </div>

        {renderTable()}
      </div>
    </div>
  );
};

export default CostReports;
