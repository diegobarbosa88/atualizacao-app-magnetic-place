import React, { useState, useEffect } from 'react';
import {
  Users, CheckCircle, AlertCircle, Loader2, ChevronDown, ChevronUp,
  Download, Calendar, TrendingUp, Coins, History, FileText, X
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { runReconciliacaoSalarial } from '../../utils/reconciliacaoSalarialEngine';

const MESES_PT = {
  '01': 'Janeiro', '02': 'Fevereiro', '03': 'Março', '04': 'Abril',
  '05': 'Maio', '06': 'Junho', '07': 'Julho', '08': 'Agosto',
  '09': 'Setembro', '10': 'Outubro', '11': 'Novembro', '12': 'Dezembro',
};

function fmt(v) {
  return (parseFloat(v) || 0).toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}

function fmtDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function StatusBadge({ status }) {
  if (status === 'Match Exato') return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest bg-emerald-100 text-emerald-700">
      <CheckCircle size={9} /> Match Exato
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest bg-amber-100 text-amber-700">
      <AlertCircle size={9} /> Saldo Pendente
    </span>
  );
}

function TypeBadge({ type }) {
  if (type === 'Adiantamento') return (
    <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest bg-blue-100 text-blue-700">Adiant.</span>
  );
  return (
    <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest bg-violet-100 text-violet-700">Liquid.</span>
  );
}

