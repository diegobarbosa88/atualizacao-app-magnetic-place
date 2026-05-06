import React, { useState } from 'react';
import { Megaphone, Bell, Loader2, Plus, Trash2, X } from 'lucide-react';

const NotificationsAdmin = ({ workers, appNotifications, saveToDb, handleDelete }) => {
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [type, setType] = useState('info');
  const [targetType, setTargetType] = useState('all');
  const [isDismissible, setIsDismissible] = useState(true);
  const [selectedWorkers, setSelectedWorkers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showViewDetails, setShowViewDetails] = useState(null); // ID do aviso para ver detalhes
  const [viewDetailsTab, setViewDetailsTab] = useState('viewed'); // 'viewed' | 'dismissed'

  const handleAdd = async () => {
    if (!title || !message) return alert('Preencha o título e a mensagem!');
    setLoading(true);
    const id = "notif_" + Date.now();
    const newNotif = {
      id,
      title,
      message,
      type,
      target_type: targetType,
      target_worker_ids: targetType === 'specific' ? selectedWorkers : [],
      is_dismissible: isDismissible,
      is_active: true,
      created_at: new Date().toISOString()
    };
    await saveToDb('app_notifications', id, newNotif);
    setTitle('');
    setMessage('');
    setSelectedWorkers([]);
    setLoading(false);
    alert('Aviso criado com sucesso!');
  };

  const toggleStatus = async (notif) => {
    const updated = { ...notif, is_active: !notif.is_active };
    await saveToDb('app_notifications', notif.id, updated);
  };

  return (
    <div className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-slate-100 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center gap-3 mb-8 border-b border-slate-50 pb-6">
        <div className="bg-amber-50 p-2 rounded-xl text-amber-600">
          <Megaphone size={20} />
        </div>
        <h3 className="font-black text-xl text-slate-800 uppercase tracking-tight">Gestão de Banners de Aviso</h3>
      </div>

      <div className="bg-slate-50/50 rounded-[2rem] p-6 mb-8 border border-slate-100">
        <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-4 ml-1">Criar Novo Aviso</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div className="space-y-1">
            <label className="text-[9px] font-bold text-slate-400 ml-2 uppercase">Título do Banner</label>
            <input
              className="w-full p-3 rounded-xl border border-slate-200 bg-white text-sm outline-none font-medium"
              placeholder="Ex: Reunião Geral"
              value={title}
              onChange={e => setTitle(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <label className="text-[9px] font-bold text-slate-400 ml-2 uppercase">Tipo / Estilo</label>
            <select
              className="w-full p-3 rounded-xl border border-slate-200 bg-white text-sm outline-none font-medium"
              value={type}
              onChange={e => setType(e.target.value)}
            >
              <option value="info">Informação (Azul)</option>
              <option value="warning">Aviso (Laranja)</option>
              <option value="urgent">Urgente (Vermelho)</option>
              <option value="success">Sucesso (Verde)</option>
            </select>
          </div>
          <div className="flex items-center gap-3 bg-white p-3 rounded-xl border border-slate-200">
            <input
              type="checkbox"
              id="dismissible"
              checked={isDismissible}
              onChange={e => setIsDismissible(e.target.checked)}
              className="w-4 h-4 rounded text-indigo-600 cursor-pointer"
            />
            <label htmlFor="dismissible" className="text-[10px] font-bold text-slate-600 uppercase cursor-pointer">
              Permitir que o trabalhador feche este aviso
            </label>
          </div>
        </div>
        <div className="space-y-1 mb-4">
          <label className="text-[9px] font-bold text-slate-400 ml-2 uppercase">Mensagem</label>
          <textarea
            className="w-full p-3 rounded-xl border border-slate-200 bg-white text-sm outline-none font-medium h-20"
            placeholder="Escreva aqui o conteúdo do aviso..."
            value={message}
            onChange={e => setMessage(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div className="space-y-1">
            <label className="text-[9px] font-bold text-slate-400 ml-2 uppercase">Público-Alvo</label>
            <select
              className="w-full p-3 rounded-xl border border-slate-200 bg-white text-sm outline-none font-medium"
              value={targetType}
              onChange={e => setTargetType(e.target.value)}
            >
              <option value="all">Todos os Trabalhadores</option>
              <option value="specific">Apenas trabalhadores selecionados</option>
            </select>
          </div>
          {targetType === 'specific' && (
            <div className="space-y-1">
              <label className="text-[9px] font-bold text-slate-400 ml-2 uppercase">Selecionar Trabalhadores</label>
              <div className="flex flex-wrap gap-2 p-2 min-h-[42px] rounded-xl border border-slate-200 bg-white">
                {workers.map(w => (
                  <button
                    key={w.id}
                    onClick={() => {
                      setSelectedWorkers(prev =>
                        prev.includes(w.id) ? prev.filter(id => id !== w.id) : [...prev, w.id]
                      )
                    }}
                    className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all ${selectedWorkers.includes(w.id) ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400'}`}
                  >
                    {w.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        <button
          onClick={handleAdd}
          disabled={loading}
          className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black uppercase text-xs tracking-widest flex items-center justify-center gap-3 shadow-lg active:scale-[0.98] transition-all"
        >
          {loading ? <Loader2 className="animate-spin" size={18} /> : <Plus size={18} />} Criar Aviso no App
        </button>
      </div>

      <div className="space-y-3">
        <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Avisos Existentes</p>
        {appNotifications.length === 0 ? (
          <p className="text-center py-10 text-slate-400 text-xs font-bold">Nenhum aviso criado.</p>
        ) : (
          appNotifications.filter(n =>
            n.is_active &&
            !n.title?.includes('Pedido de Correção') &&
            !n.title?.includes('Contra-proposta')
          ).map(notif => (
            <div key={notif.id} className="bg-white p-4 rounded-3xl border border-slate-100 flex items-center justify-between shadow-sm hover:shadow-md transition-all">
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-2xl ${notif.type === 'urgent' ? 'bg-rose-50 text-rose-600' :
                  notif.type === 'warning' ? 'bg-amber-50 text-amber-600' :
                    notif.type === 'success' ? 'bg-emerald-50 text-emerald-600' :
                      'bg-blue-50 text-blue-600'
                  }`}>
                  <Bell size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-black text-slate-800 truncate">{notif.title}</p>
                  <p className="text-[10px] text-slate-400 truncate">{notif.message}</p>
                  <p className="text-[9px] font-bold text-indigo-500 uppercase mt-1">
                    🎯 {notif.target_type === 'all' ? 'Todos' : `${notif.target_worker_ids?.length || 0} específicos`} • {notif.is_dismissible ? 'Fechável' : 'Fixo'}
                  </p>
                  <div
                    onClick={() => setShowViewDetails(notif.id)}
                    className="mt-2 flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
                  >
                    <div className="flex -space-x-2">
                      {(notif.viewed_by_ids || []).slice(0, 5).map(vId => (
                        <div key={vId} title={workers.find(w => w.id === vId)?.name} className="w-5 h-5 rounded-full bg-indigo-100 border-2 border-white flex items-center justify-center text-[8px] font-black text-indigo-600 uppercase">
                          {workers.find(w => w.id === vId)?.name?.[0] || '?'}
                        </div>
                      ))}
                      {(notif.viewed_by_ids || []).length > 5 && (
                        <div className="w-5 h-5 rounded-full bg-slate-100 border-2 border-white flex items-center justify-center text-[7px] font-black text-slate-500">
                          +{(notif.viewed_by_ids || []).length - 5}
                        </div>
                      )}
                    </div>
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                      {(notif.viewed_by_ids || []).length} Viu
                    </span>
                    {notif.is_dismissible && (
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-2">
                        • {(notif.dismissed_by_ids || []).length} Fechou
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => toggleStatus(notif)}
                  className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all ${notif.is_active ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'
                    }`}
                >
                  {notif.is_active ? 'Ativo' : 'Pausado'}
                </button>
                <button
                  onClick={() => handleDelete('app_notifications', notif.id)}
                  className="p-2 text-rose-300 hover:text-rose-600 transition-all"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal de Detalhes de Visualização */}
      {showViewDetails && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl p-8 animate-in zoom-in-95 duration-300">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-xl font-black text-slate-800 uppercase tracking-tighter">Detalhes do Aviso</h3>
                <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mt-1">Registo de Interação</p>
              </div>
              <button onClick={() => setShowViewDetails(null)} className="p-2 hover:bg-slate-100 rounded-full text-slate-400"><X size={20} /></button>
            </div>

            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setViewDetailsTab('viewed')}
                className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${viewDetailsTab === 'viewed' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400'}`}
              >
                Visualizaram ({(appNotifications.find(n => n.id === showViewDetails)?.viewed_by_ids || []).length})
              </button>
              {appNotifications.find(n => n.id === showViewDetails)?.is_dismissible && (
                <button
                  onClick={() => setViewDetailsTab('dismissed')}
                  className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${viewDetailsTab === 'dismissed' ? 'bg-rose-500 text-white' : 'bg-slate-100 text-slate-400'}`}
                >
                  Fecharam ({(appNotifications.find(n => n.id === showViewDetails)?.dismissed_by_ids || []).length})
                </button>
              )}
            </div>

            <div className="space-y-3 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
              {(appNotifications.find(n => n.id === showViewDetails)?.[viewDetailsTab === 'viewed' ? 'viewed_by_ids' : 'dismissed_by_ids'] || []).length > 0 ? (
                (appNotifications.find(n => n.id === showViewDetails)?.[viewDetailsTab === 'viewed' ? 'viewed_by_ids' : 'dismissed_by_ids'] || []).map(vId => {
                  const worker = workers.find(w => w.id === vId);
                  return (
                    <div key={vId} className="flex items-center gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-100">
                      <div className={`w-8 h-8 rounded-full text-white flex items-center justify-center font-black text-xs uppercase ${viewDetailsTab === 'viewed' ? 'bg-indigo-600' : 'bg-rose-500'}`}>
                        {worker?.name?.[0] || '?'}
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-800">{worker?.name || 'Desconhecido'}</p>
                        <p className="text-[9px] font-bold text-slate-400 uppercase">{worker?.profissao || 'Colaborador'}</p>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-8">
                  <p className="text-sm font-bold text-slate-400 italic">Nenhum registo encontrado.</p>
                </div>
              )}
            </div>

            <button
              onClick={() => setShowViewDetails(null)}
              className="w-full mt-6 py-4 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-800 transition-all"
            >
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationsAdmin;
