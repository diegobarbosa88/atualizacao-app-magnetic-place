import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { Users, Building2, CalendarRange, FileText } from 'lucide-react';

const CostReports = () => {
  const { workers, clients, logs } = useApp();
  
  const [activeTab, setActiveTab] = useState('workers');
  const [selectedMonth, setSelectedMonth] = useState(
    new Date().toISOString().substring(0, 7)
  );

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
      
      return {
        id: workerId,
        name: workerName,
        totalHours,
        cost
      };
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
      
      return {
        id: clientId,
        name: clientName,
        totalHours,
        cost
      };
    }).sort((a, b) => b.cost - a.cost);
  }, [logs, clients, selectedMonth]);

  const currentData = activeTab === 'workers' ? workerCosts : clientCosts;
  const totalHoursAll = currentData.reduce((acc, item) => acc + item.totalHours, 0);
  const totalCostAll = currentData.reduce((acc, item) => acc + item.cost, 0);

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-3xl font-black flex items-center gap-3">
          <FileText size={32} className="text-indigo-600" /> {activeTab === 'workers' ? 'Custos por Trabalhador' : 'Faturação por Cliente'}
        </h2>
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
        </div>

        <div className="overflow-x-auto rounded-[2rem] border border-slate-100">
          <table className="min-w-full divide-y divide-slate-200 text-left">
            <thead className="bg-indigo-600">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase">Nome</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase">Total Horas</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase">{activeTab === 'workers' ? 'Custo (€)' : 'Faturação (€)'}</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {currentData.length > 0 ? currentData.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <p className="font-bold text-slate-800">{item.name}</p>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-slate-600">
                    {item.totalHours.toFixed(2)}h
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap font-black text-indigo-700">
                    {new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(item.cost)}
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
            {currentData.length > 0 && (
              <tfoot className="bg-slate-50 border-t-2 border-slate-200">
                <tr>
                  <td className="px-6 py-4 font-black uppercase text-slate-800">Total {activeTab === 'workers' ? 'Custo' : 'Faturação'}</td>
                  <td className="px-6 py-4 font-black text-slate-800">{totalHoursAll.toFixed(2)}h</td>
                  <td className="px-6 py-4 font-black text-indigo-700 text-lg">
                    {new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(totalCostAll)}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
};

export default CostReports;
