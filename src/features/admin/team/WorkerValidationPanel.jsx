import React, { useState, useMemo } from 'react';
import {
  CheckCircle, UserCheck, RotateCcw, Search,
  Calendar, ChevronLeft, ChevronRight, LayoutList, LayoutGrid,
  ClipboardList, Pencil, MapPin, Trash2
} from 'lucide-react';
import ModalShell from '../../../components/common/ModalShell';
import { useApp } from '../../../context/AppContext';
import { calculateDuration, formatHours } from '../../../utils/formatUtils';
import { toISODateLocal } from '../../../utils/dateUtils';
import { impersonarTrabalhador } from '../../../utils/impersonateWorker';
import { FT, SCALE } from '../../../styles/designTokens';

const SOURCE_CFG = {
  gps_auto:     { label: 'GPS',        bg: 'bg-emerald-100', text: 'text-emerald-700' },
  quick_worker: { label: 'Card',       bg: 'bg-cyan-100',    text: 'text-cyan-700' },
  manual_admin: { label: 'Admin',      bg: 'bg-indigo-100',  text: 'text-indigo-700' },
  manual_worker:{ label: 'Manual',     bg: 'bg-blue-100',    text: 'text-blue-700' },
  batch:        { label: 'Lote',       bg: 'bg-amber-100',   text: 'text-amber-700' },
  request:      { label: 'Pedido',     bg: 'bg-[var(--surface-dim)]',   text: 'text-[var(--slate)]' },
  correction:   { label: 'Correcção',  bg: 'bg-orange-100',  text: 'text-orange-700' },
  client_portal:{ label: 'Portal',     bg: 'bg-teal-100',    text: 'text-teal-700' },
};

