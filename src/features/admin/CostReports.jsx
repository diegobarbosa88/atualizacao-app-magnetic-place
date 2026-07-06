import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { Users, Building2, TrendingUp, Receipt, CalendarRange, FileText, Trash2, X, Download, Link2, Loader2, Plus, BookOpen, ChevronDown, Coins } from 'lucide-react';
import AjudasCalculadora from './cost-reports/AjudasCalculadora';
import { toISODateLocal } from '../../utils/dateUtils';
import { formatCurrency, formatDate, getMonthLabel, parseFaturaValor, generateMonthOptions } from './cost-reports/costReportsUtils';
import { exportToXLS, exportRelatorioGeralPDF, exportRelatorioGeralXLS } from './cost-reports/exportUtils';
import { useCostReportsData } from './cost-reports/useCostReportsData';
import LinkPagamentoModal from './cost-reports/LinkPagamentoModal';
import LinkFaturaModal from './cost-reports/LinkFaturaModal';

const CostReports = () => {
  const { workers, clients, logs, expenses, saveToDb, handleDelete, supabase } = useApp();
  const location = useLocation();
  const navigate = useNavigate();

  const activeTab = location.pathname.split('/')[3] || 'workers';
  const setActiveTab = (id) => navigate('/admin/costs/' + id);
  const [pagamentos, setPagamentos] = useState([]);
  const [pagamentosLoading, setPagamentosLoading] = useState(false);
  const [linkModal, setLinkModal] = useState(null);
  const [runsLista, setRunsLista] = useState([]);
  const [runsLoading, setRunsLoading] = useState(false);
  const [selectedRun, setSelectedRun] = useState(null);
  const [runLoading, setRunLoading] = useState(false);
  const [linkSaving, setLinkSaving] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().substring(0, 7));
  const [isAddingExpense, setIsAddingExpense] = useState(false);
  const [expenseForm, setExpenseForm] = useState({ id: null, name: '', amount: '', type: 'fixo', date: toISODateLocal(new Date()) });
  const [faturasPago, setFaturasPago] = useState([]);
  const [workerRateHistory, setWorkerRateHistory] = useState([]);
  const [clientRateHistory, setClientRateHistory] = useState([]);
  const [showRelatorioMenu, setShowRelatorioMenu] = useState(false);
  const relatorioMenuRef = useRef(null);
  const [faturasExcluidas, setFaturasExcluidas] = useState([]);
  const [showExcluidas, setShowExcluidas] = useState(false);
  const [clienteFaturas, setClienteFaturas] = useState([]);
  const [faturasLoading, setFaturasLoading] = useState(false);
  const [isAddingFatura, setIsAddingFatura] = useState(false);
  const [faturaForm, setFaturaForm] = useState({ cliente: '', numero: '', valor: '', data: toISODateLocal(new Date()) });
  const [faturaSaving, setFaturaSaving] = useState(false);
  const [fatLinks, setFatLinks] = useState([]);
  const [linkFaturaModal, setLinkFaturaModal] = useState(null);
  const [selectedRunFatura, setSelectedRunFatura] = useState(null);
  const [runFaturaLoading, setRunFaturaLoading] = useState(false);
  const [linkFaturaSaving, setLinkFaturaSaving] = useState(false);

  const monthOptions = useMemo(() => generateMonthOptions(), []);

  useEffect(() => {
    if (!supabase) return;
    supabase.from('worker_valorhora_history').select('*')
      .then(({ data }) => setWorkerRateHistory(data || []));
    supabase.from('client_valorhora_history').select('*')
      .then(({ data }) => setClientRateHistory(data || []));
  }, [supabase]);

  useEffect(() => {
    if (!supabase || !selectedMonth) return;
    supabase
      .from('faturas')
      .select('id, entidade, descricao, valor, data_documento, dados, filename, importado_em')
      .eq('status', 'PAGO')
      .then(({ data, error }) => {
        if (error) { console.error('faturasPago:', error); return; }
        const filtered = [];
        const excluidas = [];
        (data || []).forEach(f => {
          const data_ref = f.dados?.data_pagamento || f.dados?.data_fatura || f.data_documento || f.importado_em;
          if (data_ref?.substring(0, 7) !== selectedMonth) return;
          if (f.dados?.excluida_das_despesas) excluidas.push(f);
          else filtered.push(f);
        });
        setFaturasPago(filtered);
        setFaturasExcluidas(excluidas);
      });
  }, [supabase, selectedMonth]);

  useEffect(() => {
    if (!supabase) return;
    setFaturasLoading(true);
    Promise.all([
      supabase.from('faturas').select('id, dados, status, importado_em').eq('tipo', 'cliente').order('importado_em', { ascending: false }),
      supabase.from('fatura_pagamento_links').select('fatura_id, run_id, tx_key, auto_matched'),
    ]).then(([{ data: fats }, { data: links }]) => {
      setClienteFaturas(fats || []);
      setFatLinks(links || []);
      setFaturasLoading(false);
    });
  }, [supabase]);

  const carregarPagamentos = useCallback(async () => {
    if (!supabase) return;
    setPagamentosLoading(true);
    const { data } = await supabase.from('faturacao_clientes_pagamentos').select('*').eq('period', selectedMonth);
    setPagamentos(data || []);
    setPagamentosLoading(false);
  }, [supabase, selectedMonth]);

  useEffect(() => { carregarPagamentos(); }, [carregarPagamentos]);

  useEffect(() => {
    if (!showRelatorioMenu) return;
    const handleClick = (e) => {
      if (relatorioMenuRef.current && !relatorioMenuRef.current.contains(e.target)) setShowRelatorioMenu(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showRelatorioMenu]);

  const { workerCosts, clientCosts, clientMargins, allExpensesSorted, totalAllExpenses } = useCostReportsData({
    logs, workers, clients, expenses, selectedMonth, faturasPago,
    workerRateHistory, clientRateHistory,
  });

  const pagamentosDoCliente = (clientId) => pagamentos.filter(p => p.client_id === clientId);
  const totalPagoCli = (clientId) => pagamentosDoCliente(clientId).reduce((s, p) => s + Number(p.valor_pago || 0), 0);
  const estadoPagamento = (clientId, valorFaturado) => {
    const total = totalPagoCli(clientId);
    if (total <= 0) return 'PENDENTE';
    if (total >= valorFaturado - 0.01) return 'PAGO';
    return 'PARCIAL';
  };

  const creditosDisponiveis = useMemo(() => {
    if (!selectedRun?.results_json) return [];
    const jaAssociados = new Set(
      pagamentos.filter(p => p.reconciliation_run_id === selectedRun.id).map(p => `${p.transaction_section}_${p.transaction_index}`)
    );
    const result = [];
    const sections = [
      { key: 'matched', items: selectedRun.results_json.matched || [] },
      { key: 'orphan_bank', items: selectedRun.results_json.orphan_bank || [] },
    ];
    for (const { key, items } of sections) {
      items.forEach((item, idx) => {
        const tx = item.transacao ?? item;
        if (tx?.tipo === 'credito' && !jaAssociados.has(`${key}_${idx}`)) result.push({ section: key, index: idx, tx });
      });
    }
    return result;
  }, [selectedRun, pagamentos]);

  const creditosDisponiveisFatura = useMemo(() => {
    if (!selectedRunFatura?.results_json) return [];
    const usedKeys = new Set(fatLinks.map(fl => fl.tx_key));
    const result = [];
    for (const { key, items } of [
      { key: 'matched', items: selectedRunFatura.results_json.matched || [] },
      { key: 'orphan_bank', items: selectedRunFatura.results_json.orphan_bank || [] },
    ]) {
      items.forEach((item, idx) => {
        const tx = item.transacao ?? item;
        if (tx?.tipo === 'credito' && !usedKeys.has(`${tx.data}|${tx.descricao}|${tx.valor}`))
          result.push({ section: key, index: idx, tx });
      });
    }
    return result;
  }, [selectedRunFatura, fatLinks]);

  const recarregarFaturas = async () => {
    const [{ data: fats }, { data: links }] = await Promise.all([
      supabase.from('faturas').select('id,dados,status,importado_em').eq('tipo','cliente').order('importado_em',{ascending:false}),
      supabase.from('fatura_pagamento_links').select('fatura_id,run_id,tx_key,auto_matched'),
    ]);
    setClienteFaturas(fats || []);
    setFatLinks(links || []);
  };

  const abrirLinkFaturaModal = async (fatura) => {
    setLinkFaturaModal(fatura);
    setSelectedRunFatura(null);
    setRunsLoading(true);
    const { data } = await supabase.from('reconciliation_runs')
      .select('id, filename, created_at, transaction_count')
      .order('created_at', { ascending: false }).limit(30);
    setRunsLista(data || []);
    setRunsLoading(false);
  };

  const selecionarRunFatura = async (runId) => {
    if (!runId) { setSelectedRunFatura(null); return; }
    setRunFaturaLoading(true);
    const { data } = await supabase.from('reconciliation_runs').select('id, filename, results_json').eq('id', runId).single();
    setSelectedRunFatura(data);
    setRunFaturaLoading(false);
  };

  const associarPagamentoFatura = async (section, index, tx) => {
    if (!linkFaturaModal || !selectedRunFatura) return;
    setLinkFaturaSaving(true);
    const key = `${tx.data}|${tx.descricao}|${tx.valor}`;
    await supabase.from('fatura_pagamento_links').upsert(
      { fatura_id: linkFaturaModal.id, run_id: selectedRunFatura.id, tx_key: key, auto_matched: false },
      { onConflict: 'fatura_id' }
    );
    await supabase.from('faturas').update({ status: 'PAGO' }).eq('id', linkFaturaModal.id);
    await recarregarFaturas();
    setLinkFaturaSaving(false);
    setLinkFaturaModal(null);
  };

  const removerPagamentoFatura = async (faturaId) => {
    await supabase.from('fatura_pagamento_links').delete().eq('fatura_id', faturaId);
    await supabase.from('faturas').update({ status: 'PENDENTE' }).eq('id', faturaId);
    await recarregarFaturas();
  };

  const abrirLinkModal = async (clientId, clientName, valorFaturado) => {
    setLinkModal({ clientId, clientName, valorFaturado });
    setSelectedRun(null);
    setRunsLoading(true);
    const { data } = await supabase.from('reconciliation_runs').select('id, filename, created_at, transaction_count').order('created_at', { ascending: false }).limit(30);
    setRunsLista(data || []);
    setRunsLoading(false);
  };

  const selecionarRun = async (runId) => {
    if (!runId) { setSelectedRun(null); return; }
    setRunLoading(true);
    const { data } = await supabase.from('reconciliation_runs').select('id, filename, results_json').eq('id', runId).single();
    setSelectedRun(data);
    setRunLoading(false);
  };

  const associarPagamento = async (section, index, tx) => {
    if (!linkModal || !selectedRun) return;
    setLinkSaving(true);
    const { data: existente } = await supabase.from('faturacao_clientes_pagamentos').select('id').eq('reconciliation_run_id', selectedRun.id).eq('transaction_section', section).eq('transaction_index', index).maybeSingle();
    if (!existente) {
      await supabase.from('faturacao_clientes_pagamentos').insert({
        client_id: linkModal.clientId, period: selectedMonth, valor_faturado: linkModal.valorFaturado,
        reconciliation_run_id: selectedRun.id, transaction_section: section, transaction_index: index,
        transaction_data: tx, valor_pago: Number(tx.valor),
      });
    }
    await carregarPagamentos();
    setLinkSaving(false);
  };

  const removerPagamento = async (pagId) => {
    await supabase.from('faturacao_clientes_pagamentos').delete().eq('id', pagId);
    await carregarPagamentos();
  };

  const handleSaveExpense = async () => {
    if (!expenseForm.name || !expenseForm.amount) return alert('Descrição e valor são obrigatórios');
    const eId = expenseForm.id || `e${Date.now()}`;
    await saveToDb('expenses', eId, { ...expenseForm, id: eId });
    setIsAddingExpense(false);
    setExpenseForm({ id: null, name: '', amount: '', type: 'fixo', date: toISODateLocal(new Date()) });
  };

  const handleSaveFatura = async () => {
    if (!faturaForm.cliente || !faturaForm.numero || !faturaForm.valor) return alert('Cliente, número e valor são obrigatórios');
    setFaturaSaving(true);
    const valorNum = parseFloat(faturaForm.valor.replace(/\./g, '').replace(',', '.')) || 0;
    await supabase.from('faturas').insert({
      gmail_message_id: `manual_${Date.now()}`, filename: `fatura_cliente_${Date.now()}.pdf`,
      storage_path: '', url: '', mime_type: 'application/pdf', tamanho: 0,
      importado_em: new Date().toISOString(), tipo: 'cliente',
      dados: { fornecedor: faturaForm.cliente, numero_fatura: faturaForm.numero, valor_total: valorNum, data_fatura: faturaForm.data },
      status: 'PENDENTE', fonte: 'manual', valor: valorNum, data_documento: faturaForm.data,
      descricao: `Fatura cliente: ${faturaForm.cliente}`, entidade: faturaForm.cliente,
    });
    setFaturaForm({ cliente: '', numero: '', valor: '', data: toISODateLocal(new Date()) });
    setIsAddingFatura(false);
    setFaturaSaving(false);
    const { data } = await supabase.from('faturas').select('id, dados, status, importado_em').eq('tipo', 'cliente').order('importado_em', { ascending: false });
    setClienteFaturas(data || []);
  };

  const excluirFaturaDespesa = async (faturaId) => {
    const { data: f } = await supabase.from('faturas').select('dados').eq('id', faturaId).single();
    await supabase.from('faturas').update({ dados: { ...(f?.dados || {}), excluida_das_despesas: true } }).eq('id', faturaId);
    const fatura = faturasPago.find(x => x.id === faturaId);
    setFaturasPago(prev => prev.filter(x => x.id !== faturaId));
    if (fatura) setFaturasExcluidas(prev => [...prev, { ...fatura, dados: { ...(fatura.dados || {}), excluida_das_despesas: true } }]);
  };

  const restaurarFaturaDespesa = async (faturaId) => {
    const { data: f } = await supabase.from('faturas').select('dados').eq('id', faturaId).single();
    const novosDados = { ...(f?.dados || {}) };
    delete novosDados.excluida_das_despesas;
    await supabase.from('faturas').update({ dados: novosDados }).eq('id', faturaId);
    const fatura = faturasExcluidas.find(x => x.id === faturaId);
    setFaturasExcluidas(prev => prev.filter(x => x.id !== faturaId));
    if (fatura) setFaturasPago(prev => [...prev, { ...fatura, dados: novosDados }]);
  };

  const getTitle = () => {
    if (activeTab === 'workers') return 'Custos por Trabalhador';
    if (activeTab === 'clients') return 'Faturação por Cliente';
    if (activeTab === 'margins') return 'Margem Bruta por Cliente';
    if (activeTab === 'expenses') return 'Despesas';
    if (activeTab === 'ajudas')   return 'Ajudas de Custo — Faturação';
    return 'Relatórios';
  };

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
                          estado === 'PAGO' ? 'bg-emerald-100 text-emerald-700' :
                          estado === 'PARCIAL' ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-600'
                        }`}>{estado}</span>
                        <button onClick={() => abrirLinkModal(item.id, item.name, item.cost)} className="p-1 rounded-lg text-slate-300 hover:text-indigo-500 hover:bg-indigo-50 transition-all" title="Associar pagamento bancário">
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

    if (activeTab === 'faturas') {
      return (
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-black text-slate-700 uppercase tracking-tight">Faturas de Clientes</h3>
              <p className="text-[10px] text-slate-400 mt-0.5">{clienteFaturas.filter(f => f.status === 'PENDENTE').length} pendentes · {clienteFaturas.filter(f => f.status === 'PAGO').length} pagas</p>
            </div>
            <button onClick={() => setIsAddingFatura(true)} className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase shadow-sm hover:bg-indigo-700 transition-colors">
              <Plus size={12} /> Inserir Fatura
            </button>
          </div>
          {isAddingFatura && (
            <div className="mb-6 bg-slate-50 p-4 sm:p-6 rounded-2xl border border-slate-200">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Cliente</label>
                  <input type="text" value={faturaForm.cliente} onChange={e => setFaturaForm({ ...faturaForm, cliente: e.target.value })} className="w-full bg-white border border-slate-200 rounded-xl p-3 text-sm font-bold outline-none shadow-sm" placeholder="Nome do cliente..." />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Número Fatura</label>
                  <input type="text" value={faturaForm.numero} onChange={e => setFaturaForm({ ...faturaForm, numero: e.target.value })} className="w-full bg-white border border-slate-200 rounded-xl p-3 text-sm font-bold outline-none shadow-sm" placeholder="FT 2026/001..." />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Valor (€)</label>
                  <input type="text" value={faturaForm.valor} onChange={e => setFaturaForm({ ...faturaForm, valor: e.target.value })} className="w-full bg-white border border-slate-200 rounded-xl p-3 text-sm font-bold text-indigo-700 outline-none shadow-sm" placeholder="0,00" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Data</label>
                  <input type="date" value={faturaForm.data} onChange={e => setFaturaForm({ ...faturaForm, data: e.target.value })} className="w-full bg-white border border-slate-200 rounded-xl p-3 text-sm shadow-sm" />
                </div>
              </div>
              <div className="mt-4 flex items-center gap-3">
                <button onClick={handleSaveFatura} disabled={faturaSaving} className="flex-1 bg-indigo-600 text-white py-4 rounded-2xl font-black text-xs uppercase shadow-lg hover:bg-indigo-700 transition-colors disabled:opacity-50">
                  {faturaSaving ? <><Loader2 size={14} className="animate-spin inline" /> A guardar...</> : 'Guardar Fatura'}
                </button>
                <button onClick={() => { setIsAddingFatura(false); setFaturaForm({ cliente: '', numero: '', valor: '', data: toISODateLocal(new Date()) }); }} className="px-6 py-4 bg-slate-200 text-slate-600 rounded-2xl font-black text-xs uppercase shadow-sm hover:bg-slate-300 transition-colors">Cancelar</button>
              </div>
            </div>
          )}
          <div className="overflow-x-auto -mx-2">
            <table className="w-full text-left border-separate border-spacing-y-2">
              <thead>
                <tr className="text-slate-400">
                  <th className="px-4 py-2 text-[10px] font-black uppercase tracking-widest">Cliente</th>
                  <th className="px-4 py-2 text-[10px] font-black uppercase tracking-widest">Número</th>
                  <th className="px-4 py-2 text-[10px] font-black uppercase tracking-widest">Valor</th>
                  <th className="px-4 py-2 text-[10px] font-black uppercase tracking-widest">Data</th>
                  <th className="px-4 py-2 text-[10px] font-black uppercase tracking-widest">Estado</th>
                  <th className="px-4 py-2 text-[10px] font-black uppercase tracking-widest text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {clienteFaturas.length === 0 ? (
                  <tr><td colSpan="6" className="py-16 text-center text-slate-400 text-sm font-medium">Nenhuma fatura de cliente inserida.</td></tr>
                ) : clienteFaturas.map(f => {
                  const dados = f.dados || {};
                  const valor = parseFaturaValor({ dados: { valor_total: dados.valor_total } });
                  return (
                    <tr key={f.id} className="bg-white hover:shadow-md transition-all duration-300 border border-slate-100">
                      <td className="px-4 py-3 rounded-l-2xl text-sm font-black text-slate-800">{dados.fornecedor || '—'}</td>
                      <td className="px-4 py-3 text-sm font-bold text-slate-600">{dados.numero_fatura || '—'}</td>
                      <td className="px-4 py-3 text-sm font-black text-indigo-700">{formatCurrency(valor)}</td>
                      <td className="px-4 py-3 text-sm font-bold text-slate-500">{dados.data_fatura ? new Date(dados.data_fatura).toLocaleDateString('pt-PT') : '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${f.status === 'PAGO' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{f.status}</span>
                      </td>
                      <td className="px-4 py-3 rounded-r-2xl text-right">
                        {(() => {
                          const fl = fatLinks.find(l => l.fatura_id === f.id);
                          if (fl) {
                            return (
                              <div className="flex items-center justify-end gap-2">
                                <span className="text-[9px] text-slate-400 truncate max-w-[120px]" title={fl.tx_key}>
                                  {fl.tx_key?.split('|')[0]} · {fl.tx_key?.split('|')[2]} €
                                </span>
                                <button onClick={() => removerPagamentoFatura(f.id)} className="text-rose-400 hover:text-rose-600 text-[9px] font-black uppercase hover:underline">Desligar</button>
                              </div>
                            );
                          }
                          return (
                            <div className="flex items-center justify-end gap-2">
                              <button onClick={() => abrirLinkFaturaModal(f)} className="flex items-center gap-1 px-2 py-1 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-lg text-[9px] font-black uppercase transition-colors">
                                <Link2 size={10} /> Ligar
                              </button>
                              {f.status === 'PENDENTE' && (
                                <button onClick={async () => {
                                  await supabase.from('faturas').update({ status: 'PAGO' }).eq('id', f.id);
                                  await recarregarFaturas();
                                }} className="text-emerald-600 hover:text-emerald-800 text-[9px] font-black uppercase hover:underline">PAGO</button>
                              )}
                            </div>
                          );
                        })()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
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
                {allExpensesSorted.length === 0 ? (
                  <tr><td colSpan="5" className="py-16 text-center text-slate-400 text-sm font-medium">Sem despesas para o período selecionado.</td></tr>
                ) : allExpensesSorted.map((exp) => (
                  <tr key={exp.id} className="bg-slate-50/30 hover:bg-white hover:shadow-md transition-all duration-300">
                    <td className="px-4 py-3 rounded-l-2xl border-y border-l border-slate-100 text-xs font-bold text-slate-500 whitespace-nowrap font-mono">
                      {new Date(exp.date).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                    </td>
                    <td className="px-4 py-3 border-y border-slate-100 text-sm font-bold text-slate-800">{exp.name}</td>
                    <td className="px-4 py-3 border-y border-slate-100">
                      <span className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase ${
                        exp.type === 'fatura' ? 'bg-violet-100 text-violet-700' :
                        exp.type === 'fixo'   ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'
                      }`}>{exp.type}</span>
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
                        const data_ref = f.dados?.data_pagamento || f.dados?.data_fatura || f.data_documento || f.importado_em;
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

    if (activeTab === 'ajudas') {
      return <AjudasCalculadora logs={logs} clients={clients} selectedMonth={selectedMonth} />;
    }
  };

  const exportArgs = { workerCosts, clientCosts, clientMargins, allExpensesSorted, totalAllExpenses, selectedMonth };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
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
          <button onClick={() => exportToXLS({ activeTab, ...exportArgs })} className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 text-white rounded-xl font-black text-xs uppercase shadow-sm hover:bg-indigo-700 transition-all">
            <Download size={13} /> Exportar
          </button>
          <div className="relative" ref={relatorioMenuRef}>
            <button onClick={() => setShowRelatorioMenu(v => !v)} className="flex items-center gap-1.5 px-3 py-2 bg-violet-600 text-white rounded-xl font-black text-xs uppercase shadow-sm hover:bg-violet-700 transition-all">
              <BookOpen size={13} /> Geral <ChevronDown size={11} />
            </button>
            {showRelatorioMenu && (
              <div className="absolute right-0 top-full mt-1 z-20 bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden min-w-[160px]">
                <button onClick={() => { setShowRelatorioMenu(false); exportRelatorioGeralPDF(exportArgs); }} className="w-full flex items-center gap-2 px-4 py-3 text-xs font-black uppercase text-slate-700 hover:bg-violet-50 hover:text-violet-700 transition-all">
                  <FileText size={13} /> PDF
                </button>
                <button onClick={() => { setShowRelatorioMenu(false); exportRelatorioGeralXLS(exportArgs); }} className="w-full flex items-center gap-2 px-4 py-3 text-xs font-black uppercase text-slate-700 hover:bg-violet-50 hover:text-violet-700 transition-all border-t border-slate-100">
                  <Download size={13} /> Excel / XLS
                </button>
              </div>
            )}
          </div>
          <div className="flex items-center gap-1.5 bg-white px-3 py-2 rounded-xl shadow-sm border border-slate-200 flex-1 sm:flex-none">
            <CalendarRange size={13} className="text-slate-400 shrink-0" />
            <select value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} className="bg-transparent border-none outline-none text-xs font-bold text-slate-700 cursor-pointer w-full">
              {monthOptions.map((opt, idx) => (
                <option key={`${opt.val}-${idx}`} value={opt.val}>{opt.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white p-4 sm:p-6 lg:p-8 rounded-2xl sm:rounded-[2.5rem] shadow-xl border border-slate-200">
        <div className="grid grid-cols-6 gap-1 mb-6 bg-slate-100 p-1 rounded-2xl w-full">
          {[
            { id: 'workers', icon: Users, label: 'Equipa' },
            { id: 'clients', icon: Building2, label: 'Clientes' },
            { id: 'faturas', icon: FileText, label: 'Faturas' },
            { id: 'margins', icon: TrendingUp, label: 'Margem' },
            { id: 'expenses', icon: Receipt, label: 'Despesas' },
            { id: 'ajudas', icon: Coins, label: 'Ajudas' },
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

      {linkFaturaModal && (
        <LinkFaturaModal
          fatura={linkFaturaModal}
          runsLista={runsLista}
          runsLoading={runsLoading}
          selectedRun={selectedRunFatura}
          runLoading={runFaturaLoading}
          creditosDisponiveisFatura={creditosDisponiveisFatura}
          fatLink={fatLinks.find(l => l.fatura_id === linkFaturaModal.id) || null}
          linkSaving={linkFaturaSaving}
          onClose={() => setLinkFaturaModal(null)}
          selecionarRun={selecionarRunFatura}
          associarPagamentoFatura={associarPagamentoFatura}
          removerPagamentoFatura={removerPagamentoFatura}
        />
      )}
      {linkModal && (
        <LinkPagamentoModal
          linkModal={linkModal}
          selectedMonth={selectedMonth}
          pagamentos={pagamentos}
          runsLista={runsLista}
          runsLoading={runsLoading}
          selectedRun={selectedRun}
          runLoading={runLoading}
          creditosDisponiveis={creditosDisponiveis}
          linkSaving={linkSaving}
          setLinkModal={setLinkModal}
          selecionarRun={selecionarRun}
          associarPagamento={associarPagamento}
          removerPagamento={removerPagamento}
        />
      )}
    </div>
  );
};

export default CostReports;
