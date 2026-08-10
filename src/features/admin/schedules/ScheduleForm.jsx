import React, { useState } from 'react';
import { useApp } from '../../../context/AppContext';
import { useSchedule } from '../contexts/ScheduleContext';
import {
  Timer, Edit2, Trash2, Coffee, Clock, Users, Search, Save, CalendarRange, ArrowRight, CheckCircle2
} from 'lucide-react';

export default function ScheduleForm() {
  const { workers } = useApp();
  const {
    scheduleForm, setScheduleForm,
    handleSaveSchedule,
    handleAssignScheduleWithDates,
    setIsAddingInTab,
  } = useSchedule();

  const supabase = window.supabaseInstance;

  const [assignmentDates, setAssignmentDates] = useState({});
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

  return (
    <div className="p-4 sm:p-6">
      {/* Botões de ação */}
      <div className="flex gap-3 mb-6">
        <button onClick={() => setIsAddingInTab(false)} className="flex-1 md:flex-none px-6 py-3 text-slate-400 font-bold uppercase text-xs hover:bg-slate-50 rounded-2xl transition-all">CANCELAR</button>
        <button onClick={() => handleSaveSchedule(assignmentDates)} className="flex-1 md:flex-none px-8 py-3 rounded-2xl font-black text-xs uppercase shadow-lg hover:scale-105 transition-all flex items-center justify-center gap-2" style={{ backgroundColor: '#EB8D00', color: '#1B3A57' }}>
          <Save size={16} /> Salvar Horário
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* COLUNA 1: Configuração do Horário */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100 space-y-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-xl" style={{ backgroundColor: 'rgba(134,154,175,0.15)', color: '#869AAF' }}><Clock size={18} /></div>
              <h4 className="font-black text-slate-700 text-lg uppercase tracking-tight">Configuração</h4>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Nome do Turno</label>
              <input type="text" value={scheduleForm.name} onChange={e => setScheduleForm({ ...scheduleForm, name: e.target.value })} className="w-full bg-white border border-slate-200 rounded-2xl p-4 text-sm font-bold outline-none shadow-sm focus:border-[#1B3A57] focus:ring-4 focus:ring-[#1B3A57]/10 transition-all" placeholder="Ex: Manhã, Tarde..." />
            </div>

            <label className="flex items-center gap-3 cursor-pointer p-4 bg-white rounded-2xl border border-slate-200 shadow-sm hover:border-[#869AAF] transition-all">
              <input type="checkbox" checked={scheduleForm.isAdvanced || false} onChange={e => {
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
                setScheduleForm({ ...scheduleForm, isAdvanced: e.target.checked, dailyConfigs });
              }} className="w-5 h-5 rounded text-[#1B3A57] focus:ring-[#1B3A57]" />
              <span className="text-xs font-bold text-slate-700">Horários diferentes por dia</span>
            </label>

            {!scheduleForm.isAdvanced ? (
              <>
                {scheduleForm.startTime && scheduleForm.endTime && (
                  <div className="bg-slate-900 rounded-[2rem] p-6 text-white shadow-lg relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10"><Timer size={64} /></div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Resumo do Turno</p>
                    <div className="flex items-center gap-3 text-2xl font-black mb-4">
                      <span>{scheduleForm.startTime}</span>
                      <ArrowRight size={20} className="text-slate-500" />
                      <span>{scheduleForm.endTime}</span>
                    </div>
                    {(scheduleForm.hasBreak || !!scheduleForm.breakStart) && (
                      <div className="flex items-center gap-2 text-xs font-bold text-orange-400 bg-orange-400/10 w-fit px-3 py-1.5 rounded-xl mb-4">
                        <Coffee size={14} /> Pausa: {scheduleForm.breakStart} - {scheduleForm.breakEnd}
                      </div>
                    )}
                    <div className="text-sm font-bold text-slate-300">
                      Total: <span className="text-white text-lg">{calculateInlineDuration(scheduleForm)}h</span> / dia
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase ml-1">Entrada</label><input type="time" value={scheduleForm.startTime} onChange={e => setScheduleForm({ ...scheduleForm, startTime: e.target.value })} className="w-full bg-white border border-slate-200 rounded-xl p-3 text-sm font-bold shadow-sm" /></div>
                  <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase ml-1">Saída</label><input type="time" value={scheduleForm.endTime} onChange={e => setScheduleForm({ ...scheduleForm, endTime: e.target.value })} className="w-full bg-white border border-slate-200 rounded-xl p-3 text-sm font-bold shadow-sm" /></div>
                </div>

                <div className="flex justify-between items-center pt-2">
                  <span className="text-[10px] font-black text-slate-400 uppercase ml-1">Pausa de Descanso</span>
                  <button type="button" onClick={() => {
                    const nextHasBreak = !(scheduleForm.hasBreak || !!scheduleForm.breakStart);
                    setScheduleForm({ ...scheduleForm, hasBreak: nextHasBreak, breakStart: nextHasBreak ? scheduleForm.breakStart : '', breakEnd: nextHasBreak ? scheduleForm.breakEnd : '' });
                  }} className="text-[10px] font-black uppercase text-[#869AAF] bg-slate-100 px-3 py-1.5 rounded-xl hover:bg-slate-200 transition-colors">
                    {(scheduleForm.hasBreak || !!scheduleForm.breakStart) ? 'Remover Pausa' : '+ Adicionar'}
                  </button>
                </div>

                {(scheduleForm.hasBreak || !!scheduleForm.breakStart) && (
                  <div className="grid grid-cols-2 gap-4 p-4 bg-orange-50/50 rounded-2xl border border-orange-100">
                    <div className="space-y-1"><label className="text-[9px] font-black text-orange-500 uppercase ml-1">Início</label><input type="time" value={scheduleForm.breakStart} onChange={e => setScheduleForm({ ...scheduleForm, breakStart: e.target.value })} className="w-full bg-white border border-orange-200 rounded-xl p-3 text-sm shadow-sm focus:border-orange-400 focus:ring-orange-50" /></div>
                    <div className="space-y-1"><label className="text-[9px] font-black text-orange-500 uppercase ml-1">Fim</label><input type="time" value={scheduleForm.breakEnd} onChange={e => setScheduleForm({ ...scheduleForm, breakEnd: e.target.value })} className="w-full bg-white border border-orange-200 rounded-xl p-3 text-sm shadow-sm focus:border-orange-400 focus:ring-orange-50" /></div>
                  </div>
                )}

                <div className="space-y-3 pt-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Dias da Semana</label>
                  <div className="flex flex-wrap gap-2">
                    {[{ v: 1, l: 'Seg' }, { v: 2, l: 'Ter' }, { v: 3, l: 'Qua' }, { v: 4, l: 'Qui' }, { v: 5, l: 'Sex' }, { v: 6, l: 'Sáb' }, { v: 0, l: 'Dom' }].map(day => {
                      const isActive = (scheduleForm.weekdays || [1, 2, 3, 4, 5]).includes(day.v);
                      return (
                        <button type="button" key={day.v} onClick={() => {
                          const current = scheduleForm.weekdays || [1, 2, 3, 4, 5];
                          const updated = isActive ? current.filter(d => d !== day.v) : [...current, day.v];
                          setScheduleForm({ ...scheduleForm, weekdays: updated });
                        }} className={`px-4 py-2 rounded-full text-xs font-black transition-all shadow-sm ${isActive ? 'text-white' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`} style={isActive ? { backgroundColor: '#1B3A57' } : {}}>
                          {day.l}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </>
            ) : (
              <div className="space-y-4">
                {[{ v: 1, l: 'Segunda-feira' }, { v: 2, l: 'Terça-feira' }, { v: 3, l: 'Quarta-feira' }, { v: 4, l: 'Quinta-feira' }, { v: 5, l: 'Sexta-feira' }, { v: 6, l: 'Sábado' }, { v: 0, l: 'Domingo' }].map(day => {
                  const config = scheduleForm.dailyConfigs?.[day.v] || { isActive: false, hasBreak: false, startTime: '', breakStart: '', breakEnd: '', endTime: '' };
                  return (
                    <div key={day.v} className="p-4 rounded-2xl border border-slate-200 bg-slate-50" style={config.isActive ? { borderColor: 'rgba(27,58,87,0.2)', backgroundColor: 'rgba(27,58,87,0.03)' } : {}}>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <input type="checkbox" checked={config.isActive} onChange={e => {
                            setScheduleForm({
                              ...scheduleForm,
                              dailyConfigs: {
                                ...scheduleForm.dailyConfigs,
                                [day.v]: { ...config, isActive: e.target.checked }
                              }
                            });
                          }} className="rounded text-[#1B3A57] w-4 h-4 cursor-pointer" />
                          <span className="text-sm font-bold" style={{ color: config.isActive ? '#1B3A57' : '#94A3B8' }}>{day.l}</span>
                        </div>
                        {config.isActive && (
                          <button type="button" onClick={() => {
                            const nextHasBreak = !(config.hasBreak || !!config.breakStart);
                            setScheduleForm({
                              ...scheduleForm, dailyConfigs: {
                                ...scheduleForm.dailyConfigs, [day.v]: { ...config, hasBreak: nextHasBreak, breakStart: nextHasBreak ? config.breakStart : '', breakEnd: nextHasBreak ? config.breakEnd : '' }
                              }
                            });
                          }} className="text-[10px] font-bold text-orange-500 hover:text-orange-600">
                            {(config.hasBreak || !!config.breakStart) ? '× Remover Pausa' : '+ Adicionar Pausa'}
                          </button>
                        )}
                      </div>
                      {config.isActive && (
                        <div className={`grid grid-cols-2 ${config.hasBreak || !!config.breakStart ? 'lg:grid-cols-4' : ''} gap-4 pl-7`}>
                          <div className="space-y-1"><label className="text-[9px] font-black text-slate-400 uppercase">Entrada</label><input type="time" value={config.startTime} onChange={e => setScheduleForm({ ...scheduleForm, dailyConfigs: { ...scheduleForm.dailyConfigs, [day.v]: { ...config, startTime: e.target.value } } })} className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs shadow-sm" /></div>
                          {(config.hasBreak || !!config.breakStart) && (
                            <>
                              <div className="space-y-1"><label className="text-[9px] font-black text-orange-500 uppercase">Pausa I.</label><input type="time" value={config.breakStart} onChange={e => setScheduleForm({ ...scheduleForm, dailyConfigs: { ...scheduleForm.dailyConfigs, [day.v]: { ...config, breakStart: e.target.value } } })} className="w-full bg-white border border-orange-100 rounded-lg p-2 text-xs shadow-sm" /></div>
                              <div className="space-y-1"><label className="text-[9px] font-black text-orange-500 uppercase">Pausa F.</label><input type="time" value={config.breakEnd} onChange={e => setScheduleForm({ ...scheduleForm, dailyConfigs: { ...scheduleForm.dailyConfigs, [day.v]: { ...config, breakEnd: e.target.value } } })} className="w-full bg-white border border-orange-100 rounded-lg p-2 text-xs shadow-sm" /></div>
                            </>
                          )}
                          <div className="space-y-1"><label className="text-[9px] font-black text-slate-400 uppercase">Saída</label><input type="time" value={config.endTime} onChange={e => setScheduleForm({ ...scheduleForm, dailyConfigs: { ...scheduleForm.dailyConfigs, [day.v]: { ...config, endTime: e.target.value } } })} className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs shadow-sm" /></div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* COLUNAS 2 e 3: Atribuição de Trabalhadores */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100 space-y-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-xl" style={{ backgroundColor: 'rgba(134,154,175,0.15)', color: '#869AAF' }}><Users size={18} /></div>
              <h4 className="font-black text-slate-700 text-lg uppercase tracking-tight">Atribuição</h4>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Lista de trabalhadores */}
              <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2">
                <div className="relative mb-4">
                  <Search className="absolute left-3 top-3 text-slate-400" size={16} />
                  <input
                    type="text"
                    value={workerSearch}
                    onChange={e => setWorkerSearch(e.target.value)}
                    placeholder="Pesquisar trabalhador..."
                    className="w-full bg-white border border-slate-200 rounded-xl py-3 pl-10 pr-4 text-sm font-bold outline-none shadow-sm focus:border-[#1B3A57] focus:ring-4 focus:ring-[#1B3A57]/10 transition-all"
                  />
                </div>

                <div className="flex flex-col gap-2">
                  {[...workers].sort((a, b) => a.name.localeCompare(b.name)).filter(w => w.name.toLowerCase().includes(workerSearch.toLowerCase())).map(w => {
                    const isAssigned = scheduleForm.assignedWorkers?.includes(w.id);
                    return (
                      <div key={w.id} className={`flex items-center gap-3 p-3 rounded-xl border shadow-sm transition-all cursor-pointer ${isAssigned ? '' : 'bg-white border-slate-100 hover:border-[#869AAF]'}`} style={isAssigned ? { backgroundColor: 'rgba(27,58,87,0.04)', borderColor: 'rgba(27,58,87,0.2)' } : {}}>
                        <input type="checkbox" checked={isAssigned} onChange={(e) => {
                          const current = scheduleForm.assignedWorkers || [];
                          const updated = e.target.checked ? [...current, w.id] : current.filter(id => id !== w.id);
                          setScheduleForm({ ...scheduleForm, assignedWorkers: updated });
                          if (e.target.checked) {
                            setAssignmentDates(prev => ({
                              ...prev,
                              [w.id]: {
                                scheduleId: null,
                                dataInicio: new Date().toISOString().split('T')[0],
                                dataFim: ''
                              }
                            }));
                          }
                        }} className="rounded text-[#1B3A57] w-5 h-5 focus:ring-[#1B3A57] cursor-pointer" />
                        <span className="text-sm font-bold flex-1" style={{ color: isAssigned ? '#1B3A57' : '#334155' }}>{w.name}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Detalhes de atribuição */}
              <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
                {workers.filter(w => scheduleForm.assignedWorkers?.includes(w.id)).length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-48 text-slate-400 bg-white rounded-2xl border border-slate-100 border-dashed">
                    <Users size={32} className="mb-2 opacity-20" />
                    <span className="text-sm font-bold">Nenhum trabalhador selecionado</span>
                  </div>
                ) : (
                  workers.filter(w => scheduleForm.assignedWorkers?.includes(w.id)).sort((a, b) => a.name.localeCompare(b.name)).map(w => (
                    <div key={w.id} className="p-5 bg-white rounded-2xl border border-slate-100 shadow-md space-y-4 transition-all hover:shadow-lg">
                      <div className="flex items-center justify-between border-b border-slate-50 pb-3">
                        <span className="font-black text-base" style={{ color: '#1B3A57' }}>{w.name}</span>
                        <div className="flex gap-2">
                          {scheduleForm.id && (
                            <button
                              onClick={() => loadScheduleHistory(w.id, w.name, scheduleForm.id, scheduleForm.name)}
                              className="text-xs font-bold text-slate-400 hover:text-[#869AAF] px-2 py-1 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors flex items-center gap-1"
                              title="Histórico"
                            >📅 <span className="hidden xl:inline">Histórico</span></button>
                          )}
                          <button
                            onClick={async () => {
                              await handleAssignScheduleWithDates(w.id, scheduleForm.id || `s${Date.now()}`, assignmentDates[w.id]?.dataInicio ?? w.assignedScheduleDates?.[scheduleForm.id]?.dataInicio ?? new Date().toISOString().split('T')[0], assignmentDates[w.id]?.dataFim ?? w.assignedScheduleDates?.[scheduleForm.id]?.dataFim ?? null);
                              setSaveSuccessWorkerId(w.id);
                              setTimeout(() => setSaveSuccessWorkerId(null), 3000);
                            }}
                            className={`${saveSuccessWorkerId === w.id ? 'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-200' : 'shadow-md'} text-white px-3 py-1.5 rounded-lg font-black text-[10px] uppercase transition-all flex items-center gap-1`}
                            style={saveSuccessWorkerId === w.id ? {} : { backgroundColor: '#1B3A57' }}
                          >
                            {saveSuccessWorkerId === w.id ? <><CheckCircle2 size={12} /> Gravado</> : 'Gravar'}
                          </button>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="text-[9px] font-black text-slate-400 uppercase flex items-center gap-1"><CalendarRange size={10} /> Data Início</label>
                          <input
                            type="date"
                            value={assignmentDates[w.id]?.dataInicio ?? w.assignedScheduleDates?.[scheduleForm.id]?.dataInicio ?? ''}
                            onChange={(e) => setAssignmentDates(prev => ({
                              ...prev,
                              [w.id]: { ...prev[w.id], dataInicio: e.target.value, dataFim: prev[w.id]?.dataFim ?? w.assignedScheduleDates?.[scheduleForm.id]?.dataFim ?? '' }
                            }))}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-bold outline-none shadow-sm focus:border-[#1B3A57] focus:ring-4 focus:ring-[#1B3A57]/10 transition-all"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] font-black text-slate-400 uppercase flex items-center gap-1"><CalendarRange size={10} /> Data Fim</label>
                          <input
                            type="date"
                            value={assignmentDates[w.id]?.dataFim ?? w.assignedScheduleDates?.[scheduleForm.id]?.dataFim ?? ''}
                            onChange={(e) => setAssignmentDates(prev => ({
                              ...prev,
                              [w.id]: { ...prev[w.id], dataInicio: prev[w.id]?.dataInicio ?? w.assignedScheduleDates?.[scheduleForm.id]?.dataInicio ?? new Date().toISOString().split('T')[0], dataFim: e.target.value }
                            }))}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-bold outline-none shadow-sm focus:border-[#1B3A57] focus:ring-4 focus:ring-[#1B3A57]/10 transition-all"
                          />
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal de Histórico de Atribuição */}
      {showScheduleHistory.show && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[10000]" onClick={() => setShowScheduleHistory({ show: false, workerId: null, workerName: '', scheduleId: null, scheduleName: '', history: [] })}>
          <div className="bg-white p-6 rounded-2xl max-w-md w-full mx-4 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-lg font-black" style={{ color: '#1B3A57' }}>Histórico: {showScheduleHistory.scheduleName}</h3>
              <button onClick={() => setShowScheduleHistory({ show: false, workerId: null, workerName: '', scheduleId: null, scheduleName: '', history: [] })} className="text-slate-400 hover:text-slate-600 text-2xl">&times;</button>
            </div>
            <p className="text-sm font-bold text-slate-500 mb-4">{showScheduleHistory.workerName}</p>
            {showScheduleHistory.history.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-4">Sem períodos registados</p>
            ) : (
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {showScheduleHistory.history.map(h => (
                  <div key={h.id} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl group">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-slate-600">{h.data_inicio}</span>
                      <span className="text-slate-400">→</span>
                      <span className="text-sm font-bold" style={{ color: '#1B3A57' }}>{h.data_fim || 'Atual'}</span>
                    </div>
                    <button
                      onClick={() => handleDeleteScheduleHistory(h.id)}
                      className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity p-1"
                      title="Apagar registo"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
