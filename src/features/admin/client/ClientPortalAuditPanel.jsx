import React, { useState, useEffect, useMemo } from 'react';
import { Shield, ChevronDown, ChevronRight, Filter } from 'lucide-react';
import { useApp } from '../../../context/AppContext';

const ACTION_LABELS = {
  log_criado: { label: 'Registo Criado', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  log_editado: { label: 'Registo Editado', color: 'bg-amber-100 text-amber-700 border-amber-200' },
  log_eliminado: { label: 'Registo Eliminado', color: 'bg-rose-100 text-rose-700 border-rose-200' },
  pedido_aprovado: { label: 'Pedido Aprovado', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  pedido_rejeitado: { label: 'Pedido Rejeitado', color: 'bg-orange-100 text-orange-700 border-orange-200' },
};

function formatDateTime(isoStr) {
  if (!isoStr) return '—';
  return new Date(isoStr).toLocaleString('pt-PT', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function TimeSnap({ data, label }) {
  if (!data) return <span className="text-slate-300 text-xs">—</span>;
  return (
    <div className="text-xs text-slate-600">
      <span className="font-bold text-[9px] uppercase tracking-widest text-slate-400 mr-1">{label}</span>
      {data.startTime && <span className="font-mono">{data.startTime}→{data.endTime || '…'}</span>}
      {data.breakStart && <span className="text-slate-400 text-[10px] ml-1">(⏸{data.breakStart}–{data.breakEnd || '…'})</span>}
      {data.hours !== undefined && <span className="text-slate-500 ml-1 text-[10px]">{Number(data.hours).toFixed(2)}h</span>}
    </div>
  );
}

function AuditRow({ entry }) {
  const [expanded, setExpanded] = useState(false);
  const meta = ACTION_LABELS[entry.action] || { label: entry.action, color: 'bg-slate-100 text-slate-600 border-slate-200' };
  const dateLabel = entry.date
    ? new Date(entry.date + 'T00:00:00').toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: '2-digit' })
    : null;

  return (
    <div className="border-b border-slate-50 last:border-0">
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors text-left"
      >
        {expanded ? <ChevronDown size={13} className="text-slate-400 shrink-0" /> : <ChevronRight size={13} className="text-slate-400 shrink-0" />}
        <span className="text-[10px] font-bold text-slate-400 w-28 shrink-0">{formatDateTime(entry.created_at)}</span>
        <span className="font-black text-slate-700 text-xs w-32 shrink-0 truncate">{entry.client_name || entry.client_id}</span>
        <span className="text-xs text-slate-500 flex-1 min-w-0 truncate">{entry.worker_name || '—'}</span>
        {dateLabel && <span className="text-[10px] text-slate-400 shrink-0">{dateLabel}</span>}
        <span className={`text-[10px] font-black px-2 py-0.5 rounded-lg border shrink-0 ${meta.color}`}>{meta.label}</span>
      </button>
      {expanded && (
        <div className="px-10 pb-3 space-y-1.5">
          {entry.note && <p className="text-xs text-slate-500 italic border-l-2 border-slate-200 pl-2">{entry.note}</p>}
          <div className="flex gap-6">
            <TimeSnap data={entry.before_data} label="Antes" />
            {entry.after_data && <TimeSnap data={entry.after_data} label="Depois" />}
          </div>
          {entry.log_id && <p className="text-[10px] text-slate-300 font-mono">log: {entry.log_id}</p>}
        </div>
      )}
    </div>
  );
}

export default function ClientPortalAuditPanel() {
  const { supabase, clients } = useApp();
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [filterClient, setFilterClient] = useState('');
  const [filterAction, setFilterAction] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const loadEntries = async () => {
    if (!supabase) return;
    setLoading(true);
    setLoadError(null);
    const { data, error } = await supabase
      .from('client_portal_audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500);
    if (error) {
      setLoadError(error.message);
    } else {
      setEntries(data || []);
    }
    setLoading(false);
  };

  useEffect(() => { loadEntries(); }, [supabase]);

  const filtered = useMemo(() => {
    return entries.filter(e => {
      if (filterClient && String(e.client_id) !== String(filterClient)) return false;
      if (filterAction && e.action !== filterAction) return false;
      if (filterDateFrom && e.created_at < filterDateFrom) return false;
      if (filterDateTo && e.created_at > filterDateTo + 'T23:59:59') return false;
      return true;
    });
  }, [entries, filterClient, filterAction, filterDateFrom, filterDateTo]);

  const hasFilters = filterClient || filterAction || filterDateFrom || filterDateTo;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-violet-50 flex items-center justify-center">
            <Shield size={16} className="text-violet-600" />
          </div>
          <div>
            <h3 className="font-black text-slate-800 text-base uppercase tracking-tight">Auditoria Portal do Cliente</h3>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{filtered.length} registo{filtered.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFilters(s => !s)}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all ${showFilters || hasFilters ? 'bg-violet-600 text-white' : 'bg-slate-50 text-slate-500 hover:text-violet-600'}`}
          >
            <Filter size={13} /> Filtros {hasFilters && `(${[filterClient, filterAction, filterDateFrom, filterDateTo].filter(Boolean).length})`}
          </button>
          <button onClick={loadEntries} className="px-3 py-2 bg-slate-50 text-slate-500 hover:text-slate-800 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all">
            ↻ Atualizar
          </button>
        </div>
      </div>

      {showFilters && (
        <div className="bg-violet-50 border border-violet-100 rounded-2xl p-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <label className="text-[9px] font-black uppercase tracking-widest text-violet-500 mb-1 block">Cliente</label>
            <select
              value={filterClient}
              onChange={e => setFilterClient(e.target.value)}
              className="w-full px-2 py-1.5 text-xs border border-violet-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-violet-300"
            >
              <option value="">Todos</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[9px] font-black uppercase tracking-widest text-violet-500 mb-1 block">Ação</label>
            <select
              value={filterAction}
              onChange={e => setFilterAction(e.target.value)}
              className="w-full px-2 py-1.5 text-xs border border-violet-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-violet-300"
            >
              <option value="">Todas</option>
              {Object.entries(ACTION_LABELS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[9px] font-black uppercase tracking-widest text-violet-500 mb-1 block">De</label>
            <input
              type="date"
              value={filterDateFrom}
              onChange={e => setFilterDateFrom(e.target.value)}
              className="w-full px-2 py-1.5 text-xs border border-violet-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-violet-300"
            />
          </div>
          <div>
            <label className="text-[9px] font-black uppercase tracking-widest text-violet-500 mb-1 block">Até</label>
            <input
              type="date"
              value={filterDateTo}
              onChange={e => setFilterDateTo(e.target.value)}
              className="w-full px-2 py-1.5 text-xs border border-violet-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-violet-300"
            />
          </div>
          {hasFilters && (
            <button
              onClick={() => { setFilterClient(''); setFilterAction(''); setFilterDateFrom(''); setFilterDateTo(''); }}
              className="col-span-2 sm:col-span-4 text-[10px] font-black uppercase tracking-widest text-violet-500 hover:text-violet-700 transition-colors"
            >
              Limpar filtros
            </button>
          )}
        </div>
      )}

      {loadError ? (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-6 text-center space-y-2">
          <p className="font-black text-rose-700 text-sm uppercase tracking-widest">Erro ao carregar auditoria</p>
          <p className="text-xs text-rose-500 font-mono">{loadError}</p>
          <p className="text-xs text-rose-400">Execute a migration <code className="bg-rose-100 px-1 rounded">20260710_client_portal_audit.sql</code> no Supabase.</p>
          <button onClick={loadEntries} className="mt-2 px-4 py-2 bg-rose-600 text-white font-black text-xs rounded-xl hover:bg-rose-700 transition-all">
            Tentar novamente
          </button>
        </div>
      ) : loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-4 border-violet-200 border-t-violet-600 rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center">
          <Shield size={24} className="mx-auto text-slate-200 mb-3" />
          <p className="font-black text-slate-300 text-sm uppercase tracking-widest">Sem registos de auditoria</p>
          <p className="text-xs text-slate-200 mt-1">As ações dos clientes no portal aparecem aqui</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
          {/* Header da tabela */}
          <div className="flex items-center gap-3 px-4 py-2.5 border-b border-slate-100 bg-slate-50">
            <span className="w-4 shrink-0" />
            <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 w-28 shrink-0">Data/Hora</span>
            <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 w-32 shrink-0">Cliente</span>
            <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 flex-1">Colaborador</span>
            <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Data Reg.</span>
            <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Ação</span>
          </div>
          {filtered.map(e => <AuditRow key={e.id} entry={e} />)}
        </div>
      )}
    </div>
  );
}
