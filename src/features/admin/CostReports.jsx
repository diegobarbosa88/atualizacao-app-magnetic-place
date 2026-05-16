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

  const getLogoBase64 = async () => {
    try {
      const response = await fetch('/MAGNETIC (3).png');
      const blob = await response.blob();
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.readAsDataURL(blob);
      });
    } catch {
      return null;
    }
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(value);
  };

  const exportToXLS = async () => {
    const today = formatDate(new Date());
    const reportTitle = getReportTitle();
    const monthLabel = getMonthLabel();
    const filename = `relatorio-${activeTab}-${selectedMonth}.xls`;
    const logoBase64 = await getLogoBase64();

    let tableRows = '';
    let totalSection = '';
    let headers = '';
    let colgroup = '';

    if (activeTab === 'workers') {
      colgroup = '<colgroup><col style="width: 280px"><col style="width: 120px"><col style="width: 140px"></colgroup>';
      headers = '<th style="background:#4F46E5;color:white;padding:12px 16px;text-align:left;font-weight:bold;border-bottom:2px solid #3730A3;">Nome</th><th style="background:#4F46E5;color:white;padding:12px 16px;text-align:right;font-weight:bold;border-bottom:2px solid #3730A3;">Total Horas</th><th style="background:#4F46E5;color:white;padding:12px 16px;text-align:right;font-weight:bold;border-bottom:2px solid #3730A3;">Custo (€)</th>';
      
      workerCosts.forEach((item, idx) => {
        const bgColor = idx % 2 === 0 ? '#ffffff' : '#F8FAFC';
        tableRows += `<tr style="background:${bgColor};"><td style="padding:10px 16px;font-weight:600;border-bottom:1px solid #E2E8F0;">${item.name}</td><td style="padding:10px 16px;text-align:right;border-bottom:1px solid #E2E8F0;">${item.totalHours.toFixed(2)}h</td><td style="padding:10px 16px;text-align:right;font-weight:600;color:#4F46E5;border-bottom:1px solid #E2E8F0;">${formatCurrency(item.cost)}</td></tr>`;
      });
      
      const totalHours = workerCosts.reduce((a, i) => a + i.totalHours, 0);
      const totalCost = workerCosts.reduce((a, i) => a + i.cost, 0);
      totalSection = `<tr style="background:#EEF2FF;"><td style="padding:14px 16px;font-weight:800;text-transform:uppercase;border-top:2px solid #4F46E5;">Total</td><td style="padding:14px 16px;text-align:right;font-weight:800;border-top:2px solid #4F46E5;">${totalHours.toFixed(2)}h</td><td style="padding:14px 16px;text-align:right;font-weight:800;font-size:16px;color:#4F46E5;border-top:2px solid #4F46E5;">${formatCurrency(totalCost)}</td></tr>`;
    }

    if (activeTab === 'clients') {
      colgroup = '<colgroup><col style="width: 280px"><col style="width: 120px"><col style="width: 140px"></colgroup>';
      headers = '<th style="background:#4F46E5;color:white;padding:12px 16px;text-align:left;font-weight:bold;border-bottom:2px solid #3730A3;">Nome</th><th style="background:#4F46E5;color:white;padding:12px 16px;text-align:right;font-weight:bold;border-bottom:2px solid #3730A3;">Total Horas</th><th style="background:#4F46E5;color:white;padding:12px 16px;text-align:right;font-weight:bold;border-bottom:2px solid #3730A3;">Faturação (€)</th>';
      
      clientCosts.forEach((item, idx) => {
        const bgColor = idx % 2 === 0 ? '#ffffff' : '#F8FAFC';
        tableRows += `<tr style="background:${bgColor};"><td style="padding:10px 16px;font-weight:600;border-bottom:1px solid #E2E8F0;">${item.name}</td><td style="padding:10px 16px;text-align:right;border-bottom:1px solid #E2E8F0;">${item.totalHours.toFixed(2)}h</td><td style="padding:10px 16px;text-align:right;font-weight:600;color:#059669;border-bottom:1px solid #E2E8F0;">${formatCurrency(item.cost)}</td></tr>`;
      });
      
      const totalHours = clientCosts.reduce((a, i) => a + i.totalHours, 0);
      const total = clientCosts.reduce((a, i) => a + i.cost, 0);
      totalSection = `<tr style="background:#ECFDF5;"><td style="padding:14px 16px;font-weight:800;text-transform:uppercase;border-top:2px solid #059669;">Total</td><td style="padding:14px 16px;text-align:right;font-weight:800;border-top:2px solid #059669;">${totalHours.toFixed(2)}h</td><td style="padding:14px 16px;text-align:right;font-weight:800;font-size:16px;color:#059669;border-top:2px solid #059669;">${formatCurrency(total)}</td></tr>`;
    }

    if (activeTab === 'margins') {
      colgroup = '<colgroup><col style="width: 220px"><col style="width: 100px"><col style="width: 130px"><col style="width: 130px"><col style="width: 130px"></colgroup>';
      headers = '<th style="background:#4F46E5;color:white;padding:12px 16px;text-align:left;font-weight:bold;border-bottom:2px solid #3730A3;">Cliente</th><th style="background:#4F46E5;color:white;padding:12px 16px;text-align:right;font-weight:bold;border-bottom:2px solid #3730A3;">Horas</th><th style="background:#4F46E5;color:white;padding:12px 16px;text-align:right;font-weight:bold;border-bottom:2px solid #3730A3;">Faturação (€)</th><th style="background:#4F46E5;color:white;padding:12px 16px;text-align:right;font-weight:bold;border-bottom:2px solid #3730A3;">Custo (€)</th><th style="background:#4F46E5;color:white;padding:12px 16px;text-align:right;font-weight:bold;border-bottom:2px solid #3730A3;">Margem (€)</th>';
      
      clientMargins.forEach((item, idx) => {
        const bgColor = idx % 2 === 0 ? '#ffffff' : '#F8FAFC';
        const marginColor = item.margin >= 0 ? '#059669' : '#DC2626';
        const marginSign = item.margin >= 0 ? '+' : '';
        tableRows += `<tr style="background:${bgColor};"><td style="padding:10px 16px;font-weight:600;border-bottom:1px solid #E2E8F0;">${item.name}</td><td style="padding:10px 16px;text-align:right;border-bottom:1px solid #E2E8F0;">${item.totalHours.toFixed(2)}h</td><td style="padding:10px 16px;text-align:right;color:#4F46E5;border-bottom:1px solid #E2E8F0;">${formatCurrency(item.faturation)}</td><td style="padding:10px 16px;text-align:right;color:#DC2626;border-bottom:1px solid #E2E8F0;">${formatCurrency(item.cost)}</td><td style="padding:10px 16px;text-align:right;font-weight:700;color:${marginColor};border-bottom:1px solid #E2E8F0;">${marginSign}${formatCurrency(item.margin)}</td></tr>`;
      });
      
      const totalF = clientMargins.reduce((a, i) => a + i.faturation, 0);
      const totalC = clientMargins.reduce((a, i) => a + i.cost, 0);
      const totalM = clientMargins.reduce((a, i) => a + i.margin, 0);
      const totalH = clientMargins.reduce((a, i) => a + i.totalHours, 0);
      const marginTotalColor = totalM >= 0 ? '#059669' : '#DC2626';
      const marginSign = totalM >= 0 ? '+' : '';
      totalSection = `<tr style="background:#EEF2FF;"><td style="padding:14px 16px;font-weight:800;text-transform:uppercase;border-top:2px solid #4F46E5;">Total</td><td style="padding:14px 16px;text-align:right;font-weight:800;border-top:2px solid #4F46E5;">${totalH.toFixed(2)}h</td><td style="padding:14px 16px;text-align:right;font-weight:800;color:#4F46E5;border-top:2px solid #4F46E5;">${formatCurrency(totalF)}</td><td style="padding:14px 16px;text-align:right;font-weight:800;color:#DC2626;border-top:2px solid #4F46E5;">${formatCurrency(totalC)}</td><td style="padding:14px 16px;text-align:right;font-weight:800;font-size:16px;color:${marginTotalColor};border-top:2px solid #4F46E5;">${marginSign}${formatCurrency(totalM)}</td></tr>`;
    }

    if (activeTab === 'expenses') {
      colgroup = '<colgroup><col style="width: 120px"><col style="width: 250px"><col style="width: 100px"><col style="width: 130px"></colgroup>';
      headers = '<th style="background:#4F46E5;color:white;padding:12px 16px;text-align:left;font-weight:bold;border-bottom:2px solid #3730A3;">Data</th><th style="background:#4F46E5;color:white;padding:12px 16px;text-align:left;font-weight:bold;border-bottom:2px solid #3730A3;">Descrição</th><th style="background:#4F46E5;color:white;padding:12px 16px;text-align:center;font-weight:bold;border-bottom:2px solid #3730A3;">Tipo</th><th style="background:#4F46E5;color:white;padding:12px 16px;text-align:right;font-weight:bold;border-bottom:2px solid #3730A3;">Valor</th>';
      
      sortedExpenses.forEach((exp, idx) => {
        const bgColor = idx % 2 === 0 ? '#ffffff' : '#F8FAFC';
        const typeBg = exp.type === 'fixo' ? '#DBEAFE' : '#FEF3C7';
        const typeColor = exp.type === 'fixo' ? '#1D4ED8' : '#D97706';
        tableRows += `<tr style="background:${bgColor};"><td style="padding:10px 16px;border-bottom:1px solid #E2E8F0;">${formatDate(exp.date)}</td><td style="padding:10px 16px;font-weight:600;border-bottom:1px solid #E2E8F0;">${exp.name}</td><td style="padding:10px 16px;text-align:center;"><span style="background:${typeBg};color:${typeColor};padding:4px 12px;border-radius:20px;font-size:11px;font-weight:700;text-transform:uppercase;">${exp.type}</span></td><td style="padding:10px 16px;text-align:right;font-weight:600;color:#DC2626;border-bottom:1px solid #E2E8F0;">-${formatCurrency(exp.amount)}</td></tr>`;
      });
      
      totalSection = `<tr style="background:#FEF2F2;"><td colspan="3" style="padding:14px 16px;font-weight:800;text-transform:uppercase;border-top:2px solid #DC2626;">Total Despesas</td><td style="padding:14px 16px;text-align:right;font-weight:800;font-size:16px;color:#DC2626;border-top:2px solid #DC2626;">-${formatCurrency(totalExpenses)}</td></tr>`;
    }

    const logoHtml = logoBase64 
      ? `<img src="${logoBase64}" alt="Logo" style="height:60px;width:60px;border-radius:12px;margin-right:16px;" />` 
      : '';

    const html = `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
<head>
  <meta charset="utf-8">
  <meta name="Generator" content="Microsoft Excel">
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
  <style>
    body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 40px; background: #f8fafc; }
    .header { background: linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%); color: white; padding: 30px 40px; border-radius: 16px 16px 0 0; margin-bottom: 0; display: flex; align-items: center; }
    .logo-container { display: flex; align-items: center; }
    .company { font-size: 24px; font-weight: 800; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 4px; }
    .title { font-size: 16px; font-weight: 500; opacity: 0.9; }
    .info-bar { background: white; padding: 20px 40px; display: flex; gap: 40px; border-bottom: 1px solid #e2e8f0; margin-bottom: 0; }
    .info-item { display: flex; flex-direction: column; }
    .info-label { font-size: 10px; text-transform: uppercase; color: #94a3b8; font-weight: 700; letter-spacing: 1px; }
    .info-value { font-size: 14px; font-weight: 600; color: #334155; }
    .content { background: white; border-radius: 0 0 16px 16px; padding: 0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); }
    table { width: 100%; border-collapse: collapse; margin: 0; table-layout: fixed; }
    colgroup { }
    th { background: #4F46E5; color: white; padding: 12px 16px; text-align: left; font-weight: 700; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; }
    td { overflow: hidden; text-overflow: ellipsis; }
    .footer { margin-top: 20px; padding: 20px; text-align: center; color: #94a3b8; font-size: 12px; }
  </style>
</head>
<body>
  <div class="header">
    <div class="logo-container">
      ${logoHtml}
      <div>
        <div class="company">Magnetic Place</div>
        <div class="title">${reportTitle}</div>
      </div>
    </div>
  </div>
  <div class="info-bar">
    <div class="info-item">
      <span class="info-label">Período</span>
      <span class="info-value">${monthLabel}</span>
    </div>
    <div class="info-item">
      <span class="info-label">Gerado em</span>
      <span class="info-value">${today}</span>
    </div>
    <div class="info-item">
      <span class="info-label">Total Registos</span>
      <span class="info-value">${activeTab === 'workers' ? workerCosts.length : activeTab === 'clients' ? clientCosts.length : activeTab === 'margins' ? clientMargins.length : sortedExpenses.length}</span>
    </div>
  </div>
  <div class="content">
    <table>
      ${colgroup}
      <thead>
        <tr>${headers}</tr>
      </thead>
      <tbody>
        ${tableRows}
      </tbody>
      <tfoot>
        ${totalSection}
      </tfoot>
    </table>
  </div>
  <div class="footer">
    Sistema de Gestão de Horas - Magnetic Place
  </div>
</body>
</html>`;

    const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8;' });
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

  const renderTable = () => {
    if (activeTab === 'workers') {
      return (
        <div className="overflow-x-auto -mx-2">
          <table className="w-full text-left border-separate border-spacing-y-2">
            <thead>
              <tr className="text-slate-400">
                <th className="px-4 py-2 text-[10px] font-black uppercase tracking-widest">Nome</th>
                <th className="px-4 py-2 text-[10px] font-black uppercase tracking-widest">Total Horas</th>
                <th className="px-4 py-2 text-[10px] font-black uppercase tracking-widest">Custo (€)</th>
              </tr>
            </thead>
            <tbody>
              {workerCosts.length === 0 ? (
                <tr><td colSpan="3" className="py-16 text-center text-slate-400 text-sm font-medium">Sem dados para o período selecionado.</td></tr>
              ) : workerCosts.map((item) => (
                <tr key={item.id} className="bg-slate-50/30 hover:bg-white hover:shadow-md transition-all duration-300">
                  <td className="px-4 py-3 rounded-l-2xl border-y border-l border-slate-100 text-sm font-black text-slate-800">{item.name}</td>
                  <td className="px-4 py-3 border-y border-slate-100 text-sm font-bold text-slate-600">{item.totalHours.toFixed(1)}h</td>
                  <td className="px-4 py-3 rounded-r-2xl border-y border-r border-slate-100 text-sm font-black text-indigo-700">{formatCurrency(item.cost)}</td>
                </tr>
              ))}
              {workerCosts.length > 0 && (
                <tr className="bg-slate-100/60">
                  <td className="px-4 py-3 rounded-l-2xl text-[10px] font-black uppercase text-slate-500">Total</td>
                  <td className="px-4 py-3 text-sm font-black text-slate-700">{workerCosts.reduce((a, i) => a + i.totalHours, 0).toFixed(1)}h</td>
                  <td className="px-4 py-3 rounded-r-2xl text-sm font-black text-indigo-700">{formatCurrency(workerCosts.reduce((a, i) => a + i.cost, 0))}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      );
    }

    if (activeTab === 'clients') {
      return (
        <div className="overflow-x-auto -mx-2">
          <table className="w-full text-left border-separate border-spacing-y-2">
            <thead>
              <tr className="text-slate-400">
                <th className="px-4 py-2 text-[10px] font-black uppercase tracking-widest">Nome</th>
                <th className="px-4 py-2 text-[10px] font-black uppercase tracking-widest">Total Horas</th>
                <th className="px-4 py-2 text-[10px] font-black uppercase tracking-widest">Faturação (€)</th>
              </tr>
            </thead>
            <tbody>
              {clientCosts.length === 0 ? (
                <tr><td colSpan="3" className="py-16 text-center text-slate-400 text-sm font-medium">Sem dados para o período selecionado.</td></tr>
              ) : clientCosts.map((item) => (
                <tr key={item.id} className="bg-slate-50/30 hover:bg-white hover:shadow-md transition-all duration-300">
                  <td className="px-4 py-3 rounded-l-2xl border-y border-l border-slate-100 text-sm font-black text-slate-800">{item.name}</td>
                  <td className="px-4 py-3 border-y border-slate-100 text-sm font-bold text-slate-600">{item.totalHours.toFixed(1)}h</td>
                  <td className="px-4 py-3 rounded-r-2xl border-y border-r border-slate-100 text-sm font-black text-indigo-700">{formatCurrency(item.cost)}</td>
                </tr>
              ))}
              {clientCosts.length > 0 && (
                <tr className="bg-slate-100/60">
                  <td className="px-4 py-3 rounded-l-2xl text-[10px] font-black uppercase text-slate-500">Total</td>
                  <td className="px-4 py-3 text-sm font-black text-slate-700">{clientCosts.reduce((a, i) => a + i.totalHours, 0).toFixed(1)}h</td>
                  <td className="px-4 py-3 rounded-r-2xl text-sm font-black text-indigo-700">{formatCurrency(clientCosts.reduce((a, i) => a + i.cost, 0))}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      );
    }

    if (activeTab === 'margins') {
      return (
        <div className="overflow-x-auto -mx-2">
          <table className="w-full text-left border-separate border-spacing-y-2">
            <thead>
              <tr className="text-slate-400">
                <th className="px-4 py-2 text-[10px] font-black uppercase tracking-widest">Cliente</th>
                <th className="px-4 py-2 text-[10px] font-black uppercase tracking-widest">Horas</th>
                <th className="px-4 py-2 text-[10px] font-black uppercase tracking-widest">Faturação</th>
                <th className="px-4 py-2 text-[10px] font-black uppercase tracking-widest">Custo</th>
                <th className="px-4 py-2 text-[10px] font-black uppercase tracking-widest">Margem</th>
              </tr>
            </thead>
            <tbody>
              {clientMargins.length === 0 ? (
                <tr><td colSpan="5" className="py-16 text-center text-slate-400 text-sm font-medium">Sem dados para o período selecionado.</td></tr>
              ) : clientMargins.map((item) => (
                <tr key={item.id} className="bg-slate-50/30 hover:bg-white hover:shadow-md transition-all duration-300">
                  <td className="px-4 py-3 rounded-l-2xl border-y border-l border-slate-100 text-sm font-black text-slate-800">{item.name}</td>
                  <td className="px-4 py-3 border-y border-slate-100 text-sm font-bold text-slate-600 whitespace-nowrap">{item.totalHours.toFixed(1)}h</td>
                  <td className="px-4 py-3 border-y border-slate-100 text-sm font-black text-indigo-700 whitespace-nowrap">{formatCurrency(item.faturation)}</td>
                  <td className="px-4 py-3 border-y border-slate-100 text-sm font-black text-rose-600 whitespace-nowrap">{formatCurrency(item.cost)}</td>
                  <td className={`px-4 py-3 rounded-r-2xl border-y border-r border-slate-100 text-sm font-black whitespace-nowrap ${item.margin >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{formatCurrency(item.margin)}</td>
                </tr>
              ))}
              {clientMargins.length > 0 && (
                <tr className="bg-slate-100/60">
                  <td className="px-4 py-3 rounded-l-2xl text-[10px] font-black uppercase text-slate-500">Total</td>
                  <td className="px-4 py-3 text-sm font-black text-slate-700">{clientMargins.reduce((a, i) => a + i.totalHours, 0).toFixed(1)}h</td>
                  <td className="px-4 py-3 text-sm font-black text-indigo-700">{formatCurrency(clientMargins.reduce((a, i) => a + i.faturation, 0))}</td>
                  <td className="px-4 py-3 text-sm font-black text-rose-600">{formatCurrency(clientMargins.reduce((a, i) => a + i.cost, 0))}</td>
                  <td className="px-4 py-3 rounded-r-2xl text-sm font-black text-emerald-600">{formatCurrency(clientMargins.reduce((a, i) => a + i.margin, 0))}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      );
    }

    if (activeTab === 'expenses') {
      return (
        <div>
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
                <button onClick={handleSaveExpense} className="flex-1 bg-rose-600 text-white py-5 rounded-2xl font-black text-sm uppercase shadow-lg hover:bg-rose-700 transition-colors">Registar Gasto</button>
                <button onClick={() => { setIsAddingExpense(false); setExpenseForm({ id: null, name: '', amount: '', type: 'fixo', date: toISODateLocal(new Date()) }); }} className="px-6 py-5 bg-slate-100 text-slate-600 rounded-2xl font-black text-sm uppercase shadow-sm hover:bg-slate-200 transition-colors">Cancelar</button>
              </div>
            </div>
          )}

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
                {sortedExpenses.length === 0 ? (
                  <tr><td colSpan="5" className="py-16 text-center text-slate-400 text-sm font-medium">Sem despesas para o período selecionado.</td></tr>
                ) : sortedExpenses.map((exp) => (
                  <tr key={exp.id} className="bg-slate-50/30 hover:bg-white hover:shadow-md transition-all duration-300">
                    <td className="px-4 py-3 rounded-l-2xl border-y border-l border-slate-100 text-xs font-bold text-slate-500 whitespace-nowrap font-mono">
                      {new Date(exp.date).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                    </td>
                    <td className="px-4 py-3 border-y border-slate-100 text-sm font-bold text-slate-800">{exp.name}</td>
                    <td className="px-4 py-3 border-y border-slate-100">
                      <span className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase ${exp.type === 'fixo' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>{exp.type}</span>
                    </td>
                    <td className="px-4 py-3 border-y border-slate-100 font-black text-rose-600 text-right whitespace-nowrap">-{formatCurrency(exp.amount)}</td>
                    <td className="px-4 py-3 rounded-r-2xl border-y border-r border-slate-100 text-right">
                      <button onClick={() => handleDelete('expenses', exp.id)} className="p-1.5 text-rose-400 hover:bg-rose-50 rounded-xl transition-all"><Trash2 size={15} /></button>
                    </td>
                  </tr>
                ))}
                {sortedExpenses.length > 0 && (
                  <tr className="bg-slate-100/60">
                    <td colSpan="3" className="px-4 py-3 rounded-l-2xl text-[10px] font-black uppercase text-slate-500">Total Despesas</td>
                    <td className="px-4 py-3 font-black text-rose-600 text-right">-{formatCurrency(totalExpenses)}</td>
                    <td className="px-4 py-3 rounded-r-2xl"></td>
                  </tr>
                )}
              </tbody>
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
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black flex items-center gap-2">
            <FileText size={20} className="text-indigo-600" /> {getTitle()}
          </h2>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          {activeTab === 'expenses' && (
            <button onClick={() => { setExpenseForm({ id: null, name: '', amount: '', type: 'fixo', date: toISODateLocal(new Date()) }); setIsAddingExpense(!isAddingExpense); }} className={`px-3 py-2 rounded-xl font-black text-xs uppercase shadow-sm transition-all ${isAddingExpense ? 'bg-slate-800 text-white' : 'bg-rose-600 text-white hover:bg-rose-700'}`}>
              {isAddingExpense ? 'Fechar' : '+ Despesa'}
            </button>
          )}
          <button onClick={exportToXLS} className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 text-white rounded-xl font-black text-xs uppercase shadow-sm hover:bg-indigo-700 transition-all">
            <Download size={13} /> Exportar
          </button>
          <div className="flex items-center gap-1.5 bg-white px-3 py-2 rounded-xl shadow-sm border border-slate-200 flex-1 sm:flex-none">
            <CalendarRange size={13} className="text-slate-400 shrink-0" />
            <select value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} className="bg-transparent border-none outline-none text-xs font-bold text-slate-700 cursor-pointer w-full">
              {monthOptions.map(opt => (
                <option key={opt.val} value={opt.val}>{opt.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white p-4 sm:p-6 lg:p-8 rounded-2xl sm:rounded-[2.5rem] shadow-xl border border-slate-200">
        {/* Sub-tabs */}
        <div className="grid grid-cols-4 gap-1 mb-6 bg-slate-100 p-1 rounded-2xl w-full">
          {[
            { id: 'workers', icon: Users, label: 'Equipa' },
            { id: 'clients', icon: Building2, label: 'Clientes' },
            { id: 'margins', icon: TrendingUp, label: 'Margem' },
            { id: 'expenses', icon: Receipt, label: 'Despesas' },
          ].map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex items-center justify-center gap-1 py-2 rounded-xl transition-all ${activeTab === id ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
            >
              <Icon size={13} />
              <span className="text-[9px] font-black uppercase whitespace-nowrap">{label}</span>
            </button>
          ))}
        </div>

        {renderTable()}
      </div>
    </div>
  );
};

export default CostReports;
