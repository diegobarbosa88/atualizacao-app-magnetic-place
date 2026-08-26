import React from 'react';
import { useApp } from '../../context/AppContext';
import { useSchedule, ScheduleProvider } from './contexts/ScheduleContext';
import { Timer, LayoutGrid, List, Edit2, Trash2, Coffee, Clock, Users, Save } from 'lucide-react';
import ScheduleForm from './schedules/ScheduleForm';
import ModalShell from '../../components/common/ModalShell';
import SectionHeaderShell from '../../components/common/SectionHeaderShell';
import { FT, SCALE, FONT_TITLE, FONT_MONO } from '../../styles/designTokens';

// Fita de 7 posições fixas (Domingo→Sábado) usada na Grade e na Lista —
// substitui as pills de texto repetidas por dia ativo.
const WEEKDAYS = [
  { v: 0, l: 'D', full: 'Domingo' },
  { v: 1, l: 'S', full: 'Segunda' },
  { v: 2, l: 'T', full: 'Terça' },
  { v: 3, l: 'Q', full: 'Quarta' },
  { v: 4, l: 'Q', full: 'Quinta' },
  { v: 5, l: 'S', full: 'Sexta' },
  { v: 6, l: 'S', full: 'Sábado' },
];

function WeekdayStrip({ schedule }) {
  return (
    <div className="flex items-center gap-[3px]">
      {WEEKDAYS.map(d => {
        const isActive = schedule.isAdvanced
          ? !!schedule.dailyConfigs?.[d.v]?.isActive
          : (schedule.weekdays || [1, 2, 3, 4, 5]).includes(d.v);
        return (
          <span
            key={d.v}
            title={d.full}
            className={`w-5 h-5 shrink-0 flex items-center justify-center rounded ${SCALE.text.badge}`}
            style={isActive
              ? { backgroundColor: 'var(--navy-solid)', color: '#fff' }
              // --slate sobre --surface-dim falha AA (2,47:1) em modo claro —
              // texto directamente sobre o fundo global usa --ink-soft, como
              // já estabelecido para o mesmo par noutros sítios da app.
              : { backgroundColor: 'var(--surface-dim)', color: 'var(--ink-soft)' }}
          >
            {d.l}
          </span>
        );
      })}
    </div>
  );
}

function ScheduleTimeRange({ s, className = '' }) {
  if (s.isAdvanced) {
    return <span className={`italic text-[var(--slate)] ${SCALE.text.meta} ${className}`}>Horário por dia</span>;
  }
  return (
    <span className={`font-bold ${className}`} style={{ fontFamily: FONT_MONO }}>
      {s.startTime || '--:--'} — {s.endTime || '--:--'}
    </span>
  );
}

function ScheduleBreak({ s, className = '' }) {
  if (s.isAdvanced) {
    return <span className={`italic text-[var(--slate)] ${className}`}>Variável</span>;
  }
  if (!s.breakStart) {
    return <span className={`italic text-[var(--slate)] ${className}`}>sem intervalo</span>;
  }
  return <span className={className} style={{ fontFamily: FONT_MONO }}>{s.breakStart} — {s.breakEnd}</span>;
}

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

  const openEdit = (s) => {
    const assigned = workers.filter(w => w.assignedSchedules?.includes(s.id)).map(w => w.id);
    setScheduleForm({ ...s, assignedWorkers: assigned });
    setIsAddingInTab(true);
  };

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
        size="3xl"
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
                <tr key={s.id} onClick={() => openEdit(s)} className="border-b border-[var(--border-soft)] hover:bg-[var(--surface)] transition-colors cursor-pointer">
                  <td className="px-4 py-3">
                    <p className="font-bold text-[var(--ink)] text-sm truncate" style={{ fontFamily: FONT_TITLE }}>{s.name}</p>
                    <div className={`flex items-center gap-1.5 mt-0.5 ${SCALE.text.meta} text-[var(--slate-dim)]`}>
                      <span className={`px-1.5 py-0.5 rounded ${SCALE.text.badge}`} style={s.isAdvanced ? { backgroundColor: 'var(--tone-amber-bg)', color: 'var(--tone-amber)' } : { backgroundColor: 'var(--navy-soft)', color: 'var(--navy)' }}>
                        {s.isAdvanced ? 'Variável' : 'Fixo'}
                      </span>
                      <span className="inline-flex items-center gap-1"><Users size={10} /> {(s.assignedWorkers || []).length}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 truncate"><ScheduleTimeRange s={s} /></td>
                  <td className="px-4 py-3"><WeekdayStrip schedule={s} /></td>
                  <td className="px-4 py-3 truncate"><ScheduleBreak s={s} /></td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={(e) => { e.stopPropagation(); openEdit(s); }} className="p-1.5 rounded-lg transition-all text-[var(--slate)] hover:text-[var(--navy)] hover:bg-[var(--surface)]" title="Editar"><Edit2 size={13} /></button>
                      <button onClick={(e) => { e.stopPropagation(); handleDeleteSchedule(s.id); }} className="p-1.5 rounded-lg transition-all text-[var(--slate)] hover:text-[var(--bad)] hover:bg-[var(--bad-bg)]" title="Apagar"><Trash2 size={13} /></button>
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
            <div key={s.id} className="relative bg-white rounded-2xl border border-[var(--border-soft)] shadow-sm hover:shadow-md hover:border-[var(--border)] hover:-translate-y-0.5 transition-all duration-200 overflow-hidden">
              {/* Faixa lateral: reconhecimento rápido fixo vs. variável */}
              <div className="absolute left-0 top-0 bottom-0 w-1" style={{ backgroundColor: s.isAdvanced ? 'var(--tone-amber)' : 'var(--navy-solid)' }} />
              <div className="p-5 pl-6">
                <div className="flex justify-between items-start gap-2 mb-3">
                  <h4 className="font-bold text-[var(--ink)] text-lg leading-[1.1] truncate" style={{ fontFamily: FONT_TITLE }} title={s.name}>{s.name}</h4>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => openEdit(s)} className="p-1.5 rounded-lg transition-all text-[var(--slate)] hover:text-[var(--navy)] hover:bg-[var(--surface)]" title="Editar"><Edit2 size={12} /></button>
                    <button onClick={() => handleDeleteSchedule(s.id)} className="p-1.5 rounded-lg transition-all text-[var(--slate)] hover:text-[var(--bad)] hover:bg-[var(--bad-bg)]" title="Apagar"><Trash2 size={12} /></button>
                  </div>
                </div>

                <ScheduleTimeRange s={s} className="text-xl block mb-3" />

                <div className="flex items-center justify-between gap-2 border-t border-[var(--border-soft)] pt-3">
                  <WeekdayStrip schedule={s} />
                  <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full shrink-0 ${SCALE.text.badge}`} style={{ backgroundColor: 'var(--surface-dim)', color: 'var(--ink-soft)' }}>
                    <Users size={10} /> {(s.assignedWorkers || []).length}
                  </span>
                </div>

                <div className={`flex items-center gap-1.5 mt-2 text-[var(--slate-dim)] ${SCALE.text.meta}`}>
                  <Coffee size={10} className="text-[var(--slate)] shrink-0" />
                  <ScheduleBreak s={s} />
                </div>
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
