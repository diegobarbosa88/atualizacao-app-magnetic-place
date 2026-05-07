import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { useSchedule, ScheduleProvider } from './contexts/ScheduleContext';
import { 
  Timer, LayoutGrid, List, Edit2, Trash2, Coffee 
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
        <div className="mb-10 bg-white p-10 rounded-[3rem] shadow-xl border-2 border-indigo-100">
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-6">
              <input type="checkbox" id="advSch" checked={scheduleForm.isAdvanced || false} onChange={e => {
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
              }} className="rounded text-indigo-600 w-4 h-4" />
              <label htmlFor="advSch" className="text-sm font-bold text-slate-700 cursor-pointer">Definir horários diferentes para cada dia da semana</label>
            </div>
          </div>

          <div className={`grid grid-cols-1 ${!scheduleForm.isAdvanced ? ((scheduleForm.hasBreak || !!scheduleForm.breakStart) ? 'md:grid-cols-5' : 'md:grid-cols-3') : 'md:grid-cols-1'} gap-6 mb-4`}>
            <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase ml-1">Nome</label><input type="text" value={scheduleForm.name} onChange={e => setScheduleForm({ ...scheduleForm, name: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm outline-none shadow-sm" /></div>
            {!scheduleForm.isAdvanced && (
              <>
                <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase ml-1">Entrada</label><input type="time" value={scheduleForm.startTime} onChange={e => setScheduleForm({ ...scheduleForm, startTime: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm shadow-sm" /></div>
                {(scheduleForm.hasBreak || !!scheduleForm.breakStart) && (
                  <>
                    <div className="space-y-1"><label className="text-[10px] font-black text-orange-500 uppercase ml-1">Pausa I.</label><input type="time" value={scheduleForm.breakStart} onChange={e => setScheduleForm({ ...scheduleForm, breakStart: e.target.value })} className="w-full bg-orange-50 border border-orange-100 rounded-xl p-4 text-sm shadow-sm" /></div>
                    <div className="space-y-1"><label className="text-[10px] font-black text-orange-500 uppercase ml-1">Pausa F.</label><input type="time" value={scheduleForm.breakEnd} onChange={e => setScheduleForm({ ...scheduleForm, breakEnd: e.target.value })} className="w-full bg-orange-50 border border-orange-100 rounded-xl p-4 text-sm shadow-sm" /></div>
                  </>
                )}
                <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase ml-1">Saída</label><input type="time" value={scheduleForm.endTime} onChange={e => setScheduleForm({ ...scheduleForm, endTime: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm shadow-sm" /></div>
              </>
            )}
          </div>
          {!scheduleForm.isAdvanced && (
            <div className="mb-8">
              <button type="button" onClick={() => {
                const nextHasBreak = !(scheduleForm.hasBreak || !!scheduleForm.breakStart);
                setScheduleForm({ ...scheduleForm, hasBreak: nextHasBreak, breakStart: nextHasBreak ? scheduleForm.breakStart : '', breakEnd: nextHasBreak ? scheduleForm.breakEnd : '' });
              }} className="text-xs font-bold text-slate-400 hover:text-indigo-600 transition-colors">
                {(scheduleForm.hasBreak || !!scheduleForm.breakStart) ? '× Remover Pausa' : '+ Adicionar Pausa'}
              </button>
            </div>
          )}

          <div className="mb-6">
            {!scheduleForm.isAdvanced ? (
              <>
                <label className="text-[10px] font-black text-slate-400 uppercase ml-1 block mb-3">Dias de Trabalho</label>
                <div className="flex flex-wrap gap-2">
                  {[{ v: 1, l: 'Seg' }, { v: 2, l: 'Ter' }, { v: 3, l: 'Qua' }, { v: 4, l: 'Qui' }, { v: 5, l: 'Sex' }, { v: 6, l: 'Sáb' }, { v: 0, l: 'Dom' }].map(day => {
                    const isActive = (scheduleForm.weekdays || [1, 2, 3, 4, 5]).includes(day.v);
                    return (
                      <button type="button" key={day.v} onClick={() => {
                        const current = scheduleForm.weekdays || [1, 2, 3, 4, 5];
                        const updated = isActive ? current.filter(d => d !== day.v) : [...current, day.v];
                        setScheduleForm({ ...scheduleForm, weekdays: updated });
                      }} className={`px-4 py-2 rounded-xl text-xs font-black transition-all shadow-sm ${isActive ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}>
                        {day.l}
                      </button>
                    );
                  })}
                </div>
              </>
            ) : (
              <div className="space-y-4">
                {[{ v: 1, l: 'Segunda-feira' }, { v: 2, l: 'Terça-feira' }, { v: 3, l: 'Quarta-feira' }, { v: 4, l: 'Quinta-feira' }, { v: 5, l: 'Sexta-feira' }, { v: 6, l: 'Sábado' }, { v: 0, l: 'Domingo' }].map(day => {
                  const config = scheduleForm.dailyConfigs?.[day.v] || { isActive: false, hasBreak: false, startTime: '', breakStart: '', breakEnd: '', endTime: '' };
                  return (
                    <div key={day.v} className={`p-4 rounded-xl border ${config.isActive ? 'border-indigo-200 bg-indigo-50/30' : 'border-slate-200 bg-slate-50'}`}>
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

          <div className="space-y-4 border-t pt-8">
            <label className="text-[10px] font-black text-slate-400 uppercase ml-1 block mb-3">Atribuir aos Trabalhadores</label>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3 max-h-48 overflow-y-auto p-4 bg-slate-50 rounded-2xl border border-slate-100">
              {workers.map(w => (
                <div key={w.id} className="flex flex-col gap-2 p-3 bg-white rounded-xl border border-slate-100 shadow-sm">
                  <div className="flex items-center gap-2">
                    <input type="checkbox" checked={scheduleForm.assignedWorkers?.includes(w.id)} onChange={(e) => {
                      const current = scheduleForm.assignedWorkers || [];
                      const updated = e.target.checked ? [...current, w.id] : current.filter(id => id !== w.id);
                      setScheduleForm({ ...scheduleForm, assignedWorkers: updated });
                      // Initialize dates when checked
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
                    }} className="rounded text-indigo-600" />
                    <span className="text-[10px] font-bold text-slate-700 truncate">{w.name}</span>
                  </div>
                  {scheduleForm.assignedWorkers?.includes(w.id) && (
                    <div className="flex gap-1 ml-4">
                      <input 
                        type="date" 
                        value={assignmentDates[w.id]?.dataInicio || ''}
                        onChange={(e) => setAssignmentDates(prev => ({
                          ...prev,
                          [w.id]: { ...prev[w.id], dataInicio: e.target.value }
                        }))}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg p-1 text-[9px]"
                      />
                      <input 
                        type="date" 
                        value={assignmentDates[w.id]?.dataFim || ''}
                        onChange={(e) => setAssignmentDates(prev => ({
                          ...prev,
                          [w.id]: { ...prev[w.id], dataFim: e.target.value }
                        }))}
                        placeholder="Fim"
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg p-1 text-[9px]"
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
          <div className="mt-8 flex justify-end gap-3"><button onClick={() => setIsAddingInTab(false)} className="px-6 py-3 text-slate-400 font-bold uppercase text-xs">Cancelar</button><button onClick={() => handleSaveSchedule(assignmentDates)} className="bg-indigo-600 text-white px-10 py-3 rounded-xl font-black text-xs uppercase shadow-lg">Salvar Horário</button></div>
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
