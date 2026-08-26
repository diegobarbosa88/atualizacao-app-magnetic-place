import React, { useState } from 'react';
import { useApp } from '../../../context/AppContext';
import { useSchedule } from '../contexts/ScheduleContext';
import {
  Trash2, Clock, Users, Search, CalendarRange, CheckCircle2, ChevronRight
} from 'lucide-react';
import { FT, SCALE, FONT_MONO } from '../../../styles/designTokens';
import ModalShell from '../../../components/common/ModalShell';
import SubTabBar from '../../../components/common/SubTabBar';

const SIMPLE_WEEKDAYS = [{ v: 1, l: 'Seg' }, { v: 2, l: 'Ter' }, { v: 3, l: 'Qua' }, { v: 4, l: 'Qui' }, { v: 5, l: 'Sex' }, { v: 6, l: 'Sáb' }, { v: 0, l: 'Dom' }];
const FULL_WEEKDAYS = [{ v: 1, l: 'Segunda-feira' }, { v: 2, l: 'Terça-feira' }, { v: 3, l: 'Quarta-feira' }, { v: 4, l: 'Quinta-feira' }, { v: 5, l: 'Sexta-feira' }, { v: 6, l: 'Sábado' }, { v: 0, l: 'Domingo' }];

function getInitials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  return parts.length === 1
    ? parts[0].slice(0, 2).toUpperCase()
    : (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function CompactTimeField({ label, value, onChange, accent = false }) {
  return (
    <div className="flex items-center gap-1.5 min-w-0">
      <label className={`${SCALE.text.statLabel} w-14 shrink-0 ${accent ? 'text-orange-500' : 'text-[var(--slate-dim)]'}`}>{label}</label>
      <input type="time" value={value} onChange={onChange} className={`flex-1 min-w-0 bg-white border rounded-lg px-2 py-1 text-xs shadow-sm ${accent ? 'border-orange-100' : 'border-[var(--border)]'}`} />
    </div>
  );
}

function SectionDivider({ label, right }) {
  return (
    <div className="flex items-center justify-between gap-2 pt-2">
      <span className={`${SCALE.text.statLabel} text-[var(--slate-dim)]`}>{label}</span>
      {right}
    </div>
  );
}

function ToggleSwitch({ checked, onChange, label }) {
  return (
    <div
      role="switch"
      aria-checked={checked}
      tabIndex={0}
      onClick={() => onChange(!checked)}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onChange(!checked); } }}
      className="flex items-center justify-between gap-3 cursor-pointer p-4 bg-white rounded-2xl border border-[var(--border)] shadow-sm hover:border-[var(--slate)] transition-all"
    >
      <span className="text-xs font-bold text-[var(--ink-mid)]">{label}</span>
      <span className="relative inline-flex items-center h-6 w-11 rounded-full transition-colors shrink-0" style={{ backgroundColor: checked ? 'var(--navy-solid)' : 'var(--border)' }}>
        <span className="inline-block h-4 w-4 rounded-full bg-white shadow transition-transform" style={{ transform: checked ? 'translateX(22px)' : 'translateX(4px)' }} />
      </span>
    </div>
  );
}

