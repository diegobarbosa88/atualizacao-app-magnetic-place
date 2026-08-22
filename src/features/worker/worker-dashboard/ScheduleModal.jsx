import React from 'react';
import { Timer } from 'lucide-react';
import WorkerScheduleTab from './WorkerScheduleTab';
import ModalShell from '../../../components/common/ModalShell';

export default function ScheduleModal({ isOpen, onClose, assigned, currentUser, expandedSchedules, toggleScheduleExpand, setDefaultSchedule }) {
  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      title="Meus Horários"
      icon={<Timer size={20} />}
      accent="brand"
      size="2xl"
    >
      <div className="px-4 py-4">
        <WorkerScheduleTab
          assigned={assigned}
          currentUser={currentUser}
          expandedSchedules={expandedSchedules}
          toggleScheduleExpand={toggleScheduleExpand}
          setDefaultSchedule={setDefaultSchedule}
        />
      </div>
    </ModalShell>
  );
}
