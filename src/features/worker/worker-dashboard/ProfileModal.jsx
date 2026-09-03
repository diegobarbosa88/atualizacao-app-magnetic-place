import React from 'react';
import { UserCircle } from 'lucide-react';
import WorkerProfile from '../WorkerProfile';
import ModalShell from '../../../components/common/ModalShell';

export default function ProfileModal({ isOpen, onClose, worker, changeRequests, documents, onRequestTour }) {
  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      title="Meu Perfil"
      icon={<UserCircle size={20} />}
      accent="brand"
      size="2xl"
    >
      <div className="px-4 py-4">
        <WorkerProfile
          worker={worker}
          changeRequests={changeRequests}
          documents={documents}
          onRequestTour={onRequestTour}
        />
      </div>
    </ModalShell>
  );
}
