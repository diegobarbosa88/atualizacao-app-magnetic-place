import React, { useState, useEffect } from 'react';
import { ReceiptText, Scissors, Files, FileSearch } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import ModoHistorico from './ModoHistorico';
import ModoBursting from './ModoBursting';
import ModoDocumentos from './ModoDocumentos';
import ModoReextracao from './ModoReextracao';
import { SCALE } from '../../styles/designTokens';

const ValidarReciboAdmin = ({ workers = [] }) => {
  const { logs = [], systemSettings, saveSystemSettings, saveToDb } = useApp();
  const [modo, setModo] = useState('recibos');
  const [workerRateHistory, setWorkerRateHistory] = useState([]);

  useEffect(() => {
    const db = window.supabaseInstance;
    if (!db) return;
    db.from('worker_valorhora_history').select('*').then(({ data }) => {
      if (data) setWorkerRateHistory(data);
    });
  }, []);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-1 border-b border-[var(--border-soft)]">
        {[
          { id: 'recibos',    icon: ReceiptText, label: 'Recibos'    },
          { id: 'burst',      icon: Scissors,    label: 'Burst'      },
          { id: 'documentos', icon: Files,       label: 'Documentos' },
          { id: 'reextracao', icon: FileSearch,  label: 'Reextração' },
        ].map(({ id, icon: Icon, label }) => (
          <button key={id} onClick={() => setModo(id)}
            className={`flex items-center gap-1.5 px-3 pb-2.5 pt-1 transition-all border-b-2 -mb-px ${SCALE.text.badge} ${modo === id ? 'border-[var(--orange)] text-[var(--navy)]' : 'border-transparent text-[var(--slate-dim)] hover:text-[var(--navy)]'}`}>
            <Icon size={13} /> {label}
          </button>
        ))}
      </div>

      {modo === 'recibos'    && <ModoHistorico workers={workers} logs={logs} systemSettings={systemSettings} saveSystemSettings={saveSystemSettings} saveToDb={saveToDb} workerRateHistory={workerRateHistory} />}
      {modo === 'burst'      && <ModoBursting  workers={workers} logs={logs} systemSettings={systemSettings} saveToDb={saveToDb} workerRateHistory={workerRateHistory} />}
      {modo === 'documentos' && <ModoDocumentos workers={workers} />}
      {modo === 'reextracao' && <ModoReextracao workers={workers} logs={logs} systemSettings={systemSettings} workerRateHistory={workerRateHistory} />}
    </div>
  );
};

export default ValidarReciboAdmin;
