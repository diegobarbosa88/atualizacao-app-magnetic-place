import React from 'react';
import { FileText } from 'lucide-react';
import WorkerDocuments from '../../../components/common/WorkerDocuments';
import ModalShell from '../../../components/common/ModalShell';

export default function DocumentsModal({ isOpen, onClose, currentUser, documents, saveToDb }) {
  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      title="Meus Documentos"
      icon={<FileText size={20} />}
      accent="brand"
      size="2xl"
    >
      <div className="px-4 py-4">
        <WorkerDocuments currentUser={currentUser} documents={documents} saveToDb={saveToDb} pendingOnly={false} />
      </div>
    </ModalShell>
  );
}
