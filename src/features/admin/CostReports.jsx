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
          <button onClick={exportToXLS} className="flex items-center gap-2 px-4 py-3 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase shadow-xl hover:bg-indigo-700 transition-all">
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
