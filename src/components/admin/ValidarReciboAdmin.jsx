import React, { useState, useEffect } from 'react';
import { ReceiptText, Scissors, Files } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import ModoHistorico from './ModoHistorico';
import ModoBursting from './ModoBursting';
import ModoDocumentos from './ModoDocumentos';

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
      <div className="grid grid-cols-3 gap-1 bg-slate-100 p-1 rounded-2xl">
        {[
          { id: 'recibos',    icon: ReceiptText, label: 'Recibos'    },
          { id: 'burst',      icon: Scissors,    label: 'Burst'      },
          { id: 'documentos', icon: Files,       label: 'Documentos' },
        ].map(({ id, icon: Icon, label }) => (
          <button key={id} onClick={() => setModo(id)}
            className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${modo === id ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>
            <Icon size={13} /> {label}
          </button>
        ))}
      </div>

      {modo === 'recibos'    && <ModoHistorico workers={workers} logs={logs} systemSettings={systemSettings} saveSystemSettings={saveSystemSettings} saveToDb={saveToDb} workerRateHistory={workerRateHistory} />}
      {modo === 'burst'      && <ModoBursting  workers={workers} logs={logs} systemSettings={systemSettings} saveToDb={saveToDb} workerRateHistory={workerRateHistory} />}
      {modo === 'documentos' && <ModoDocumentos workers={workers} />}
    </div>
  );
};

export default ValidarReciboAdmin;
