import { useState, useMemo, useEffect } from 'react';
import { Calendar, Clock, Coffee, FileText, CheckCircle, Send, Loader2, ChevronDown, ChevronUp, Edit2, Trash2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { toISODateLocal } from '../../utils/dateUtils';
import { roundTimeToIntervalTimeUp, roundTimeToIntervalTimeDown } from '../../utils/timeUtils';

const RequestEntryCard = ({ currentUser, logs, clients, monthLogs, onSuccess, initialDate, isInline = false, openInDeleteMode = false }) => {
  const { supabase, saveToDb, minuteInterval } = useApp();
  const [collapsed, setCollapsed] = useState(!isInline);
  const [selectedDate, setSelectedDate] = useState(initialDate || toISODateLocal(new Date()));
  const [formData, setFormData] = useState({
    clientId: currentUser?.defaultClientId || '',
    startTime: '',
    breakStart: '',
    breakEnd: '',
    endTime: '',
    description: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [requestDelete, setRequestDelete] = useState(false);

  useEffect(() => {
    if (openInDeleteMode && existingLog) {
      setRequestDelete(true);
    }
  }, [openInDeleteMode]);

  useMemo(() => {
    if (initialDate) {
      setSelectedDate(initialDate);
      const log = monthLogs?.find(l => l.date === initialDate && l.workerId === currentUser?.id);
      if (log) {
        setFormData({
          clientId: log.clientId || '',
          startTime: log.startTime || '',
          breakStart: log.breakStart || '',
          breakEnd: log.breakEnd || '',
          endTime: log.endTime || '',
          description: log.description || ''
        });
      }
    }
  }, [initialDate]);

  const dayLog = useMemo(() => {
    if (!selectedDate || !monthLogs) return null;
    return monthLogs.find(l => l.date === selectedDate && l.workerId === currentUser?.id);
  }, [selectedDate, monthLogs, currentUser]);

  const existingLog = dayLog;

  const filteredClients = useMemo(() => {
    const assigned = currentUser?.assignedClients || [];
    if (assigned.length === 0) return clients;
    return clients.filter(c => assigned.includes(c.id));
  }, [clients, currentUser]);

  const handleDateChange = (dateStr) => {
    setSelectedDate(dateStr);
    const log = monthLogs?.find(l => l.date === dateStr && l.workerId === currentUser?.id);
    if (log) {
      setFormData({
        clientId: log.clientId || '',
        startTime: log.startTime || '',
        breakStart: log.breakStart || '',
        breakEnd: log.breakEnd || '',
        endTime: log.endTime || '',
        description: log.description || ''
      });
    } else {
      setFormData({
        clientId: currentUser?.defaultClientId || '',
        startTime: '',
        breakStart: '',
        breakEnd: '',
        endTime: '',
        description: ''
      });
    }
  };

  const handleDeleteRequest = async () => {
    if (!supabase || !selectedDate || !existingLog) return;

    setIsSubmitting(true);
    try {
      const correctionId = `corr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const now = new Date().toISOString();

      const correction = {
        id: correctionId,
        client_id: String(existingLog.clientId),
        month: selectedDate.substring(0, 7),
        type: 'deletion_request',
        status: 'submitted',
        submitted_at: now,
        submitted_by: String(currentUser?.id),
        justification: `Pedido de eliminação do registo de ${selectedDate}`
      };

      const { error: e1 } = await supabase.from('corrections').insert(correction);
      if (e1) throw e1;

      const itemId = `citem_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const item = {
        id: itemId,
        correction_id: correctionId,
        worker_id: String(currentUser?.id),
        worker_name: currentUser?.name,
        date: selectedDate,
        before: {
          startTime: existingLog.startTime,
          endTime: existingLog.endTime,
          breakStart: existingLog.breakStart,
          breakEnd: existingLog.breakEnd,
        },
        proposed: null,
        final: null,
        item_status: 'pending',
      };

      const { error: e2 } = await supabase.from('correction_items').insert(item);
      if (e2) throw e2;

      await supabase.from('app_notifications').insert({
        id: `notif_${Date.now()}`,
        title: `Pedido de Eliminação · ${currentUser?.name}`,
        message: `${currentUser?.name} solicitou eliminação do registo de ${selectedDate}`,
        type: 'danger',
        target_type: 'admin',
        target_client_id: String(existingLog.clientId),
        payload: { correction_id: correctionId, kind: 'submitted' },
        is_active: true,
        is_dismissible: true,
        created_at: now,
      });

      await supabase.from('app_notifications').insert({
        id: `notif_${Date.now()}_client`,
        title: `Pedido de Eliminação · ${currentUser?.name}`,
        message: `O Trabalhador ${currentUser?.name} solicitou eliminação do registo de ${selectedDate}.`,
        type: 'info',
        target_type: 'client',
        target_client_id: String(existingLog.clientId),
        payload: { correction_id: correctionId, kind: 'submitted' },
        is_active: true,
        is_dismissible: true,
        created_at: now,
      });

      setRequestDelete(false);
      setSubmitted(true);
      if (onSuccess) onSuccess();
    } catch (err) {
      alert('Erro ao submeter pedido: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async () => {
    if (!supabase || !selectedDate) return;
    if (!formData.clientId) {
      alert('Selecione o Cliente/Unidade');
      return;
    }
    if (!formData.startTime || !formData.endTime) {
      alert('Preencha Entrada e Saída');
      return;
    }

    setIsSubmitting(true);
    try {
      const correctionId = `corr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const now = new Date().toISOString();

      const correction = {
        id: correctionId,
        client_id: String(formData.clientId),
        month: selectedDate.substring(0, 7),
        type: 'creation_request',
        status: 'submitted',
        submitted_at: now,
        submitted_by: String(currentUser?.id),
        justification: existingLog
          ? `Correção ao registo de ${selectedDate}`
          : `Criação de registo para ${selectedDate}`
      };

      const { error: e1 } = await supabase.from('corrections').insert(correction);
      if (e1) throw e1;

      const itemId = `citem_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const item = {
        id: itemId,
        correction_id: correctionId,
        worker_id: String(currentUser?.id),
        worker_name: currentUser?.name,
        date: selectedDate,
        before: existingLog ? {
          startTime: existingLog.startTime,
          endTime: existingLog.endTime,
          breakStart: existingLog.breakStart,
          breakEnd: existingLog.breakEnd,
        } : null,
        proposed: {
          startTime: roundTimeToIntervalTimeUp(formData.startTime, minuteInterval || 30),
          endTime: roundTimeToIntervalTimeDown(formData.endTime, minuteInterval || 30),
          breakStart: formData.breakStart ? roundTimeToIntervalTimeUp(formData.breakStart, minuteInterval || 30) : null,
          breakEnd: formData.breakEnd ? roundTimeToIntervalTimeDown(formData.breakEnd, minuteInterval || 30) : null,
        },
        final: null,
        item_status: 'pending',
      };

      const { error: e2 } = await supabase.from('correction_items').insert(item);
      if (e2) throw e2;

      await supabase.from('app_notifications').insert({
        id: `notif_${Date.now()}`,
        title: `Pedido de Registo · ${currentUser?.name}`,
        message: `${currentUser?.name} solicitou ${existingLog ? 'correção' : 'criação'} de registo para ${selectedDate}`,
        type: 'warning',
        target_type: 'admin',
        target_client_id: String(formData.clientId),
        payload: { correction_id: correctionId, kind: 'submitted' },
        is_active: true,
        is_dismissible: true,
        created_at: now,
      });

      await supabase.from('app_notifications').insert({
        id: `notif_${Date.now()}_client`,
        title: `Pedido de Registo · ${currentUser?.name}`,
        message: `O Trabalhador ${currentUser?.name} solicitou ${existingLog ? 'correção' : 'criação'} de registo para ${selectedDate}.`,
        type: 'info',
        target_type: 'client',
        target_client_id: String(formData.clientId),
        payload: { correction_id: correctionId, kind: 'submitted' },
        is_active: true,
        is_dismissible: true,
        created_at: now,
      });

      setSubmitted(true);
      setCollapsed(true);
      setFormData({
        clientId: currentUser?.defaultClientId || '',
        startTime: '',
        breakStart: '',
        breakEnd: '',
        endTime: '',
        description: ''
      });
      if (onSuccess) onSuccess();
    } catch (err) {
      alert('Erro ao submeter pedido: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitted) {
    if (isInline) {
      return (
        <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 text-center">
          <CheckCircle size={24} className="text-emerald-600 mx-auto mb-2" />
          <p className="text-sm font-bold text-emerald-700">Pedido submetido!</p>
          <button
            onClick={() => { setSubmitted(false); setRequestDelete(false); }}
            className="mt-2 px-4 py-2 bg-emerald-600 text-white rounded-xl font-black text-xs uppercase hover:bg-emerald-700 transition-all"
          >
            Novo Pedido
          </button>
        </div>
      );
    }
    return (
      <div className="bg-white rounded-3xl sm:rounded-[2.5rem] p-5 sm:p-8 shadow-2xl border border-indigo-50/50 animate-in fade-in zoom-in-95 duration-300 w-full text-slate-900 my-2">
        <div className="text-center py-4">
          <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <CheckCircle size={24} className="text-emerald-600" />
          </div>
          <h3 className="text-lg font-black text-slate-800 mb-1">Pedido Enviado</h3>
          <p className="text-xs text-slate-500 mb-3">Aguarde aprovação do administrador.</p>
          <button
            onClick={() => { setSubmitted(false); setRequestDelete(false); }}
            className="px-4 py-2 bg-indigo-600 text-white rounded-xl font-black text-xs uppercase hover:bg-indigo-700 transition-all"
          >
            Novo Pedido
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-3xl sm:rounded-[2.5rem] shadow-2xl border border-amber-100/50 overflow-hidden animate-in fade-in zoom-in-95 duration-300 w-full text-slate-900 ${isInline ? '' : 'my-2'}`}>
      {!isInline && (
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="w-full p-5 sm:p-6 flex items-center justify-between text-left hover:bg-slate-50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-100 rounded-xl text-amber-600">
              <FileText size={20} />
            </div>
            <div>
              <h3 className="font-black text-base uppercase tracking-tight text-slate-800">Solicitar Registo</h3>
              <p className="text-[10px] text-slate-400 font-bold">Pedidos requerem aprovação</p>
            </div>
          </div>
          {collapsed ? <ChevronDown size={20} className="text-slate-400" /> : <ChevronUp size={20} className="text-slate-400" />}
        </button>
      )}

      {(isInline || !collapsed) && (
        <div className="px-5 sm:px-6 pb-5 sm:pb-6 border-t border-slate-100 pt-4 space-y-4">
          <div className="space-y-1">
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-1">
              <Calendar size={10} /> Data
            </label>
            <input
              type="date"
              value={selectedDate}
              onChange={e => handleDateChange(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-bold outline-none shadow-sm focus:border-amber-400 focus:ring-2 focus:ring-amber-50"
            />
          </div>

          {existingLog ? (
            <div className="bg-amber-50/50 rounded-xl p-4 border border-amber-100">
              <div className="flex items-center gap-2 mb-3">
                <Edit2 size={14} className="text-amber-600" />
                <span className="text-[10px] font-black text-amber-600 uppercase tracking-widest">A editar registo de {selectedDate}</span>
              </div>
              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Cliente / Unidade</label>
                  <select
                    value={formData.clientId || ''}
                    onChange={e => setFormData({ ...formData, clientId: e.target.value })}
                    className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-sm font-bold outline-none shadow-sm"
                  >
                    <option value="">Selecione...</option>
                    {filteredClients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Entrada</label>
                    <input type="time" value={formData.startTime || ''} onChange={e => setFormData({ ...formData, startTime: e.target.value })} className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-sm font-bold outline-none shadow-sm" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Saída</label>
                    <input type="time" value={formData.endTime || ''} onChange={e => setFormData({ ...formData, endTime: e.target.value })} className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-sm font-bold outline-none shadow-sm" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-orange-500 uppercase tracking-widest ml-1">Pausa Início</label>
                    <input type="time" value={formData.breakStart || ''} onChange={e => setFormData({ ...formData, breakStart: e.target.value })} className="w-full bg-orange-50 border border-orange-100 rounded-xl p-2.5 text-sm font-bold outline-none shadow-sm" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-orange-500 uppercase tracking-widest ml-1">Pausa Fim</label>
                    <input type="time" value={formData.breakEnd || ''} onChange={e => setFormData({ ...formData, breakEnd: e.target.value })} className="w-full bg-orange-50 border border-orange-100 rounded-xl p-2.5 text-sm font-bold outline-none shadow-sm" />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Descrição</label>
                  <textarea
                    rows={2}
                    value={formData.description || ''}
                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-sm font-bold outline-none resize-none shadow-inner"
                    placeholder="Opcional..."
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-slate-50/50 rounded-xl p-4 border border-slate-100">
              <div className="flex items-center gap-2 mb-3">
                <Clock size={14} className="text-slate-500" />
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Criar novo registo para {selectedDate}</span>
              </div>
              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Cliente / Unidade</label>
                  <select
                    value={formData.clientId || ''}
                    onChange={e => setFormData({ ...formData, clientId: e.target.value })}
                    className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-sm font-bold outline-none shadow-sm"
                  >
                    <option value="">Selecione...</option>
                    {filteredClients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Entrada</label>
                    <input type="time" value={formData.startTime || ''} onChange={e => setFormData({ ...formData, startTime: e.target.value })} className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-sm font-bold outline-none shadow-sm" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Saída</label>
                    <input type="time" value={formData.endTime || ''} onChange={e => setFormData({ ...formData, endTime: e.target.value })} className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-sm font-bold outline-none shadow-sm" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-orange-500 uppercase tracking-widest ml-1">Pausa Início</label>
                    <input type="time" value={formData.breakStart || ''} onChange={e => setFormData({ ...formData, breakStart: e.target.value })} className="w-full bg-orange-50 border border-orange-100 rounded-xl p-2.5 text-sm font-bold outline-none shadow-sm" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-orange-500 uppercase tracking-widest ml-1">Pausa Fim</label>
                    <input type="time" value={formData.breakEnd || ''} onChange={e => setFormData({ ...formData, breakEnd: e.target.value })} className="w-full bg-orange-50 border border-orange-100 rounded-xl p-2.5 text-sm font-bold outline-none shadow-sm" />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Descrição</label>
                  <textarea
                    rows={2}
                    value={formData.description || ''}
                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-sm font-bold outline-none resize-none shadow-inner"
                    placeholder="Opcional..."
                  />
                </div>
              </div>
            </div>
          )}

          {existingLog && !requestDelete && (
            <button
              onClick={() => setRequestDelete(true)}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-rose-50 text-rose-600 rounded-xl border border-rose-200 font-bold text-xs uppercase tracking-widest hover:bg-rose-100 transition-all"
            >
              <Trash2 size={14} />
              Solicitar Exclusão
            </button>
          )}

          {requestDelete && (
            <div className="bg-rose-50/50 rounded-xl p-4 border border-rose-200 space-y-3">
              <div className="flex items-center gap-2 mb-2">
                <Trash2 size={16} className="text-rose-600" />
                <span className="text-xs font-black text-rose-600 uppercase tracking-widest">Confirmar pedido de exclusão</span>
              </div>
              <p className="text-xs text-slate-600">Ao confirmar, será enviado um pedido para eliminar o registo de <strong>{selectedDate}</strong>. O administrador analisará o pedido.</p>
              <div className="flex gap-2">
                <button
                  onClick={() => setRequestDelete(false)}
                  className="flex-1 py-2 bg-slate-200 text-slate-700 rounded-xl font-bold text-xs uppercase hover:bg-slate-300 transition-all"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleDeleteRequest}
                  disabled={isSubmitting}
                  className="flex-1 py-2 bg-rose-600 text-white rounded-xl font-bold text-xs uppercase hover:bg-rose-700 transition-all disabled:opacity-50"
                >
                  {isSubmitting ? <Loader2 size={14} className="animate-spin mx-auto" /> : 'Confirmar'}
                </button>
              </div>
            </div>
          )}

          {!requestDelete && (
            <button
              onClick={handleSubmit}
              disabled={isSubmitting || !formData.clientId || !formData.startTime || !formData.endTime}
              className="w-full bg-emerald-600 text-white py-3 rounded-xl shadow-lg hover:bg-emerald-700 transition-all font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
            >
              {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              {isSubmitting ? 'A Submeter...' : 'Submeter Pedido'}
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default RequestEntryCard;