function EmployeeCard({ employee }) {
  const [open, setOpen] = useState(false);
  const allMatch = employee.months.every(m => m.status === 'Match Exato');
  const pending = employee.months.filter(m => m.status !== 'Match Exato').length;

  return (
    <div className="border border-slate-200 rounded-2xl overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-white hover:bg-slate-50 transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${allMatch ? 'bg-emerald-500' : 'bg-amber-400'}`} />
          <span className="text-sm font-bold text-slate-800">{employee.employee_name}</span>
          <span className="text-[10px] text-slate-400 font-medium">{employee.months.length} mês(es)</span>
        </div>
        <div className="flex items-center gap-3">
          <span className={`text-[10px] font-black uppercase tracking-widest ${allMatch ? 'text-emerald-600' : 'text-amber-600'}`}>
            {allMatch ? 'Tudo Ok' : `${pending} pendente(s)`}
          </span>
          {open ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
        </div>
      </button>

      {open && (
        <div className="divide-y divide-slate-100 bg-slate-50">
          {employee.months.map(m => {
            const [ano, mm] = m.month.split('-');
            return (
              <div key={m.month} className="px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                      {MESES_PT[mm]} {ano}
                    </span>
                    <StatusBadge status={m.status} />
                  </div>
                  <div className="flex items-center gap-4 text-[11px] text-slate-600">
                    <span>Recibo: <strong>{fmt(m.expected_amount)}</strong></span>
                    <span>Pago: <strong>{fmt(m.total_paid)}</strong></span>
                    <span className={`font-bold ${Math.abs(m.balance) <= 0.01 ? 'text-emerald-600' : 'text-red-600'}`}>
                      Saldo: {fmt(m.balance)}
                    </span>
                  </div>
                </div>

                {m.transfers.length > 0 ? (
                  <div className="space-y-1">
                    {m.transfers.map((t, i) => (
                      <div key={i} className="flex items-center justify-between bg-white border border-slate-100 rounded-xl px-3 py-1.5">
                        <div className="flex items-center gap-2">
                          <TypeBadge type={t.type} />
                          <span className="text-[11px] text-slate-500">{t.date}</span>
                        </div>
                        <span className="text-[12px] font-bold text-slate-700">{fmt(t.amount)}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[11px] text-slate-400 italic">Nenhuma transferência identificada</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function ReconciliacaoSalarialAdmin() {
  const { supabase } = useApp();

  const anoAtual = new Date().getFullYear();
  const [ano, setAno] = useState(String(anoAtual));

  // Histórico de runs disponíveis
  const [historico, setHistorico] = useState([]);
  const [loadingHistorico, setLoadingHistorico] = useState(false);

  // Runs seleccionados para reconciliar
  const [selRuns, setSelRuns] = useState(new Set());
  const [transacoes, setTransacoes] = useState([]);
  const [loadingTx, setLoadingTx] = useState(false);

  // Recibos do Supabase
  const [recibos, setRecibos] = useState([]);
  const [loadingRecibos, setLoadingRecibos] = useState(false);

  const [processando, setProcessando] = useState(false);
  const [erro, setErro] = useState(null);
  const [resultado, setResultado] = useState(null);

  // Carregar histórico de importações
  useEffect(() => {
    if (!supabase) return;
    setLoadingHistorico(true);
    supabase
      .from('reconciliation_runs')
      .select('id, created_at, filename, transaction_count')
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({ data, error }) => {
        setLoadingHistorico(false);
        if (!error) setHistorico(data || []);
      });
  }, [supabase]);

  // Carregar recibos quando o ano muda
  useEffect(() => {
    if (!supabase || !ano) return;
    setLoadingRecibos(true);
    setRecibos([]);
    setResultado(null);
    supabase
      .from('receipt_validations')
      .select('worker_id, worker_name, mes, liquido_extraido, bruto_plataforma, bruto_extraido, estado')
      .like('mes', `${ano}-%`)
      .not('estado', 'in', '("erro","invalido")')
      .then(({ data, error }) => {
        setLoadingRecibos(false);
        if (error) { setErro('Erro ao carregar recibos: ' + error.message); return; }
        setRecibos(data || []);
      });
  }, [supabase, ano]);

  // Quando selRuns muda, carregar transactions_json dos runs seleccionados
  useEffect(() => {
    if (!supabase || selRuns.size === 0) { setTransacoes([]); return; }
    setLoadingTx(true);
    setResultado(null);
    const ids = [...selRuns];
    supabase
      .from('reconciliation_runs')
      .select('id, transactions_json')
      .in('id', ids)
      .then(({ data, error }) => {
        setLoadingTx(false);
        if (error) { setErro('Erro ao carregar transações: ' + error.message); return; }
        const all = (data || []).flatMap(r => r.transactions_json || []);
        setTransacoes(all);
      });
  }, [supabase, selRuns]);

  const toggleRun = (id) => {
    setSelRuns(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleReconciliar = () => {
    if (!recibos.length || !transacoes.length) return;
    setProcessando(true);
    setErro(null);
    try {
      const res = runReconciliacaoSalarial({ recibos, transacoes, ano });
      setResultado(res);
    } catch (e) {
      setErro('Erro na reconciliação: ' + e.message);
    } finally {
      setProcessando(false);
    }
  };

  const handleExportJson = () => {
    if (!resultado) return;
    const blob = new Blob([JSON.stringify(resultado, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reconciliacao_salarial_${ano}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const txSaidas = transacoes.filter(t => t.tipo === 'debito').length;
  const canRun = recibos.length > 0 && transacoes.length > 0;

  // Filtrar runs do histórico pelo ano seleccionado
  const historicoDaAno = historico.filter(r => r.created_at?.startsWith(ano));
  const historicoOutros = historico.filter(r => !r.created_at?.startsWith(ano));

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-base font-black text-slate-800 tracking-tight">Reconciliação Salarial</h2>
          <p className="text-[11px] text-slate-400 mt-0.5">Cruzamento de recibos de vencimento com transferências bancárias</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Ano</label>
          <select
            value={ano}
            onChange={e => { setAno(e.target.value); setSelRuns(new Set()); setResultado(null); }}
            className="border border-slate-200 rounded-xl px-3 py-1.5 text-sm font-bold text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
          >
            {[anoAtual + 1, anoAtual, anoAtual - 1, anoAtual - 2].map(y => (
              <option key={y} value={String(y)}>{y}</option>
            ))}
          </select>
        </div>
      </div>

      {erro && (
        <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-2xl px-4 py-3">
          <AlertCircle size={14} className="text-red-500 mt-0.5 flex-shrink-0" />
          <p className="text-[12px] text-red-700">{erro}</p>
          <button onClick={() => setErro(null)} className="ml-auto text-red-400 hover:text-red-600"><X size={13} /></button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* Selector de extratos do histórico */}
        <div className="border border-slate-200 rounded-2xl p-4 bg-white">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <History size={14} className="text-indigo-500" />
              <span className="text-[11px] font-black uppercase tracking-widest text-slate-600">Extratos Bancários</span>
            </div>
            {loadingHistorico && <Loader2 size={13} className="animate-spin text-slate-400" />}
          </div>

          {historico.length === 0 && !loadingHistorico ? (
            <div className="border-2 border-dashed border-slate-200 rounded-xl px-4 py-6 text-center">
              <History size={20} className="text-slate-300 mx-auto mb-1" />
              <p className="text-[11px] text-slate-400">Sem importações no histórico</p>
            </div>
          ) : (
            <div className="space-y-1 max-h-52 overflow-y-auto pr-1">
              {/* Runs do ano selecionado em primeiro */}
              {historicoDaAno.length > 0 && (
                <>
                  <p className="text-[9px] font-black uppercase tracking-widest text-indigo-500 px-1 pt-1">{ano}</p>
                  {historicoDaAno.map(run => (
                    <RunRow key={run.id} run={run} selected={selRuns.has(run.id)} onToggle={() => toggleRun(run.id)} />
                  ))}
                </>
              )}
              {historicoOutros.length > 0 && (
                <>
                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 px-1 pt-2">Outros</p>
                  {historicoOutros.map(run => (
                    <RunRow key={run.id} run={run} selected={selRuns.has(run.id)} onToggle={() => toggleRun(run.id)} />
                  ))}
                </>
              )}
            </div>
          )}

          {(selRuns.size > 0 || loadingTx) && (
            <div className="mt-3 flex items-center justify-between bg-slate-50 rounded-xl px-3 py-2">
              {loadingTx ? (
                <span className="text-[11px] text-slate-400 flex items-center gap-1"><Loader2 size={11} className="animate-spin" /> A carregar…</span>
              ) : (
                <>
                  <span className="text-[11px] text-slate-600">{transacoes.length} movimentos de {selRuns.size} extrato(s)</span>
                  <span className="text-[11px] font-bold text-slate-500">{txSaidas} saídas</span>
                </>
              )}
            </div>
          )}
        </div>

        {/* Recibos */}
        <div className="border border-slate-200 rounded-2xl p-4 bg-white">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Coins size={14} className="text-emerald-500" />
              <span className="text-[11px] font-black uppercase tracking-widest text-slate-600">Recibos de Vencimento</span>
            </div>
            {loadingRecibos && <Loader2 size={13} className="animate-spin text-slate-400" />}
          </div>

          {recibos.length === 0 ? (
            <div className="border-2 border-dashed border-slate-200 rounded-xl px-4 py-6 text-center">
              <Calendar size={20} className="text-slate-300 mx-auto mb-1" />
              <p className="text-[11px] text-slate-400">
                {loadingRecibos ? 'A carregar…' : `Sem recibos validados em ${ano}`}
              </p>
            </div>
          ) : (
            <div className="space-y-1 max-h-52 overflow-y-auto pr-1">
              {Object.entries(
                recibos.reduce((acc, r) => {
                  if (!acc[r.worker_name]) acc[r.worker_name] = [];
                  acc[r.worker_name].push(r.mes);
                  return acc;
                }, {})
              ).map(([name, meses]) => (
                <div key={name} className="flex items-center justify-between bg-slate-50 rounded-xl px-3 py-1.5">
                  <span className="text-[11px] text-slate-700 font-medium truncate max-w-[70%]">{name}</span>
                  <span className="text-[10px] text-slate-400 flex-shrink-0">{meses.length} recibo(s)</span>
                </div>
              ))}
            </div>
          )}

          {recibos.length > 0 && (
            <div className="mt-3 flex items-center justify-between bg-slate-50 rounded-xl px-3 py-2">
              <span className="text-[11px] text-slate-600">
                {[...new Set(recibos.map(r => r.worker_name))].length} trabalhadores
              </span>
              <span className="text-[11px] font-bold text-slate-500">{recibos.length} recibos</span>
            </div>
          )}
        </div>
      </div>

      {/* Run button */}
      <div className="flex justify-center">
        <button
          onClick={handleReconciliar}
          disabled={!canRun || processando || loadingTx}
          className="flex items-center gap-2 px-6 py-2.5 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
        >
          {processando ? <Loader2 size={14} className="animate-spin" /> : <TrendingUp size={14} />}
          Reconciliar
        </button>
      </div>

      {/* Results */}
      {resultado && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Trabalhadores', value: resultado.summary.total_employees_processed, color: 'text-slate-700', bg: 'bg-slate-50' },
              { label: 'Match Exato', value: resultado.summary.total_exact_matches, color: 'text-emerald-700', bg: 'bg-emerald-50' },
              { label: 'Saldo Pendente', value: resultado.summary.total_pending_balances, color: 'text-amber-700', bg: 'bg-amber-50' },
            ].map(c => (
              <div key={c.label} className={`${c.bg} rounded-2xl px-4 py-3 text-center`}>
                <p className={`text-2xl font-black ${c.color}`}>{c.value}</p>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-0.5">{c.label}</p>
              </div>
            ))}
          </div>

          <div className="flex justify-end">
            <button
              onClick={handleExportJson}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
            >
              <Download size={12} /> Exportar JSON
            </button>
          </div>

          <div className="space-y-2">
            {resultado.employees.length === 0 ? (
              <div className="text-center py-8 text-[12px] text-slate-400">
                Nenhum trabalhador identificado nas transferências.<br />
                Verifique se os nomes constam nas descrições dos movimentos bancários.
              </div>
            ) : (
              resultado.employees.map(emp => (
                <EmployeeCard key={emp.employee_name} employee={emp} />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function RunRow({ run, selected, onToggle }) {
  return (
    <button
      onClick={onToggle}
      className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-left transition-colors ${selected ? 'bg-indigo-50 ring-1 ring-indigo-200' : 'bg-slate-50 hover:bg-slate-100'}`}
    >
      <div className={`w-3.5 h-3.5 rounded flex-shrink-0 border-2 flex items-center justify-center transition-colors ${selected ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300 bg-white'}`}>
        {selected && <CheckCircle size={9} className="text-white" strokeWidth={3} />}
      </div>
      <FileText size={11} className={selected ? 'text-indigo-500' : 'text-slate-400'} />
      <span className={`text-[11px] font-medium truncate flex-1 ${selected ? 'text-indigo-700' : 'text-slate-600'}`}>
        {run.filename || `Importação ${run.id.slice(0, 8)}`}
      </span>
      <span className="text-[10px] text-slate-400 flex-shrink-0">{run.transaction_count ?? '—'} mov.</span>
      <span className="text-[10px] text-slate-400 flex-shrink-0">{fmtDate(run.created_at)}</span>
    </button>
  );
}