const getInitials = (name) => {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  return parts.length === 1 ? parts[0][0].toUpperCase() : (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

function WorkerLogsModal({ worker, logs, month, onClose }) {
  const monthStr = toISODateLocal(month).substring(0, 7);
  const { clients, handleDelete } = useApp();
  const [deleting, setDeleting] = useState(null);

  const workerLogs = useMemo(() =>
    logs
      .filter(l => String(l.workerId) === String(worker.id) && l.date?.startsWith(monthStr))
      .sort((a, b) => (a.date > b.date ? 1 : -1)),
    [logs, worker.id, monthStr]
  );

  const grouped = useMemo(() => {
    return workerLogs.reduce((acc, log) => {
      (acc[log.date] = acc[log.date] || []).push(log);
      return acc;
    }, {});
  }, [workerLogs]);

  const totalHours = workerLogs.reduce((s, l) => s + (l.hours ?? calculateDuration(l.startTime, l.endTime, l.breakStart, l.breakEnd)), 0);

  return (
    <ModalShell
      isOpen
      onClose={onClose}
      title={worker.name}
      meta={`${month.toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' })} · ${formatHours(totalHours)} total`}
      size="2xl"
      closeOnOverlay={false}
    >
      <>
        {/* Legend */}
        <div className="px-6 pt-4 flex flex-wrap gap-1.5">
          {Object.entries(SOURCE_CFG).map(([key, cfg]) => (
            <span key={key} className={`inline-flex items-center px-2 py-0.5 rounded-lg ${SCALE.text.badge} ${cfg.bg} ${cfg.text}`}>
              {cfg.label}
            </span>
          ))}
          <span className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-lg bg-[var(--surface-dim)] text-[var(--ink-soft)] ${SCALE.text.badge}`}>
            <Pencil size={8} /> Editado
          </span>
        </div>

        {/* Logs */}
        <div className="px-6 py-4 space-y-3 max-h-[60vh] overflow-y-auto">
          {workerLogs.length === 0 ? (
            <p className="text-center text-[var(--slate-dim)] py-8 text-sm">Sem registos neste mês.</p>
          ) : (
            Object.entries(grouped).map(([date, dayLogs]) => {
              const [y, m, d] = date.split('-');
              return (
                <div key={date}>
                  <p className={`${SCALE.text.statLabel} text-[var(--slate-dim)] mb-1.5`}>
                    {d}/{m}/{y}
                  </p>
                  <div className="space-y-1.5">
                    {dayLogs.map(log => {
                      const client = clients?.find(c => c.id === log.clientId);
                      const srcCfg = SOURCE_CFG[log.source];
                      const hours = log.hours ?? calculateDuration(log.startTime, log.endTime, log.breakStart, log.breakEnd);
                      return (
                        <div key={log.id} className="flex items-center justify-between bg-[var(--surface)] rounded-2xl px-4 py-3 gap-3">
                          <div className="flex items-center gap-2 flex-wrap min-w-0">
                            {client && (
                              <span className={`${SCALE.text.badge} bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-lg border border-indigo-100 shrink-0`}>
                                {client.name}
                              </span>
                            )}
                            <span className="text-sm font-bold font-mono text-[var(--ink-mid)] shrink-0">
                              {log.startTime ?? '--:--'} – {log.endTime ?? '--:--'}
                              {log.breakStart ? <span className="text-[var(--slate-dim)] text-xs ml-1">(P: {log.breakStart})</span> : null}
                            </span>
                            {/* Source badge */}
                            {srcCfg && (
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-lg shrink-0 ${SCALE.text.badge} ${srcCfg.bg} ${srcCfg.text}`}>
                                {srcCfg.label}
                              </span>
                            )}
                            {!srcCfg && !log.source && (
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-lg shrink-0 bg-[var(--surface-dim)] text-[var(--ink-soft)] ${SCALE.text.badge}`}>
                                Desconhecido
                              </span>
                            )}
                            {/* Edited badge */}
                            {log.edited_at && (
                              <span className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-lg shrink-0 bg-[var(--surface-dim)] text-[var(--ink-soft)] ${SCALE.text.badge}`}>
                                <Pencil size={8} />
                                Editado
                                {SOURCE_CFG[log.edited_source] && (
                                  <span className="ml-0.5 normal-case font-normal">
                                    ({SOURCE_CFG[log.edited_source].label})
                                  </span>
                                )}
                              </span>
                            )}
                            {/* GPS verified indicator */}
                            {log.geo_verified && (
                              <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-lg shrink-0 bg-emerald-50 text-emerald-600 ${SCALE.text.badge}`}>
                                <MapPin size={7} /> Verificado
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-base font-black text-[var(--ink-mid)]">{formatHours(hours)}</span>
                            {deleting === log.id ? (
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={async () => { await handleDelete('logs', log.id); setDeleting(null); }}
                                  className={`px-2 py-1 bg-rose-500 text-white rounded-lg ${SCALE.text.badge}`}
                                >
                                  Confirmar
                                </button>
                                <button
                                  onClick={() => setDeleting(null)}
                                  className={`px-2 py-1 bg-[var(--border)] text-[var(--ink-soft)] rounded-lg ${SCALE.text.badge}`}
                                >
                                  Cancelar
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setDeleting(log.id)}
                                className="p-1.5 text-[var(--slate)] hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
                                title="Eliminar registo"
                              >
                                <Trash2 size={13} />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </>
    </ModalShell>
  );
}

export default function WorkerValidationPanel({ onLogin }) {
  const { workers, logs, approvals, saveToDb, handleDelete } = useApp();
  const [month, setMonth] = useState(new Date());
  const [view, setView] = useState(window.innerWidth < 768 ? 'grid' : 'list');
  const [sort] = useState({ key: 'name', direction: 'asc' });
  const [logsModalWorker, setLogsModalWorker] = useState(null);

  const monthStr = toISODateLocal(month).substring(0, 7);

  const verPortal = async (w) => {
    try {
      const { user, token } = await impersonarTrabalhador(w);
      onLogin('worker', { ...user, isAdminImpersonating: true }, token);
    } catch (e) {
      alert(e.message);
    }
  };

  const sortedWorkers = useMemo(() => {
    return [...workers].map(w => {
      const totalHours = logs
        .filter(l => l.workerId === w.id && l.date?.substring(0, 7) === monthStr)
        .reduce((acc, l) => acc + (l.hours ?? calculateDuration(l.startTime, l.endTime, l.breakStart, l.breakEnd)), 0);
      const approval = approvals.find(a => a.workerId === w.id && a.month === monthStr);
      return { ...w, totalHours, isApproved: !!approval, approval };
    }).sort((a, b) => {
      let res = 0;
      if (sort.key === 'name') res = a.name.localeCompare(b.name);
      if (sort.key === 'hours') res = a.totalHours - b.totalHours;
      if (sort.key === 'status') res = (a.isApproved ? 1 : 0) - (b.isApproved ? 1 : 0);
      return sort.direction === 'asc' ? res : -res;
    });
  }, [workers, logs, monthStr, approvals, sort]);

  const pendingCount = sortedWorkers.filter(w => !w.isApproved).length;
  const approvedCount = sortedWorkers.filter(w => w.isApproved).length;

  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5 bg-white p-1.5 rounded-xl shadow-sm border border-[var(--border-soft)]">
            <button onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} className="p-1.5 hover:bg-[var(--surface)] rounded-lg transition-all text-[var(--slate)]"><ChevronLeft size={15} /></button>
            <div className="flex items-center gap-1.5 px-2 border-x border-[var(--border-soft)]">
              <Calendar size={13} style={{ color: FT.navy }} />
              <span className="text-xs font-black uppercase text-[var(--ink-mid)]">{month.toLocaleDateString('pt-PT', { month: 'short', year: 'numeric' })}</span>
            </div>
            <button onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} className="p-1.5 hover:bg-[var(--surface)] rounded-lg transition-all text-[var(--slate)]"><ChevronRight size={15} /></button>
          </div>
          {/* Contadores de resumo — elemento novo, não existia no original.
              #8a4a00/warnBg e #1f6b47/okBg, não warn/warnBg nem ok/okBg como
              a spec propunha: medido, warn/warnBg dá 2,44:1 (falha AA
              catastroficamente) e ok/okBg dá 4,42:1 (abaixo do limiar para
              texto pequeno). Ver nota em CLAUDE.md. */}
          <span className={`px-2.5 py-1 rounded-full ${SCALE.text.badge}`} style={{ background: FT.warnBg, color: '#8a4a00' }}>{pendingCount} pendente{pendingCount !== 1 ? 's' : ''}</span>
          <span className={`px-2.5 py-1 rounded-full ${SCALE.text.badge}`} style={{ background: FT.okBg, color: '#1f6b47' }}>{approvedCount} aprovado{approvedCount !== 1 ? 's' : ''}</span>
        </div>
        <div className="flex items-center gap-1 bg-[var(--surface-dim)] p-1 rounded-2xl shrink-0">
          <button onClick={() => setView('list')} className="p-1.5 rounded-xl transition-all" style={view === 'list' ? { background: '#fff', color: FT.navy, boxShadow: '0 1px 2px rgba(0,0,0,0.08)' } : { color: 'var(--slate)' }}><LayoutList size={14} /></button>
          <button onClick={() => setView('grid')} className="p-1.5 rounded-xl transition-all" style={view === 'grid' ? { background: '#fff', color: FT.navy, boxShadow: '0 1px 2px rgba(0,0,0,0.08)' } : { color: 'var(--slate)' }}><LayoutGrid size={14} /></button>
        </div>
      </div>

      {view === 'list' && (
        <div className="bg-white rounded-2xl border border-[var(--border-soft)] shadow-sm overflow-x-auto animate-in fade-in slide-in-from-bottom-2 duration-300">
          <table className="w-full text-sm min-w-[500px]">
            <thead><tr className="border-b border-[var(--border-soft)] bg-[var(--surface)]">
              <th className={`text-left px-4 py-3 ${SCALE.text.statLabel} text-[var(--slate-dim)]`}>Colaborador</th>
              <th className={`text-right px-4 py-3 ${SCALE.text.statLabel} text-[var(--slate-dim)]`}>Horas</th>
              <th className={`text-center px-4 py-3 ${SCALE.text.statLabel} text-[var(--slate-dim)]`}>Estado</th>
              <th className={`text-right px-4 py-3 ${SCALE.text.statLabel} text-[var(--slate-dim)]`}>Ações</th>
            </tr></thead>
            <tbody>
              {sortedWorkers.map(w => (
                <tr key={w.id} className="border-b border-[var(--border-soft)] hover:bg-[var(--surface)] transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-[26px] h-[26px] rounded-full flex items-center justify-center shrink-0 text-white text-[10px] font-black" style={{ background: FT.slateDim }}>
                        {getInitials(w.name)}
                      </div>
                      <span className="font-bold text-[var(--ink)] truncate">{w.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right font-black tabular-nums" style={{ color: w.totalHours > 0 ? FT.navy : 'var(--slate-dim)' }}>{formatHours(w.totalHours)}</td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full ${SCALE.text.badge}`}
                      style={w.isApproved ? { background: FT.okBg, color: '#1f6b47' } : { background: FT.warnBg, color: '#8a4a00' }}
                    >
                      {w.isApproved && <CheckCircle size={9} />}
                      {w.isApproved ? 'aprovado' : 'pendente'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => setLogsModalWorker(w)} className="p-1.5 text-[var(--slate)] hover:bg-[var(--surface-dim)] hover:text-[var(--ink-mid)] rounded-lg transition-all" title="Ver Registos"><ClipboardList size={13} /></button>
                      <button onClick={() => verPortal(w)} className="p-1.5 rounded-lg transition-all hover:bg-[var(--surface-dim)]" style={{ color: FT.navy }} title="Ver Portal"><Search size={13} /></button>
                      {!w.isApproved ? (
                        <button onClick={async () => { const id = "appr_" + w.id + "_" + monthStr; try { await saveToDb('approvals', id, { id, workerId: w.id, month: monthStr, timestamp: new Date().toISOString() }); } catch (err) { alert('Erro: ' + err?.message); } }} className="p-1.5 text-emerald-500 hover:bg-emerald-50 rounded-lg transition-all" title="Aprovar"><UserCheck size={13} /></button>
                      ) : (
                        <button onClick={async () => { try { await handleDelete('approvals', w.approval.id); } catch (err) { alert('Erro: ' + err?.message); } }} className="p-1.5 text-rose-400 hover:bg-rose-50 rounded-lg transition-all" title="Anular"><RotateCcw size={13} /></button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {view === 'grid' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
          {sortedWorkers.map(w => (
            <div key={w.id} className={`bg-white p-5 ${SCALE.radius.card} border border-[var(--border-soft)] shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200`}>
              <div className="flex justify-between items-start mb-3">
                <span
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full ${SCALE.text.badge}`}
                  style={w.isApproved ? { background: FT.okBg, color: '#1f6b47' } : { background: FT.warnBg, color: '#8a4a00' }}
                >
                  {w.isApproved && <CheckCircle size={10} />}
                  {w.isApproved ? 'aprovado' : 'pendente'}
                </span>
                <span className="text-lg font-black tabular-nums" style={{ color: w.totalHours > 0 ? FT.navy : 'var(--slate-dim)' }}>{formatHours(w.totalHours)}</span>
              </div>
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-[26px] h-[26px] rounded-full flex items-center justify-center shrink-0 text-white text-[10px] font-black" style={{ background: FT.slateDim }}>
                  {getInitials(w.name)}
                </div>
                <h4 className="font-black text-[var(--ink)] text-sm truncate">{w.name}</h4>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setLogsModalWorker(w)} className={`flex-1 flex flex-col items-center justify-center gap-1 py-2.5 text-[var(--ink-soft)] hover:bg-[var(--surface-dim)] rounded-xl transition-all border border-[var(--border)] ${SCALE.text.badge}`} title="Ver Registos">
                  <ClipboardList size={14} /> Registos
                </button>
                <button onClick={() => verPortal(w)} className={`flex-1 flex flex-col items-center justify-center gap-1 py-2.5 rounded-xl transition-all hover:bg-[var(--surface-dim)] ${SCALE.text.badge}`} style={{ color: FT.navy }} title="Ver Portal">
                  <Search size={14} /> Portal
                </button>
                {!w.isApproved ? (
                  <button onClick={async () => { const id = "appr_" + w.id + "_" + monthStr; try { await saveToDb('approvals', id, { id, workerId: w.id, month: monthStr, timestamp: new Date().toISOString() }); } catch (err) { alert('Erro ao aprovar: ' + (err?.message || err)); } }} className={`flex-1 flex flex-col items-center justify-center gap-1 py-2.5 rounded-xl transition-all border ${SCALE.text.badge}`} style={{ background: FT.okBg, color: '#1f6b47', borderColor: 'transparent' }}>
                    <UserCheck size={14} /> Aprovar
                  </button>
                ) : (
                  <button onClick={async () => { try { await handleDelete('approvals', w.approval.id); } catch (err) { alert('Erro ao anular: ' + (err?.message || err)); } }} className={`flex-1 flex flex-col items-center justify-center gap-1 py-2.5 text-rose-500 hover:bg-rose-50 rounded-xl transition-all border border-rose-100 ${SCALE.text.badge}`}>
                    <RotateCcw size={14} /> Anular
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {logsModalWorker && (
        <WorkerLogsModal
          worker={logsModalWorker}
          logs={logs}
          month={month}
          onClose={() => setLogsModalWorker(null)}
        />
      )}
    </div>
  );
}
