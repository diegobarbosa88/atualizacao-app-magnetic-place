import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useApp } from '../../context/AppContext';
import { Users, Building2, TrendingUp, Receipt, CalendarRange, FileText, Trash2, X, Download, Link2, Loader2, CheckCircle, Plus } from 'lucide-react';
import { toISODateLocal } from '../../utils/dateUtils';

const CostReports = () => {
  const { workers, clients, logs, expenses, saveToDb, handleDelete, supabase } = useApp();

  const [activeTab, setActiveTab] = useState('workers');

  // ── Pagamentos bancários por cliente ─────────────────────────────────────
  const [pagamentos, setPagamentos] = useState([]);           // faturacao_clientes_pagamentos para o período
  const [pagamentosLoading, setPagamentosLoading] = useState(false);

  // ── Modal de associação ───────────────────────────────────────────────────
  const [linkModal, setLinkModal] = useState(null);           // { clientId, clientName, valorFaturado }
  const [runsLista, setRunsLista] = useState([]);
  const [runsLoading, setRunsLoading] = useState(false);
  const [selectedRun, setSelectedRun] = useState(null);       // { id, filename, results_json }
  const [runLoading, setRunLoading] = useState(false);
  const [linkSaving, setLinkSaving] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(
    new Date().toISOString().substring(0, 7)
  );
  const [isAddingExpense, setIsAddingExpense] = useState(false);
  const [expenseForm, setExpenseForm] = useState({ 
    id: null, name: '', amount: '', type: 'fixo', date: toISODateLocal(new Date()) 
  });

  // Carregar pagamentos bancários para o mês seleccionado
  const carregarPagamentos = useCallback(async () => {
    if (!supabase) return;
    setPagamentosLoading(true);
    const { data } = await supabase
      .from('faturacao_clientes_pagamentos')
      .select('*')
      .eq('period', selectedMonth);
    setPagamentos(data || []);
    setPagamentosLoading(false);
  }, [supabase, selectedMonth]);

  useEffect(() => { carregarPagamentos(); }, [carregarPagamentos]);

  // Helpers de pagamento
  const pagamentosDoCliente = (clientId) => pagamentos.filter(p => p.client_id === clientId);
  const totalPagoCli = (clientId) => pagamentosDoCliente(clientId).reduce((s, p) => s + Number(p.valor_pago || 0), 0);
  const estadoPagamento = (clientId, valorFaturado) => {
    const total = totalPagoCli(clientId);
    if (total <= 0) return 'PENDENTE';
    if (total >= valorFaturado - 0.01) return 'PAGO';
    return 'PARCIAL';
  };

  // Abrir modal de associação
  const abrirLinkModal = async (clientId, clientName, valorFaturado) => {
    setLinkModal({ clientId, clientName, valorFaturado });
    setSelectedRun(null);
    setRunsLoading(true);
    const { data } = await supabase
      .from('reconciliation_runs')
      .select('id, filename, created_at, transaction_count')
      .order('created_at', { ascending: false })
      .limit(30);
    setRunsLista(data || []);
    setRunsLoading(false);
  };

  const selecionarRun = async (runId) => {
    if (!runId) { setSelectedRun(null); return; }
    setRunLoading(true);
    const { data } = await supabase
      .from('reconciliation_runs')
      .select('id, filename, results_json')
      .eq('id', runId)
      .single();
    setSelectedRun(data);
    setRunLoading(false);
  };

  // Transações de crédito disponíveis no run seleccionado (ainda não associadas a este cliente/período)
  const creditosDisponiveis = useMemo(() => {
    if (!selectedRun?.results_json) return [];
    const jaAssociados = new Set(
      pagamentos
        .filter(p => p.reconciliation_run_id === selectedRun.id)
        .map(p => `${p.transaction_section}_${p.transaction_index}`)
    );
    const result = [];
    const sections = [
      { key: 'matched',     items: selectedRun.results_json.matched || [] },
      { key: 'orphan_bank', items: selectedRun.results_json.orphan_bank || [] },
    ];
    for (const { key, items } of sections) {
      items.forEach((item, idx) => {
        const tx = item.transacao ?? item;
        if (tx?.tipo === 'credito' && !jaAssociados.has(`${key}_${idx}`)) {
          result.push({ section: key, index: idx, tx });
        }
      });
    }
    return result;
  }, [selectedRun, pagamentos]);

  const associarPagamento = async (section, index, tx) => {
    if (!linkModal || !selectedRun) return;
    setLinkSaving(true);
    // Verificar se já existe para evitar duplicados
    const { data: existente } = await supabase
      .from('faturacao_clientes_pagamentos')
      .select('id')
      .eq('reconciliation_run_id', selectedRun.id)
      .eq('transaction_section', section)
      .eq('transaction_index', index)
      .maybeSingle();
    if (!existente) {
      await supabase.from('faturacao_clientes_pagamentos').insert({
        client_id: linkModal.clientId,
        period: selectedMonth,
        valor_faturado: linkModal.valorFaturado,
        reconciliation_run_id: selectedRun.id,
        transaction_section: section,
        transaction_index: index,
        transaction_data: tx,
        valor_pago: Number(tx.valor),
      });
    }
    await carregarPagamentos();
    setLinkSaving(false);
  };

  const removerPagamento = async (pagId) => {
    await supabase.from('faturacao_clientes_pagamentos').delete().eq('id', pagId);
    await carregarPagamentos();
  };

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
                <th className="px-4 py-2 text-[10px] font-black uppercase tracking-widest">Pago Banco</th>
                <th className="px-4 py-2 text-[10px] font-black uppercase tracking-widest">Estado</th>
              </tr>
            </thead>
            <tbody>
              {clientCosts.length === 0 ? (
                <tr><td colSpan="5" className="py-16 text-center text-slate-400 text-sm font-medium">Sem dados para o período selecionado.</td></tr>
              ) : clientCosts.map((item) => {
                const estado = estadoPagamento(item.id, item.cost);
                const totalPago = totalPagoCli(item.id);
                return (
                  <tr key={item.id} className="bg-slate-50/30 hover:bg-white hover:shadow-md transition-all duration-300">
                    <td className="px-4 py-3 rounded-l-2xl border-y border-l border-slate-100 text-sm font-black text-slate-800">{item.name}</td>
                    <td className="px-4 py-3 border-y border-slate-100 text-sm font-bold text-slate-600">{item.totalHours.toFixed(1)}h</td>
                    <td className="px-4 py-3 border-y border-slate-100 text-sm font-black text-indigo-700">{formatCurrency(item.cost)}</td>
                    <td className="px-4 py-3 border-y border-slate-100 text-sm font-bold text-emerald-700">
                      {totalPago > 0 ? formatCurrency(totalPago) : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-4 py-3 rounded-r-2xl border-y border-r border-slate-100">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest ${
                          estado === 'PAGO'    ? 'bg-emerald-100 text-emerald-700' :
                          estado === 'PARCIAL' ? 'bg-amber-100 text-amber-700' :
                                                'bg-rose-100 text-rose-600'
                        }`}>{estado}</span>
                        <button
                          onClick={() => abrirLinkModal(item.id, item.name, item.cost)}
                          className="p-1 rounded-lg text-slate-300 hover:text-indigo-500 hover:bg-indigo-50 transition-all"
                          title="Associar pagamento bancário"
                        >
                          <Link2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {clientCosts.length > 0 && (
                <tr className="bg-slate-100/60">
                  <td className="px-4 py-3 rounded-l-2xl text-[10px] font-black uppercase text-slate-500">Total</td>
                  <td className="px-4 py-3 text-sm font-black text-slate-700">{clientCosts.reduce((a, i) => a + i.totalHours, 0).toFixed(1)}h</td>
                  <td className="px-4 py-3 text-sm font-black text-indigo-700">{formatCurrency(clientCosts.reduce((a, i) => a + i.cost, 0))}</td>
                  <td className="px-4 py-3 text-sm font-black text-emerald-700">{formatCurrency(pagamentos.reduce((s, p) => s + Number(p.valor_pago || 0), 0))}</td>
                  <td className="px-4 py-3 rounded-r-2xl"></td>
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
        <div className="flex items-center gap-3">
          <div className="bg-indigo-50 p-2 rounded-xl text-indigo-600"><FileText size={20} /></div>
          <h3 className="font-black text-base sm:text-xl text-slate-800 uppercase tracking-tight">{getTitle()}</h3>
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

      {/* Modal: Associar Pagamento Bancário */}
      {linkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-lg p-6 sm:p-8 space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-black text-slate-800 text-base uppercase tracking-tight">Pagamentos Bancários</h3>
                <p className="text-xs text-slate-400 mt-0.5">{linkModal.clientName} · {selectedMonth}</p>
              </div>
              <button onClick={() => setLinkModal(null)} className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-all"><X size={16} /></button>
            </div>

            {/* Pagamentos já associados */}
            {pagamentosDoCliente(linkModal.clientId).length > 0 && (
              <div className="space-y-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Associados</p>
                {pagamentosDoCliente(linkModal.clientId).map(p => (
                  <div key={p.id} className="flex items-center justify-between bg-emerald-50 rounded-2xl px-4 py-3">
                    <div>
                      <p className="text-sm font-bold text-emerald-800">{formatCurrency(p.valor_pago)}</p>
                      <p className="text-[10px] text-slate-500">{p.transaction_data?.data} · {p.transaction_data?.descricao?.slice(0, 50)}</p>
                    </div>
                    <button onClick={() => removerPagamento(p.id)} className="p-1.5 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"><X size={13} /></button>
                  </div>
                ))}
              </div>
            )}

            {/* Seleccionar Run */}
            <div className="space-y-2">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Adicionar pagamento de extrato</p>
              {runsLoading ? (
                <div className="flex items-center gap-2 text-slate-400 text-sm"><Loader2 size={14} className="animate-spin" /> A carregar extratos...</div>
              ) : (
                <select
                  value={selectedRun?.id || ''}
                  onChange={e => selecionarRun(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-bold outline-none"
                >
                  <option value="">Selecionar extrato bancário...</option>
                  {runsLista.map(r => (
                    <option key={r.id} value={r.id}>
                      {r.filename} · {new Date(r.created_at).toLocaleDateString('pt-PT')}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Transações de crédito do run */}
            {runLoading && (
              <div className="flex items-center gap-2 text-slate-400 text-sm"><Loader2 size={14} className="animate-spin" /> A carregar movimentos...</div>
            )}
            {selectedRun && !runLoading && (
              <div className="space-y-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Entradas disponíveis ({creditosDisponiveis.length})
                </p>
                {creditosDisponiveis.length === 0 && (
                  <p className="text-xs text-slate-400 italic">Sem transações de entrada disponíveis neste extrato.</p>
                )}
                {creditosDisponiveis.map(({ section, index, tx }) => (
                  <button
                    key={`${section}_${index}`}
                    onClick={() => associarPagamento(section, index, tx)}
                    disabled={linkSaving}
                    className="w-full flex items-center justify-between bg-slate-50 hover:bg-indigo-50 border border-slate-100 hover:border-indigo-200 rounded-2xl px-4 py-3 transition-all text-left disabled:opacity-50"
                  >
                    <div>
                      <p className="text-sm font-bold text-slate-800">{formatCurrency(Number(tx.valor))}</p>
                      <p className="text-[10px] text-slate-500">{tx.data} · {(tx.descricao || '').slice(0, 55)}</p>
                    </div>
                    {linkSaving ? <Loader2 size={13} className="animate-spin text-indigo-500" /> : <Plus size={14} className="text-indigo-400" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default CostReports;
