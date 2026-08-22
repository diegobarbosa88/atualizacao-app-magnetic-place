import React from 'react';
import { useApp } from '../../context/AppContext';
import { useSchedule, ScheduleProvider } from './contexts/ScheduleContext';
import { Timer, LayoutGrid, List, Edit2, Trash2, Coffee, Clock, Users } from 'lucide-react';
import ScheduleForm from './schedules/ScheduleForm';
import ModalShell from '../../components/common/ModalShell';
import SectionHeaderShell from '../../components/common/SectionHeaderShell';

const ScheduleManagerContent = () => {
  const {
    isAddingInTab, setIsAddingInTab,
    schedulesView, setSchedulesView,
    schedulesSort, setSchedulesSort,
    scheduleForm, setScheduleForm,
    handleDeleteSchedule,
  } = useSchedule();

  const { workers, schedules } = useApp();
  const sortedSchedules = [...schedules].sort((a, b) => {
    let res = a.name.localeCompare(b.name);
    return schedulesSort.direction === 'asc' ? res : -res;
  });

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <SectionHeaderShell
        icon={<Timer size={18} />}
        title="Turnos Magnetic"
        subtitle={`${schedules.length} horário${schedules.length !== 1 ? 's' : ''}`}
        rightSlot={
          <div className="flex items-center gap-2">
            <div className="flex items-center bg-white/10 rounded-xl p-1">
              <button onClick={() => setSchedulesView('grid')} className={`p-2 rounded-lg transition-all ${schedulesView === 'grid' ? 'bg-white text-[#1B3A57]' : 'text-white/70 hover:text-white'}`} title="Vista em Grade"><LayoutGrid size={18} /></button>
              <button onClick={() => setSchedulesView('list')} className={`p-2 rounded-lg transition-all ${schedulesView === 'list' ? 'bg-white text-[#1B3A57]' : 'text-white/70 hover:text-white'}`} title="Vista em Lista"><List size={18} /></button>
            </div>
            <button onClick={() => { setScheduleForm({ id: null, name: '', startTime: '', endTime: '', breakStart: '', breakEnd: '', hasBreak: false, assignedWorkers: [], weekdays: [1, 2, 3, 4, 5], isAdvanced: false, dailyConfigs: {} }); setIsAddingInTab(true); }} className="px-4 py-2.5 rounded-xl font-black text-xs uppercase shadow-lg transition-all" style={{ backgroundColor: '#EB8D00', color: '#12293e' }}>Novo Horário</button>
          </div>
        }
      />

      <ModalShell
        isOpen={isAddingInTab}
        onClose={() => setIsAddingInTab(false)}
        title={scheduleForm.id ? 'Editar Horário' : 'Novo Horário'}
        icon={<Timer size={16} />}
        accent="navyGradient"
        size="3xl"
      >
        <ScheduleForm />
      </ModalShell>

      {schedulesView === 'list' ? (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-slate-100 bg-slate-50">
              <th className="text-left px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Nome</th>
              <th className="text-left px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Horário</th>
              <th className="text-left px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Dias</th>
              <th className="text-left px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Pausa</th>
              <th className="text-right px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Ações</th>
            </tr></thead>
            <tbody>
              {sortedSchedules.map(s => (
                <tr key={s.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-black text-slate-800 text-sm truncate">{s.name}</p>
                    <p className="text-xs text-slate-400">{(s.assignedWorkers || []).length} Colaboradores</p>
                  </td>
                  <td className="px-4 py-3 text-sm font-bold text-slate-500 truncate">{s.isAdvanced ? 'Múltiplos' : `${s.startTime || '--:--'} — ${s.endTime || '--:--'}`}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-nowrap gap-1 overflow-x-auto">
                      {[{ v: 1, l: '2ª' }, { v: 2, l: '3ª' }, { v: 3, l: '4ª' }, { v: 4, l: '5ª' }, { v: 5, l: '6ª' }, { v: 6, l: 'Sáb' }, { v: 0, l: 'Dom' }].map(d => {
                        const isActive = s.isAdvanced ? (s.dailyConfigs?.[d.v]?.isActive) : (s.weekdays || [1, 2, 3, 4, 5]).includes(d.v);
                        return isActive ? <span key={d.v} className="px-2 py-1 rounded text-[10px] font-black uppercase whitespace-nowrap" style={{ backgroundColor: 'rgba(134,154,175,0.15)', color: '#869AAF' }}>{d.l}</span> : null;
                      })}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm font-bold text-slate-500 truncate">{s.isAdvanced ? 'Variável' : `${s.breakStart || '--:--'} — ${s.breakEnd || '--:--'}`}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => {
                        const assigned = workers.filter(w => w.assignedSchedules?.includes(s.id)).map(w => w.id);
                        setScheduleForm({ ...s, assignedWorkers: assigned });
                        setIsAddingInTab(true);
                      }} className="p-1.5 rounded-lg hover:bg-slate-50 transition-all" style={{ color: '#869AAF' }} title="Editar"><Edit2 size={13} /></button>
                      <button onClick={() => handleDeleteSchedule(s.id)} className="p-1.5 text-rose-400 hover:bg-rose-50 rounded-lg transition-all" title="Apagar"><Trash2 size={13} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {sortedSchedules.map(s => (
            <div key={s.id} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md hover:border-slate-200 hover:-translate-y-0.5 transition-all duration-200">
              {/* Header */}
              <div className="flex justify-between items-start mb-3">
                <div className="px-2.5 py-1 rounded-full text-[9px] font-black uppercase border flex items-center gap-1" style={{ color: '#869AAF', borderColor: 'rgba(134,154,175,0.4)', backgroundColor: 'rgba(134,154,175,0.1)' }}>
                  <Timer size={10} /> Turno
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => {
                    const assigned = workers.filter(w => w.assignedSchedules?.includes(s.id)).map(w => w.id);
                    setScheduleForm({ ...s, assignedWorkers: assigned });
                    setIsAddingInTab(true);
                  }} className="p-1.5 rounded-lg hover:bg-slate-50 transition-all border" style={{ color: '#869AAF', borderColor: 'rgba(134,154,175,0.3)' }} title="Editar"><Edit2 size={12} /></button>
                  <button onClick={() => handleDeleteSchedule(s.id)} className="p-1.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all border border-slate-100"><Trash2 size={12} /></button>
                </div>
              </div>
              {/* Name */}
              <h4 className="font-black text-slate-800 text-sm truncate mb-0.5">{s.name}</h4>
              <p className="text-[10px] text-slate-400 font-bold truncate mb-3">{s.isAdvanced ? 'Múltiplos (por dia)' : `${s.startTime || '--:--'} — ${s.endTime || '--:--'}`}</p>
              {/* Info */}
              <div className="text-[10px] text-slate-400 font-bold space-y-1 border-t border-slate-50 pt-2">
                <div className="flex flex-wrap gap-1">
                  {[{ v: 1, l: '2ª' }, { v: 2, l: '3ª' }, { v: 3, l: '4ª' }, { v: 4, l: '5ª' }, { v: 5, l: '6ª' }, { v: 6, l: 'Sáb' }, { v: 0, l: 'Dom' }].map(d => {
                    const isActive = s.isAdvanced ? (s.dailyConfigs?.[d.v]?.isActive) : (s.weekdays || [1, 2, 3, 4, 5]).includes(d.v);
                    return isActive ? <span key={d.v} className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase" style={{ backgroundColor: 'rgba(134,154,175,0.15)', color: '#869AAF' }}>{d.l}</span> : null;
                  })}
                </div>
                <div className="flex items-center gap-1.5"><Coffee size={10} /> {s.isAdvanced ? 'Variável' : `${s.breakStart || '--:--'}-${s.breakEnd || '--:--'}`}</div>
                <div className="flex items-center gap-1.5"><Users size={10} /> {(s.assignedWorkers || []).length} colaboradores</div>
              </div>
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