export default function ScheduleForm() {
  const { workers } = useApp();
  const {
    scheduleForm, setScheduleForm,
    handleAssignScheduleWithDates,
    // Vêm do contexto para os botões Cancelar/Salvar poderem viver no rodapé
    // fixo do ModalShell, que é irmão do conteúdo e não lhe vê o estado.
    assignmentDates, setAssignmentDates,
  } = useSchedule();

  const supabase = window.supabaseInstance;
  const [activeTab, setActiveTab] = useState('config');
  const [expandedDay, setExpandedDay] = useState(1);
  const [expandedWorkerId, setExpandedWorkerId] = useState(null);
  const [workerSearch, setWorkerSearch] = useState('');
  const [saveSuccessWorkerId, setSaveSuccessWorkerId] = useState(null);
  const [showScheduleHistory, setShowScheduleHistory] = useState({ show: false, workerId: null, workerName: '', scheduleId: null, scheduleName: '', history: [] });

  const handleDeleteScheduleHistory = async (historyId) => {
    if (!supabase) return;
    const { error } = await supabase.from('worker_schedule_history').delete().eq('id', historyId);
    if (!error) {
      setShowScheduleHistory(prev => ({
        ...prev,
        history: prev.history.filter(h => h.id !== historyId)
      }));
    }
  };

  const loadScheduleHistory = async (workerId, workerName, scheduleId, scheduleName) => {
    if (!supabase) return;
    const { data } = await supabase
      .from('worker_schedule_history')
      .select('*')
      .eq('worker_id', workerId)
      .eq('schedule_id', scheduleId)
      .order('created_at', { ascending: false });
    setShowScheduleHistory({ show: true, workerId, workerName, scheduleId, scheduleName, history: data || [] });
  };

  const calculateInlineDuration = (sf) => {
    if (!sf.startTime || !sf.endTime) return 0;
    const toMins = (t) => { if (!t) return 0; const [h, m] = t.split(':'); return parseInt(h) * 60 + parseInt(m); };
    let start = toMins(sf.startTime);
    let end = toMins(sf.endTime);
    if (end < start) end += 24 * 60;
    let breakDuration = 0;
    if (sf.hasBreak || !!sf.breakStart) {
      let bs = toMins(sf.breakStart);
      let be = toMins(sf.breakEnd);
      if (be < bs) be += 24 * 60;
      breakDuration = be - bs;
    }
    return Math.max(0, (end - start - breakDuration) / 60).toFixed(1);
  };

  const toggleWorker = (workerId, checked) => {
    const current = scheduleForm.assignedWorkers || [];
    const updated = checked ? [...current, workerId] : current.filter(id => id !== workerId);
    setScheduleForm({ ...scheduleForm, assignedWorkers: updated });
    if (checked) {
      setAssignmentDates(prev => ({
        ...prev,
        [workerId]: { scheduleId: null, dataInicio: new Date().toISOString().split('T')[0], dataFim: '' }
      }));
    } else if (expandedWorkerId === workerId) {
      setExpandedWorkerId(null);
    }
  };

  const assignedWorkersList = workers.filter(w => scheduleForm.assignedWorkers?.includes(w.id)).sort((a, b) => a.name.localeCompare(b.name));
  // Atribuídos primeiro, depois o resto por ordem alfabética — evita ter de
  // percorrer toda a lista para rever quem já está marcado numa equipa grande.
  const filteredWorkers = [...workers]
    .filter(w => w.name.toLowerCase().includes(workerSearch.toLowerCase()))
    .sort((a, b) => {
      const aAssigned = scheduleForm.assignedWorkers?.includes(a.id);
      const bAssigned = scheduleForm.assignedWorkers?.includes(b.id);
      if (aAssigned !== bAssigned) return aAssigned ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  const expandedWorker = expandedWorkerId ? workers.find(w => w.id === expandedWorkerId) : null;
  const hasBreak = scheduleForm.hasBreak || !!scheduleForm.breakStart;

  return (
    <div className="p-4 sm:p-6">
      {/* Os botões Cancelar/Salvar viviam aqui no topo; passaram para o rodapé
          fixo do ModalShell, em ScheduleManager.jsx. */}
      <SubTabBar
        tabs={[
          { id: 'config', label: 'Configuração', icon: Clock },
          { id: 'assign', label: 'Atribuição', icon: Users, badge: (scheduleForm.assignedWorkers || []).length || undefined, badgeColor: 'slate' },
        ]}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        className="mb-0"
      />

      {activeTab === 'config' ? (
        <div className="space-y-4">
          <div className="space-y-1.5 max-w-xs">
            <label className={`${SCALE.text.statLabel} text-[var(--slate-dim)] ml-1`}>Nome do Turno</label>
            <input type="text" value={scheduleForm.name} onChange={e => setScheduleForm({ ...scheduleForm, name: e.target.value })} className="w-full bg-white border border-[var(--border)] rounded-xl p-3 text-sm font-bold outline-none shadow-sm focus:border-[var(--navy)] focus:ring-4 focus:ring-[#1B3A57]/10 transition-all" placeholder="Ex: Manhã, Tarde..." />
          </div>

          <SectionDivider
            label="Horário"
            right={!scheduleForm.isAdvanced && scheduleForm.startTime && scheduleForm.endTime ? (
              <span className={`px-2.5 py-1 rounded-full ${SCALE.text.badge}`} style={{ backgroundColor: 'var(--navy-soft)', color: 'var(--navy)' }}>
                {calculateInlineDuration(scheduleForm)}h / dia
              </span>
            ) : null}
          />

          <ToggleSwitch
            label="Horários diferentes por dia"
            checked={scheduleForm.isAdvanced || false}
            onChange={checked => {
              const baseHasBreak = scheduleForm.hasBreak || !!scheduleForm.breakStart;
              const dailyConfigs = scheduleForm.dailyConfigs || {
                1: { isActive: true, hasBreak: baseHasBreak, startTime: scheduleForm.startTime || '', breakStart: scheduleForm.breakStart || '', breakEnd: scheduleForm.breakEnd || '', endTime: scheduleForm.endTime || '' },
                2: { isActive: true, hasBreak: baseHasBreak, startTime: scheduleForm.startTime || '', breakStart: scheduleForm.breakStart || '', breakEnd: scheduleForm.breakEnd || '', endTime: scheduleForm.endTime || '' },
                3: { isActive: true, hasBreak: baseHasBreak, startTime: scheduleForm.startTime || '', breakStart: scheduleForm.breakStart || '', breakEnd: scheduleForm.breakEnd || '', endTime: scheduleForm.endTime || '' },
                4: { isActive: true, hasBreak: baseHasBreak, startTime: scheduleForm.startTime || '', breakStart: scheduleForm.breakStart || '', breakEnd: scheduleForm.breakEnd || '', endTime: scheduleForm.endTime || '' },
                5: { isActive: true, hasBreak: baseHasBreak, startTime: scheduleForm.startTime || '', breakStart: scheduleForm.breakStart || '', breakEnd: scheduleForm.breakEnd || '', endTime: scheduleForm.endTime || '' },
                6: { isActive: false, hasBreak: baseHasBreak, startTime: scheduleForm.startTime || '', breakStart: scheduleForm.breakStart || '', breakEnd: scheduleForm.breakEnd || '', endTime: scheduleForm.endTime || '' },
                0: { isActive: false, hasBreak: baseHasBreak, startTime: scheduleForm.startTime || '', breakStart: scheduleForm.breakStart || '', breakEnd: scheduleForm.breakEnd || '', endTime: scheduleForm.endTime || '' },
              };
              setScheduleForm({ ...scheduleForm, isAdvanced: checked, dailyConfigs });
            }}
          />

          {!scheduleForm.isAdvanced ? (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1"><label className={`${SCALE.text.statLabel} text-[var(--slate-dim)] ml-1`}>Entrada</label><input type="time" value={scheduleForm.startTime} onChange={e => setScheduleForm({ ...scheduleForm, startTime: e.target.value })} className="w-full bg-white border border-[var(--border)] rounded-xl p-3 text-sm font-bold shadow-sm" /></div>
                <div className="space-y-1"><label className={`${SCALE.text.statLabel} text-[var(--slate-dim)] ml-1`}>Saída</label><input type="time" value={scheduleForm.endTime} onChange={e => setScheduleForm({ ...scheduleForm, endTime: e.target.value })} className="w-full bg-white border border-[var(--border)] rounded-xl p-3 text-sm font-bold shadow-sm" /></div>
              </div>

              <button type="button" onClick={() => {
                const nextHasBreak = !hasBreak;
                setScheduleForm({ ...scheduleForm, hasBreak: nextHasBreak, breakStart: nextHasBreak ? scheduleForm.breakStart : '', breakEnd: nextHasBreak ? scheduleForm.breakEnd : '' });
              }} className={`w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-dashed transition-colors ${SCALE.text.badge}`} style={{ borderColor: hasBreak ? 'var(--bad)' : 'var(--border)', color: hasBreak ? 'var(--bad)' : 'var(--slate-dim)' }}>
                {hasBreak ? '× Remover pausa de descanso' : '+ Adicionar pausa de descanso'}
              </button>

              {hasBreak && (
                <div className="grid grid-cols-2 gap-4 p-4 bg-orange-50/50 rounded-2xl border border-orange-100">
                  <div className="space-y-1"><label className={`${SCALE.text.statLabel} text-orange-500 ml-1`}>Início</label><input type="time" value={scheduleForm.breakStart} onChange={e => setScheduleForm({ ...scheduleForm, breakStart: e.target.value })} className="w-full bg-white border border-orange-200 rounded-xl p-3 text-sm shadow-sm focus:border-orange-400 focus:ring-orange-50" /></div>
                  <div className="space-y-1"><label className={`${SCALE.text.statLabel} text-orange-500 ml-1`}>Fim</label><input type="time" value={scheduleForm.breakEnd} onChange={e => setScheduleForm({ ...scheduleForm, breakEnd: e.target.value })} className="w-full bg-white border border-orange-200 rounded-xl p-3 text-sm shadow-sm focus:border-orange-400 focus:ring-orange-50" /></div>
                </div>
              )}

              <SectionDivider label="Dias da Semana" />
              <div className="flex flex-wrap gap-2">
                {SIMPLE_WEEKDAYS.map(day => {
                  const isActive = (scheduleForm.weekdays || [1, 2, 3, 4, 5]).includes(day.v);
                  return (
                    <button type="button" key={day.v} onClick={() => {
                      const current = scheduleForm.weekdays || [1, 2, 3, 4, 5];
                      const updated = isActive ? current.filter(d => d !== day.v) : [...current, day.v];
                      setScheduleForm({ ...scheduleForm, weekdays: updated });
                    }} className={`px-4 py-2 rounded-full text-xs font-black transition-all shadow-sm ${isActive ? 'text-white' : 'bg-[var(--surface-dim)] text-[var(--ink-soft)] hover:bg-[var(--border)]'}`} style={isActive ? { backgroundColor: FT.navy } : {}}>
                      {day.l}
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="space-y-2">
              {FULL_WEEKDAYS.map(day => {
                const config = scheduleForm.dailyConfigs?.[day.v] || { isActive: false, hasBreak: false, startTime: '', breakStart: '', breakEnd: '', endTime: '' };
                const isOpen = expandedDay === day.v;
                const dayHasBreak = config.hasBreak || !!config.breakStart;
                return (
                  <div key={day.v} className="rounded-xl border border-[var(--border)] overflow-hidden bg-[var(--surface)]" style={config.isActive ? { borderColor: 'rgba(27,58,87,0.25)' } : {}}>
                    <div
                      className={`w-full flex items-center justify-between gap-2 p-3 ${config.isActive ? 'cursor-pointer' : ''}`}
                      onClick={config.isActive ? () => setExpandedDay(isOpen ? null : day.v) : undefined}
                    >
                      <label className="flex items-center gap-3 min-w-0" onClick={e => e.stopPropagation()}>
                        <input type="checkbox" checked={config.isActive} onChange={e => {
                          setScheduleForm({
                            ...scheduleForm,
                            dailyConfigs: { ...scheduleForm.dailyConfigs, [day.v]: { ...config, isActive: e.target.checked } }
                          });
                        }} className="rounded text-[var(--navy)] w-4 h-4 cursor-pointer shrink-0" />
                        <span className="text-sm font-bold truncate" style={{ color: config.isActive ? FT.navy : '#94A3B8' }}>{day.l}</span>
                      </label>
                      <div className="flex items-center gap-2 shrink-0">
                        {config.isActive && !isOpen && config.startTime && config.endTime && (
                          <span className={SCALE.text.meta} style={{ fontFamily: FONT_MONO, color: 'var(--slate-dim)' }}>{config.startTime} — {config.endTime}</span>
                        )}
                        {config.isActive && <ChevronRight size={14} className="text-[var(--slate)] transition-transform" style={{ transform: isOpen ? 'rotate(90deg)' : 'none' }} />}
                      </div>
                    </div>
                    {isOpen && config.isActive && (
                      <div className="px-3 pb-2.5 space-y-2">
                        {/* Turno (entrada/saída) e pausa são dois grupos distintos —
                            cada um na sua linha/caixa, em vez de 4 campos com o mesmo
                            peso visual espremidos juntos. */}
                        <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
                          <CompactTimeField label="Entrada" value={config.startTime} onChange={e => setScheduleForm({ ...scheduleForm, dailyConfigs: { ...scheduleForm.dailyConfigs, [day.v]: { ...config, startTime: e.target.value } } })} />
                          <CompactTimeField label="Saída" value={config.endTime} onChange={e => setScheduleForm({ ...scheduleForm, dailyConfigs: { ...scheduleForm.dailyConfigs, [day.v]: { ...config, endTime: e.target.value } } })} />
                        </div>
                        {dayHasBreak ? (
                          <div className="flex items-center gap-2 p-2 bg-orange-50/60 rounded-lg border border-orange-100">
                            <div className="flex-1 min-w-0 grid grid-cols-2 gap-x-3 gap-y-1.5">
                              <CompactTimeField label="Pausa I." accent value={config.breakStart} onChange={e => setScheduleForm({ ...scheduleForm, dailyConfigs: { ...scheduleForm.dailyConfigs, [day.v]: { ...config, breakStart: e.target.value } } })} />
                              <CompactTimeField label="Pausa F." accent value={config.breakEnd} onChange={e => setScheduleForm({ ...scheduleForm, dailyConfigs: { ...scheduleForm.dailyConfigs, [day.v]: { ...config, breakEnd: e.target.value } } })} />
                            </div>
                            <button type="button" onClick={() => {
                              setScheduleForm({
                                ...scheduleForm, dailyConfigs: {
                                  ...scheduleForm.dailyConfigs, [day.v]: { ...config, hasBreak: false, breakStart: '', breakEnd: '' }
                                }
                              });
                            }} className="text-orange-400 hover:text-orange-600 shrink-0 leading-none px-1" title="Remover pausa">×</button>
                          </div>
                        ) : (
                          <button type="button" onClick={() => {
                            setScheduleForm({
                              ...scheduleForm, dailyConfigs: {
                                ...scheduleForm.dailyConfigs, [day.v]: { ...config, hasBreak: true }
                              }
                            });
                          }} className="text-[9px] font-semibold text-orange-500 hover:text-orange-600 whitespace-nowrap">
                            + Adicionar Pausa
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-3 text-[var(--slate)]" size={16} />
            <input
              type="text"
              value={workerSearch}
              onChange={e => setWorkerSearch(e.target.value)}
              placeholder="Pesquisar trabalhador..."
              className="w-full bg-white border border-[var(--border)] rounded-xl py-3 pl-10 pr-4 text-sm font-bold outline-none shadow-sm focus:border-[var(--navy)] focus:ring-4 focus:ring-[#1B3A57]/10 transition-all"
            />
          </div>

          {assignedWorkersList.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {assignedWorkersList.map(w => {
                const isOpen = expandedWorkerId === w.id;
                return (
                  <button
                    key={w.id}
                    type="button"
                    onClick={() => setExpandedWorkerId(isOpen ? null : w.id)}
                    className={`flex items-center gap-2 pl-1.5 pr-2.5 py-1.5 rounded-full border transition-all ${SCALE.text.badge}`}
                    style={isOpen ? { backgroundColor: 'var(--navy-soft)', borderColor: 'var(--navy)' } : { backgroundColor: 'white', borderColor: 'var(--border)' }}
                  >
                    <span className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-[10px] font-black" style={{ backgroundColor: FT.navy, color: FT.orange }}>
                      {getInitials(w.name)}
                    </span>
                    <span className="normal-case truncate max-w-[9rem]" style={{ color: 'var(--ink-mid)' }}>{w.name}</span>
                    <span
                      onClick={e => { e.stopPropagation(); toggleWorker(w.id, false); }}
                      className="text-[var(--slate)] hover:text-[var(--bad)] leading-none"
                      title="Remover"
                    >×</span>
                  </button>
                );
              })}
            </div>
          )}

          {expandedWorker && (
            <div className="p-5 bg-white rounded-2xl border border-[var(--border-soft)] shadow-sm space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border-soft)] pb-3">
                <span className="font-black text-base" style={{ color: 'var(--navy)' }}>{expandedWorker.name}</span>
                <div className="flex gap-2">
                  {scheduleForm.id && (
                    <button
                      onClick={() => loadScheduleHistory(expandedWorker.id, expandedWorker.name, scheduleForm.id, scheduleForm.name)}
                      className="text-xs font-bold text-[var(--ink-soft)] hover:text-[var(--ink-soft)] px-2 py-1 bg-[var(--surface)] rounded-lg hover:bg-[var(--surface-dim)] transition-colors flex items-center gap-1"
                      title="Histórico"
                    >📅 <span className="hidden xl:inline">Histórico</span></button>
                  )}
                  <button
                    onClick={async () => {
                      await handleAssignScheduleWithDates(expandedWorker.id, scheduleForm.id || `s${Date.now()}`, assignmentDates[expandedWorker.id]?.dataInicio ?? expandedWorker.assignedScheduleDates?.[scheduleForm.id]?.dataInicio ?? new Date().toISOString().split('T')[0], assignmentDates[expandedWorker.id]?.dataFim ?? expandedWorker.assignedScheduleDates?.[scheduleForm.id]?.dataFim ?? null);
                      setSaveSuccessWorkerId(expandedWorker.id);
                      setTimeout(() => setSaveSuccessWorkerId(null), 3000);
                    }}
                    className={`${saveSuccessWorkerId === expandedWorker.id ? 'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-200' : 'shadow-md'} text-white px-3 py-1.5 rounded-lg ${SCALE.text.badge} transition-all flex items-center gap-1`}
                    style={saveSuccessWorkerId === expandedWorker.id ? {} : { backgroundColor: FT.navy }}
                  >
                    {saveSuccessWorkerId === expandedWorker.id ? <><CheckCircle2 size={12} /> Gravado</> : 'Gravar'}
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className={`${SCALE.text.statLabel} text-[var(--slate-dim)] flex items-center gap-1`}><CalendarRange size={10} /> Data Início</label>
                  <input
                    type="date"
                    value={assignmentDates[expandedWorker.id]?.dataInicio ?? expandedWorker.assignedScheduleDates?.[scheduleForm.id]?.dataInicio ?? ''}
                    onChange={(e) => setAssignmentDates(prev => ({
                      ...prev,
                      [expandedWorker.id]: { ...prev[expandedWorker.id], dataInicio: e.target.value, dataFim: prev[expandedWorker.id]?.dataFim ?? expandedWorker.assignedScheduleDates?.[scheduleForm.id]?.dataFim ?? '' }
                    }))}
                    className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-xl p-3 text-sm font-bold outline-none shadow-sm focus:border-[var(--navy)] focus:ring-4 focus:ring-[#1B3A57]/10 transition-all"
                  />
                </div>
                <div className="space-y-1">
                  <label className={`${SCALE.text.statLabel} text-[var(--slate-dim)] flex items-center gap-1`}><CalendarRange size={10} /> Data Fim</label>
                  <input
                    type="date"
                    value={assignmentDates[expandedWorker.id]?.dataFim ?? expandedWorker.assignedScheduleDates?.[scheduleForm.id]?.dataFim ?? ''}
                    onChange={(e) => setAssignmentDates(prev => ({
                      ...prev,
                      [expandedWorker.id]: { ...prev[expandedWorker.id], dataInicio: prev[expandedWorker.id]?.dataInicio ?? expandedWorker.assignedScheduleDates?.[scheduleForm.id]?.dataInicio ?? new Date().toISOString().split('T')[0], dataFim: e.target.value }
                    }))}
                    className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-xl p-3 text-sm font-bold outline-none shadow-sm focus:border-[var(--navy)] focus:ring-4 focus:ring-[#1B3A57]/10 transition-all"
                  />
                </div>
              </div>
            </div>
          )}

          <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
            {filteredWorkers.map((w, idx) => {
              const isAssigned = scheduleForm.assignedWorkers?.includes(w.id);
              const nextAssigned = idx + 1 < filteredWorkers.length && scheduleForm.assignedWorkers?.includes(filteredWorkers[idx + 1].id);
              // Divisor entre o grupo dos já atribuídos e o resto — só faz
              // sentido quando a lista realmente mistura os dois grupos.
              const showGroupDivider = isAssigned && !nextAssigned && idx < filteredWorkers.length - 1;
              return (
                <React.Fragment key={w.id}>
                  <div className={`flex items-center gap-3 p-3 rounded-xl border shadow-sm transition-all cursor-pointer ${isAssigned ? '' : 'bg-white border-[var(--border-soft)] hover:border-[var(--slate)]'}`} style={isAssigned ? { backgroundColor: 'rgba(27,58,87,0.04)', borderColor: 'rgba(27,58,87,0.2)' } : {}}>
                    <input type="checkbox" checked={isAssigned} onChange={(e) => toggleWorker(w.id, e.target.checked)} className="rounded text-[var(--navy)] w-5 h-5 focus:ring-[var(--navy)] cursor-pointer" />
                    <span className="text-sm font-bold flex-1" style={{ color: isAssigned ? FT.navy : '#334155' }}>{w.name}</span>
                  </div>
                  {showGroupDivider && <div className="border-t border-[var(--border-soft)] my-1" />}
                </React.Fragment>
              );
            })}
          </div>
        </div>
      )}

      {/* Modal de Histórico de Atribuição */}
      {showScheduleHistory.show && (
        <ModalShell
          isOpen
          onClose={() => setShowScheduleHistory({ show: false, workerId: null, workerName: '', scheduleId: null, scheduleName: '', history: [] })}
          title={`Histórico: ${showScheduleHistory.scheduleName}`}
          meta={showScheduleHistory.workerName}
          size="md"
          layer="nested"
        >
          <div className="p-6">
            {showScheduleHistory.history.length === 0 ? (
              <p className="text-sm text-[var(--slate-dim)] text-center py-4">Sem períodos registados</p>
            ) : (
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {showScheduleHistory.history.map(h => (
                  <div key={h.id} className="flex justify-between items-center p-3 bg-[var(--surface)] rounded-xl group">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-[var(--ink-soft)]">{h.data_inicio}</span>
                      <span className="text-[var(--slate)]">→</span>
                      <span className="text-sm font-bold" style={{ color: 'var(--navy)' }}>{h.data_fim || 'Atual'}</span>
                    </div>
                    <button
                      onClick={() => handleDeleteScheduleHistory(h.id)}
                      className="text-[var(--slate)] hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity p-1"
                      title="Apagar registo"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </ModalShell>
      )}
    </div>
  );
}
