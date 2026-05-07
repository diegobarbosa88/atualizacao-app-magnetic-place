import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { useSchedule, ScheduleProvider } from './contexts/ScheduleContext';
import { 
  Timer, LayoutGrid, List, Edit2, Trash2, Coffee, Clock, Users, Search, Save, CalendarRange, ArrowRight, CheckCircle2 
} from 'lucide-react';

const ScheduleManagerContent = () => {
  const { workers } = useApp();

  const {
    isAddingInTab, setIsAddingInTab,
    schedulesView, setSchedulesView,
    schedulesSort, setSchedulesSort,
    scheduleForm, setScheduleForm,
    handleSaveSchedule,
    handleDeleteSchedule,
    handleAssignScheduleWithDates,
    handleUnassignSchedule
  } = useSchedule();

  // State para datas de atribuição
  const [assignmentDates, setAssignmentDates] = useState({});

  const [workerSearch, setWorkerSearch] = useState('');
  const [saveSuccessWorkerId, setSaveSuccessWorkerId] = useState(null);
  const supabase = window.supabaseInstance;
  const [showScheduleHistory, setShowScheduleHistory] = useState({ show: false, workerId: null, workerName: '', scheduleId: null, scheduleName: '', history: [] });

  // 11-06: Apagar item do histórico de atribuição
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

  // 11-06: Carregar histórico de atribuição
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

  const sortedSchedules = [...useApp().schedules].sort((a, b) => {
    let res = a.name.localeCompare(b.name);
    return schedulesSort.direction === 'asc' ? res : -res;
  });

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-3xl font-black flex items-center gap-3"><Timer size={32} className="text-indigo-600" /> Turnos Magnetic</h2>
        <div className="flex items-center gap-4">
          <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl p-1">
            <button onClick={() => setSchedulesView('grid')} className={`p-2 rounded-lg transition-all ${schedulesView === 'grid' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-indigo-600'}`} title="Vista em Grade"><LayoutGrid size={18} /></button>
            <button onClick={() => setSchedulesView('list')} className={`p-2 rounded-lg transition-all ${schedulesView === 'list' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-indigo-600'}`} title="Vista em Lista"><List size={18} /></button>
          </div>
          <button onClick={() => { setScheduleForm({ id: null, name: '', startTime: '', endTime: '', breakStart: '', breakEnd: '', hasBreak: false, assignedWorkers: [], weekdays: [1, 2, 3, 4, 5], isAdvanced: false, dailyConfigs: {} }); setIsAddingInTab(!isAddingInTab); }} className={`px-6 py-3 rounded-2xl font-black text-xs uppercase shadow-lg transition-all ${isAddingInTab ? 'bg-slate-200 text-slate-600' : 'bg-indigo-600 text-white'}`}>{isAddingInTab ? 'Voltar' : 'Novo Horário'}</button>
        </div>
      </div>

      {isAddingInTab && (
        <div className="mb-10 bg-white p-6 md:p-10 rounded-[2.5rem] shadow-xl border border-slate-100">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 border-b border-slate-100 pb-6 gap-4">
            <h3 className="text-2xl font-black text-slate-800 flex items-center gap-3">
              <Timer className="text-indigo-600" size={28} /> 
              {scheduleForm.id ? 'Editar Horário' : 'Criar Novo Horário'}
            </h3>
            <div className="flex gap-3 w-full md:w-auto">
              <button onClick={() => setIsAddingInTab(false)} className="flex-1 md:flex-none px-6 py-3 text-slate-400 font-bold uppercase text-xs hover:bg-slate-50 rounded-2xl transition-all">Cancelar</button>
              <button onClick={() => handleSaveSchedule(assignmentDates)} className="flex-1 md:flex-none bg-indigo-600 text-white px-8 py-3 rounded-2xl font-black text-xs uppercase shadow-lg shadow-indigo-200 hover:bg-indigo-700 hover:scale-105 transition-all flex items-center justify-center gap-2">
                <Save size={16} /> Salvar Horário
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* COLUNA 1: Configuração do Horário */}
            <div className="lg:col-span-1 space-y-6">
              <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100 space-y-6">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-indigo-100 text-indigo-600 rounded-xl"><Clock size={18} /></div>
                  <h4 className="font-black text-slate-700 text-lg uppercase tracking-tight">Configuração</h4>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Nome do Turno</label>
                  <input type="text" value={scheduleForm.name} onChange={e => setScheduleForm({ ...scheduleForm, name: e.target.value })} className="w-full bg-white border border-slate-200 rounded-2xl p-4 text-sm font-bold outline-none shadow-sm focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50 transition-all" placeholder="Ex: Manhã, Tarde..." />
                </div>

                <label className="flex items-center gap-3 cursor-pointer p-4 bg-white rounded-2xl border border-slate-200 shadow-sm hover:border-indigo-300 transition-all">
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
                  }} className="w-5 h-5 rounded text-indigo-600 focus:ring-indigo-500" />
                  <span className="text-xs font-bold text-slate-700">Horários diferentes por dia</span>
                </label>

                {!scheduleForm.isAdvanced ? (
                  <>
                    {/* Timeline Card */}
                    {scheduleForm.startTime && scheduleForm.endTime && (
                      <div className="bg-slate-900 rounded-[2rem] p-6 text-white shadow-lg relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-10"><Timer size={64} /></div>
                        <p className="text-[10px] font-black text-indigo-300 uppercase tracking-widest mb-1">Resumo do Turno</p>
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
                      }} className="text-[10px] font-black uppercase text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-xl hover:bg-indigo-100 transition-colors">
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
                            }} className={`px-4 py-2 rounded-full text-xs font-black transition-all shadow-sm ${isActive ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}>
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
                        <div key={day.v} className={`p-4 rounded-2xl border ${config.isActive ? 'border-indigo-200 bg-indigo-50/30' : 'border-slate-200 bg-slate-50'}`}>
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
                              }} className="rounded text-indigo-600 w-4 h-4 cursor-pointer" />
                              <span className={`text-sm font-bold ${config.isActive ? 'text-indigo-900' : 'text-slate-400'}`}>{day.l}</span>
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
                  <div className="p-2 bg-indigo-100 text-indigo-600 rounded-xl"><Users size={18} /></div>
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
                        className="w-full bg-white border border-slate-200 rounded-xl py-3 pl-10 pr-4 text-sm font-bold outline-none shadow-sm focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50 transition-all"
                      />
                    </div>
                    
                    <div className="flex flex-col gap-2">
                      {[...workers].sort((a, b) => a.name.localeCompare(b.name)).filter(w => w.name.toLowerCase().includes(workerSearch.toLowerCase())).map(w => {
                        const isAssigned = scheduleForm.assignedWorkers?.includes(w.id);
                        return (
                          <div key={w.id} className={`flex items-center gap-3 p-3 rounded-xl border shadow-sm transition-all cursor-pointer ${isAssigned ? 'bg-indigo-50/50 border-indigo-200' : 'bg-white border-slate-100 hover:border-indigo-200'}`}>
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
                            }} className="rounded text-indigo-600 w-5 h-5 focus:ring-indigo-500 cursor-pointer" />
                            <span className={`text-sm font-bold flex-1 ${isAssigned ? 'text-indigo-900' : 'text-slate-700'}`}>{w.name}</span>
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
                        <div key={w.id} className="p-5 bg-white rounded-2xl border border-indigo-100 shadow-md space-y-4 transition-all hover:shadow-lg">
                          <div className="flex items-center justify-between border-b border-slate-50 pb-3">
                            <span className="font-black text-indigo-900 text-base">{w.name}</span>
                            <div className="flex gap-2">
                              {scheduleForm.id && (
                                <button 
                                  onClick={() => loadScheduleHistory(w.id, w.name, scheduleForm.id, scheduleForm.name)}
                                  className="text-xs font-bold text-slate-400 hover:text-indigo-600 px-2 py-1 bg-slate-50 rounded-lg hover:bg-indigo-50 transition-colors flex items-center gap-1"
                                  title="Histórico"
                                >📅 <span className="hidden xl:inline">Histórico</span></button>
                              )}
                              <button 
                                onClick={async () => {
                                  await handleAssignScheduleWithDates(w.id, scheduleForm.id || `s${Date.now()}`, assignmentDates[w.id]?.dataInicio ?? w.assignedScheduleDates?.[scheduleForm.id]?.dataInicio ?? new Date().toISOString().split('T')[0], assignmentDates[w.id]?.dataFim ?? w.assignedScheduleDates?.[scheduleForm.id]?.dataFim ?? null);
                                  setSaveSuccessWorkerId(w.id);
                                  setTimeout(() => setSaveSuccessWorkerId(null), 3000);
                                }}
                                className={`${saveSuccessWorkerId === w.id ? 'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-200' : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200'} text-white px-3 py-1.5 rounded-lg font-black text-[10px] uppercase shadow-md transition-all flex items-center gap-1`}
                              >
                                {saveSuccessWorkerId === w.id ? <><CheckCircle2 size={12}/> Gravado</> : 'Gravar'}
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
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-bold outline-none shadow-sm focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50 transition-all"
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
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-bold outline-none shadow-sm focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50 transition-all"
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
        </div>
      )}

      {schedulesView === 'list' ? (
        <div className="overflow-x-auto">
          <table className="admin-table">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Nome</th>
                <th className="text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Horário</th>
                <th className="text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Dias</th>
                <th className="text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Pausa</th>
                <th className="text-right text-xs font-bold text-slate-400 uppercase tracking-wider">Ações</th>
              </tr>
            </thead>
            <tbody>
              {sortedSchedules.map(s => (
                <tr key={s.id} className="border-b border-slate-100 hover:bg-indigo-50/40 transition-all even:bg-slate-50/50 last:border-b-0 group">
                  <td className="relative">
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                    <p className="font-black text-slate-900 text-sm uppercase truncate">{s.name}</p>
                    <p className="text-xs text-slate-400 truncate">{(s.assignedWorkers || []).length} Colaboradores</p>
                  </td>
                  <td className="text-sm font-bold text-indigo-600 truncate">{s.isAdvanced ? 'Múltiplos' : `${s.startTime || '--:--'} — ${s.endTime || '--:--'}`}</td>
                  <td>
                    <div className="flex flex-wrap gap-1">
                      {[{ v: 1, l: '2ª' }, { v: 2, l: '3ª' }, { v: 3, l: '4ª' }, { v: 4, l: '5ª' }, { v: 5, l: '6ª' }, { v: 6, l: 'Sáb' }, { v: 0, l: 'Dom' }].map(d => {
                        const isActive = s.isAdvanced ? (s.dailyConfigs?.[d.v]?.isActive) : (s.weekdays || [1, 2, 3, 4, 5]).includes(d.v);
                        return isActive ? <span key={d.v} className="bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-md text-[9px] font-black uppercase">{d.l}</span> : null;
                      })}
                    </div>
                  </td>
                  <td className="text-sm font-bold text-orange-500 truncate">{s.isAdvanced ? 'Variável' : `${s.breakStart || '--:--'} — ${s.breakEnd || '--:--'}`}</td>
                  <td className="text-right">
                    <div className="flex justify-end gap-2">
                      <button onClick={() => {
                        const assigned = workers.filter(w => w.assignedSchedules?.includes(s.id)).map(w => w.id);
                        setScheduleForm({ ...s, assignedWorkers: assigned });
                        setIsAddingInTab(true);
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }} className="p-2 text-slate-400 hover:text-amber-600"><Edit2 size={16} /></button>
                      <button onClick={() => handleDeleteSchedule(s.id)} className="p-2 text-slate-400 hover:text-red-600"><Trash2 size={16} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {sortedSchedules.map(s => (
            <div key={s.id} className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm hover:border-indigo-100 transition-all">
              <div className="flex justify-between items-start mb-4">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl"><Timer size={20} /></div>
                <div className="flex gap-2">
                  <button onClick={() => {
                    const assigned = workers.filter(w => w.assignedSchedules?.includes(s.id)).map(w => w.id);
                    setScheduleForm({ ...s, assignedWorkers: assigned });
                    setIsAddingInTab(true);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }} className="p-2 text-slate-400 hover:text-amber-500"><Edit2 size={14} /></button>
                  <button onClick={() => handleDeleteSchedule(s.id)} className="p-2 text-slate-400 hover:text-red-500"><Trash2 size={14} /></button>
                </div>
              </div>
              <h4 className="font-black text-slate-800 text-lg uppercase">{s.name}</h4>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{s.isAdvanced ? 'Múltiplos (por dia)' : `${s.startTime || '--:--'} — ${s.endTime || '--:--'}`}</p>
              <div className="flex flex-wrap gap-1 mt-3 mb-2">
                {[{ v: 1, l: '2ª' }, { v: 2, l: '3ª' }, { v: 3, l: '4ª' }, { v: 4, l: '5ª' }, { v: 5, l: '6ª' }, { v: 6, l: 'Sáb' }, { v: 0, l: 'Dom' }].map(d => {
                  const isActive = s.isAdvanced ? (s.dailyConfigs?.[d.v]?.isActive) : (s.weekdays || [1, 2, 3, 4, 5]).includes(d.v);
                  return isActive ? <span key={d.v} className="bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-md text-[9px] font-black uppercase">{d.l}</span> : null;
                })}
              </div>
              <div className="flex items-center gap-1 text-[10px] text-orange-500 font-bold mt-2"><Coffee size={12} /> Pausa: {s.isAdvanced ? 'Variável' : `${s.breakStart || '--:--'}-${s.breakEnd || '--:--'}`}</div>
            </div>
          ))}
        </div>
      )}

      {/* 11-06: Modal de Histórico de Atribuição de Horário */}
      {showScheduleHistory.show && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowScheduleHistory({ show: false, workerId: null, workerName: '', scheduleId: null, scheduleName: '', history: [] })}>
          <div className="bg-white p-6 rounded-2xl max-w-md w-full mx-4 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-lg font-black text-indigo-700">Histórico: {showScheduleHistory.scheduleName}</h3>
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
                      <span className="text-sm font-bold text-indigo-600">{h.data_fim || 'Atual'}</span>
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
};

const ScheduleManager = () => {
  return (
    <ScheduleProvider>
      <ScheduleManagerContent />
    </ScheduleProvider>
  );
};

export default ScheduleManager;
