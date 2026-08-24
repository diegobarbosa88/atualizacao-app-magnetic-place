import React from 'react';
import { useApp } from '../../context/AppContext';
import { useSchedule, ScheduleProvider } from './contexts/ScheduleContext';
import { Timer, LayoutGrid, List, Edit2, Trash2, Coffee, Clock, Users, Save } from 'lucide-react';
import ScheduleForm from './schedules/ScheduleForm';
import ModalShell from '../../components/common/ModalShell';
import SectionHeaderShell from '../../components/common/SectionHeaderShell';
import { FT, SCALE } from '../../styles/designTokens';

const ScheduleManagerContent = () => {
  const {
    isAddingInTab, setIsAddingInTab,
    schedulesView, setSchedulesView,
    schedulesSort, setSchedulesSort,
    scheduleForm, setScheduleForm,
    assignmentDates,
    handleSaveSchedule,
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
            <div className="flex items-center bg-[var(--surface-dim)] rounded-xl p-1">
              <button onClick={() => setSchedulesView('grid')} className={`p-1.5 rounded-lg transition-all ${schedulesView === 'grid' ? 'bg-white text-[var(--navy)] shadow-sm' : 'text-[var(--slate)] hover:text-[var(--ink-soft)]'}`} title="Vista em Grade"><LayoutGrid size={16} /></button>
              <button onClick={() => setSchedulesView('list')} className={`p-1.5 rounded-lg transition-all ${schedulesView === 'list' ? 'bg-white text-[var(--navy)] shadow-sm' : 'text-[var(--slate)] hover:text-[var(--ink-soft)]'}`} title="Vista em Lista"><List size={16} /></button>
            </div>
            <button onClick={() => { setScheduleForm({ id: null, name: '', startTime: '', endTime: '', breakStart: '', breakEnd: '', hasBreak: false, assignedWorkers: [], weekdays: [1, 2, 3, 4, 5], isAdvanced: false, dailyConfigs: {} }); setIsAddingInTab(true); }} className={`px-3.5 py-2 rounded-lg shadow-sm transition-all ${SCALE.text.badge}`} style={{ backgroundColor: FT.orange, color: '#12293e' }}>Novo Horário</button>
          </div>
        }
      />

      <ModalShell
        isOpen={isAddingInTab}
        onClose={() => setIsAddingInTab(false)}
        title={scheduleForm.id ? 'Editar Horário' : 'Novo Horário'}
        icon={<Timer size={18} />}
        accent="brand"
        // O formulário usa lg:grid-cols-3 (e lg:grid-cols-4 nos horários por
        // dia). Os breakpoints do Tailwind medem a VIEWPORT, não o contentor,
        // por isso a 3xl (768px) as três colunas ativavam na mesma e ficavam
        // espremidas — os rótulos ENTRADA/PAUSA/SAÍDA chegavam a sobrepor-se.
        size="6xl"
        footer={
          <div className="flex items-center justify-end gap-3 px-6 py-4">
            <button
              onClick={() => setIsAddingInTab(false)}
              className="px-6 py-3 text-[var(--slate-dim)] font-bold uppercase text-xs hover:bg-[var(--surface)] rounded-2xl transition-all"
            >
              Cancelar
            </button>
            <button
              onClick={() => handleSaveSchedule(assignmentDates)}
              className="px-8 py-3 rounded-2xl font-black text-xs uppercase shadow-lg transition-all flex items-center justify-center gap-2"
              style={{ backgroundColor: FT.orange, color: FT.navy }}
            >
              <Save size={16} /> Salvar Horário
            </button>
          </div>
        }
      >
        <ScheduleForm />
      </ModalShell>

      {schedulesView === 'list' ? (
        <div className="bg-white rounded-2xl border border-[var(--border-soft)] shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-[var(--border-soft)] bg-[var(--surface)]">
              <th className={`text-left px-4 py-3 text-[var(--slate-dim)] ${SCALE.text.statLabel}`}>Nome</th>
              <th className={`text-left px-4 py-3 text-[var(--slate-dim)] ${SCALE.text.statLabel}`}>Horário</th>
              <th className={`text-left px-4 py-3 text-[var(--slate-dim)] ${SCALE.text.statLabel}`}>Dias</th>
              <th className={`text-left px-4 py-3 text-[var(--slate-dim)] ${SCALE.text.statLabel}`}>Pausa</th>
              <th className={`text-right px-4 py-3 text-[var(--slate-dim)] ${SCALE.text.statLabel}`}>Ações</th>
            </tr></thead>
            <tbody>
              {sortedSchedules.map(s => (
                <tr key={s.id} className="border-b border-[var(--border-soft)] hover:bg-[var(--surface)] transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-black text-[var(--ink)] text-sm truncate">{s.name}</p>
                    <p className="text-xs text-[var(--slate-dim)]">{(s.assignedWorkers || []).length} Colaboradores</p>
                  </td>
                  <td className="px-4 py-3 text-sm font-bold text-[var(--slate-dim)] truncate">{s.isAdvanced ? 'Múltiplos' : `${s.startTime || '--:--'} — ${s.endTime || '--:--'}`}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-nowrap gap-1 overflow-x-auto">
                      {[{ v: 1, l: '2ª' }, { v: 2, l: '3ª' }, { v: 3, l: '4ª' }, { v: 4, l: '5ª' }, { v: 5, l: '6ª' }, { v: 6, l: 'Sáb' }, { v: 0, l: 'Dom' }].map(d => {
                        const isActive = s.isAdvanced ? (s.dailyConfigs?.[d.v]?.isActive) : (s.weekdays || [1, 2, 3, 4, 5]).includes(d.v);
                        return isActive ? <span key={d.v} className={`px-2 py-1 rounded whitespace-nowrap ${SCALE.text.badge}`} style={{ backgroundColor: 'rgba(134,154,175,0.15)', color: 'var(--slate-dim)' }}>{d.l}</span> : null;
                      })}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm font-bold text-[var(--slate-dim)] truncate">{s.isAdvanced ? 'Variável' : `${s.breakStart || '--:--'} — ${s.breakEnd || '--:--'}`}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => {
                        const assigned = workers.filter(w => w.assignedSchedules?.includes(s.id)).map(w => w.id);
                        setScheduleForm({ ...s, assignedWorkers: assigned });
                        setIsAddingInTab(true);
                      }} className="p-1.5 rounded-lg hover:bg-[var(--surface)] transition-all" style={{ color: FT.slate }} title="Editar"><Edit2 size={13} /></button>
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
            <div key={s.id} className="bg-white p-5 rounded-2xl border border-[var(--border-soft)] shadow-sm hover:shadow-md hover:border-[var(--border)] hover:-translate-y-0.5 transition-all duration-200">
              {/* Header */}
              <div className="flex justify-between items-start mb-3">
                <div className={`px-2.5 py-1 rounded-full border flex items-center gap-1 ${SCALE.text.badge}`} style={{ color: 'var(--slate-dim)', borderColor: 'rgba(134,154,175,0.4)', backgroundColor: 'rgba(134,154,175,0.1)' }}>
                  <Timer size={10} /> Turno
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => {
                    const assigned = workers.filter(w => w.assignedSchedules?.includes(s.id)).map(w => w.id);
                    setScheduleForm({ ...s, assignedWorkers: assigned });
                    setIsAddingInTab(true);
                  }} className="p-1.5 rounded-lg hover:bg-[var(--surface)] transition-all border" style={{ color: FT.slate, borderColor: 'rgba(134,154,175,0.3)' }} title="Editar"><Edit2 size={12} /></button>
                  <button onClick={() => handleDeleteSchedule(s.id)} className="p-1.5 text-[var(--slate)] hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all border border-[var(--border-soft)]"><Trash2 size={12} /></button>
                </div>
              </div>
              {/* Name */}
              <h4 className="font-black text-[var(--ink)] text-sm truncate mb-0.5">{s.name}</h4>
              <p className={`text-[var(--slate-dim)] truncate mb-3 ${SCALE.text.meta}`}>{s.isAdvanced ? 'Múltiplos (por dia)' : `${s.startTime || '--:--'} — ${s.endTime || '--:--'}`}</p>
              {/* Info */}
              <div className={`text-[var(--slate-dim)] space-y-1 border-t border-[var(--border-soft)] pt-2 ${SCALE.text.meta}`}>
                <div className="flex flex-wrap gap-1">
                  {[{ v: 1, l: '2ª' }, { v: 2, l: '3ª' }, { v: 3, l: '4ª' }, { v: 4, l: '5ª' }, { v: 5, l: '6ª' }, { v: 6, l: 'Sáb' }, { v: 0, l: 'Dom' }].map(d => {
                    const isActive = s.isAdvanced ? (s.dailyConfigs?.[d.v]?.isActive) : (s.weekdays || [1, 2, 3, 4, 5]).includes(d.v);
                    return isActive ? <span key={d.v} className={`px-1.5 py-0.5 rounded ${SCALE.text.badge}`} style={{ backgroundColor: 'rgba(134,154,175,0.15)', color: 'var(--slate-dim)' }}>{d.l}</span> : null;
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
