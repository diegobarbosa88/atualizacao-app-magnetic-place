import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { Users, Building2, TrendingUp, Receipt, CalendarRange, FileText, Download, BookOpen, ChevronDown, Coins } from 'lucide-react';
import AjudasCalculadora from './cost-reports/AjudasCalculadora';
import EquipaTab from './cost-reports/EquipaTab';
import ClientesTab from './cost-reports/ClientesTab';
import MargemTab from './cost-reports/MargemTab';
import DespesasTab from './cost-reports/DespesasTab';
import FaturasTab from './cost-reports/FaturasTab';
import { generateMonthOptions } from './cost-reports/costReportsUtils';
import { exportToXLS, exportRelatorioGeralPDF, exportRelatorioGeralXLS } from './cost-reports/exportUtils';
import { useCostReportsData } from './cost-reports/useCostReportsData';
import SectionHeaderShell from '../../components/common/SectionHeaderShell';
import './reconciliacao/reconciliacao-mockup.css';
import { FT } from '../../styles/designTokens';

const CostReports = () => {
  const { workers, clients, logs, expenses, saveToDb, handleDelete, supabase } = useApp();
  const location = useLocation();
  const navigate = useNavigate();

  const activeTab = location.pathname.split('/')[3] || 'workers';
  const setActiveTab = (id) => navigate('/admin/costs/' + id);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().substring(0, 7));
  const [workerRateHistory, setWorkerRateHistory] = useState([]);
  const [clientRateHistory, setClientRateHistory] = useState([]);
  const [showRelatorioMenu, setShowRelatorioMenu] = useState(false);
  const relatorioMenuRef = useRef(null);

  // Despesas: faturas PAGO já classificadas em 4 baldes — nenhuma entra
  // silenciosamente onde não devia (ver P0/P1 desta sessão).
  const [faturasPago, setFaturasPago] = useState([]);
  const [faturasExcluidas, setFaturasExcluidas] = useState([]); // excluídas manualmente (botão na tabela)
  const [faturasClienteExcluidas, setFaturasClienteExcluidas] = useState([]); // tipo='cliente' — receita, não despesa
  const [faturasSemData, setFaturasSemData] = useState([]); // sem data_pagamento nem data_fatura

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
      .select('id, tipo, entidade, descricao, valor, data_documento, dados, filename, importado_em')
      .eq('status', 'PAGO')
      .then(({ data, error }) => {
        if (error) { console.error('faturasPago:', error); return; }
        const filtered = [];
        const excluidasManual = [];
        const clienteExcluidas = [];
        const semData = [];
        (data || []).forEach(f => {
          // Fonte de verdade da data: só 2 campos explícitos — nunca um
          // fallback silencioso para data_documento/importado_em (ver
          // auditoria P1 desta sessão). Sem nenhum dos dois, a fatura
          // fica em "sem data", nunca atribuída a um mês por acaso.
          const data_ref = f.dados?.data_pagamento || f.dados?.data_fatura;
          if (!data_ref) { semData.push(f); return; }
          if (data_ref.substring(0, 7) !== selectedMonth) return;
          // Faturas de cliente são receita, nunca despesa (bug corrigido
          // hoje) — ficam à parte, visíveis, não somem do cálculo.
          if (f.tipo === 'cliente') { clienteExcluidas.push(f); return; }
          if (f.dados?.excluida_das_despesas) excluidasManual.push(f);
          else filtered.push(f);
        });
        setFaturasPago(filtered);
        setFaturasExcluidas(excluidasManual);
        setFaturasClienteExcluidas(clienteExcluidas);
        setFaturasSemData(semData);
      });
  }, [supabase, selectedMonth]);

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
    if (activeTab === 'faturas') return 'Faturas de Clientes';
    if (activeTab === 'margins') return 'Margem Bruta por Cliente';
    if (activeTab === 'expenses') return 'Despesas';
    if (activeTab === 'ajudas')   return 'Ajudas de Custo — Faturação';
    return 'Relatórios';
  };

  const renderContent = () => {
    if (activeTab === 'workers') return <EquipaTab workerCosts={workerCosts} />;
    if (activeTab === 'clients') return <ClientesTab clientCosts={clientCosts} supabase={supabase} selectedMonth={selectedMonth} />;
    if (activeTab === 'faturas') return <FaturasTab supabase={supabase} />;
    if (activeTab === 'margins') return <MargemTab clientMargins={clientMargins} />;
    if (activeTab === 'expenses') {
      return (
        <DespesasTab
          allExpensesSorted={allExpensesSorted}
          totalAllExpenses={totalAllExpenses}
          selectedMonth={selectedMonth}
          faturasExcluidas={faturasExcluidas}
          faturasClienteExcluidas={faturasClienteExcluidas}
          faturasSemData={faturasSemData}
          excluirFaturaDespesa={excluirFaturaDespesa}
          restaurarFaturaDespesa={restaurarFaturaDespesa}
          saveToDb={saveToDb}
          handleDelete={handleDelete}
        />
      );
    }
    if (activeTab === 'ajudas') {
      return (
        <div>
          <div className="flex items-start gap-2.5 bg-white border border-slate-200 rounded-2xl px-4 py-3 mb-5 text-xs text-slate-500" style={{ borderLeftWidth: '3px', borderLeftColor: FT.slate }}>
            <span className="shrink-0">🎫</span>
            <p>Valor extraído dos recibos do mês (<strong className="text-slate-700 font-black">ajudas de custo</strong>) por trabalhador, a faturar aos clientes. O <strong className="text-slate-700 font-black">saldo de meses anteriores</strong> (sub- ou sobre-faturado face ao recibo real) é compensado automaticamente na previsão do mês seguinte.</p>
          </div>
          <AjudasCalculadora logs={logs} clients={clients} selectedMonth={selectedMonth} />
        </div>
      );
    }
    return null;
  };

  const exportArgs = { workerCosts, clientCosts, clientMargins, allExpensesSorted, totalAllExpenses, selectedMonth };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <SectionHeaderShell
        icon={<FileText size={18} />}
        title={getTitle()}
        rightSlot={(
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button onClick={() => exportToXLS({ activeTab, ...exportArgs })} className="flex items-center gap-1.5 px-3 py-2 text-white rounded-xl font-black text-xs uppercase shadow-sm transition-all" style={{ backgroundColor: FT.navy }}>
              <Download size={13} /> Exportar
            </button>
            <div className="relative" ref={relatorioMenuRef}>
              <button onClick={() => setShowRelatorioMenu(v => !v)} className="flex items-center gap-1.5 px-3 py-2 rounded-xl font-black text-xs uppercase shadow-sm transition-all border-2 hover:bg-slate-50 bg-white" style={{ borderColor: FT.slate, color: FT.navy }}>
                <BookOpen size={13} /> Geral <ChevronDown size={11} />
              </button>
              {showRelatorioMenu && (
                <div className="absolute right-0 top-full mt-1 z-20 bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden min-w-[160px]">
                  <button onClick={() => { setShowRelatorioMenu(false); exportRelatorioGeralPDF(exportArgs); }} className="w-full flex items-center gap-2 px-4 py-3 text-xs font-black uppercase text-slate-700 hover:bg-slate-50 hover:text-slate-700 transition-all">
                    <FileText size={13} /> PDF
                  </button>
                  <button onClick={() => { setShowRelatorioMenu(false); exportRelatorioGeralXLS(exportArgs); }} className="w-full flex items-center gap-2 px-4 py-3 text-xs font-black uppercase text-slate-700 hover:bg-slate-50 hover:text-slate-700 transition-all border-t border-slate-100">
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
        )}
      />

      <div className="bg-white p-4 sm:p-6 lg:p-8 rounded-2xl sm:rounded-[2.5rem] shadow-xl border border-slate-200">
        <div className="recon-scope">
          <div className="recon-tabs mb-6 overflow-x-auto">
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
                className={`recon-tab ${activeTab === id ? 'active' : ''}`}
              >
                <Icon size={13} />
                <span className="whitespace-nowrap">{label}</span>
              </button>
            ))}
          </div>
        </div>
        {renderContent()}
      </div>
    </div>
  );
};

export default CostReports;
