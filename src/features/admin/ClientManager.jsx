import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { useClient, ClientProvider } from './contexts/ClientContext';
import { 
  Briefcase, LayoutGrid, List, Edit2, Trash2, MapPin, Euro 
} from 'lucide-react';

const ClientManagerContent = () => {
  const { clients, supabase } = useApp();

  const {
    isAddingInTab, setIsAddingInTab,
    clientsView, setClientsView,
    clientsSort, setClientsSort,
    clientForm, setClientForm,
    handleSaveClient,
    handleDeleteClient
  } = useClient();

  // D-07: Estado para histórico de valor hora do cliente
  const [showClientHistory, setShowClientHistory] = useState({ show: false, clientId: null, clientName: '' });
  const [clientValorHoraHistory, setClientValorHoraHistory] = useState([]);

  // D-07: Função para carregar histórico
  const loadClientValorHoraHistory = async (clientId, clientName) => {
    if (!supabase) return;
    const { data } = await supabase
      .from('client_valorhora_history')
      .select('*')
      .eq('client_id', clientId)
      .order('data_alteracao', { ascending: false });
    setClientValorHoraHistory(data || []);
    setShowClientHistory({ show: true, clientId, clientName });
  };

  const sortedClients = [...clients].sort((a, b) => {
    let res = 0;
    if (clientsSort.key === 'name') res = a.name.localeCompare(b.name);
    if (clientsSort.key === 'nif') res = (a.nif || '').localeCompare(b.nif || '');
    if (clientsSort.key === 'morada') res = (a.morada || '').localeCompare(b.morada || '');
    if (clientsSort.key === 'value') res = (Number(a.valorHora) || 0) - (Number(b.valorHora) || 0);
    return clientsSort.direction === 'asc' ? res : -res;
  });

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-3xl font-black flex items-center gap-3"><Briefcase size={32} className="text-indigo-600" /> Gestão Comercial</h2>
        <div className="flex items-center gap-4">
          <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl p-1">
            <button onClick={() => setClientsView('grid')} className={`p-2 rounded-lg transition-all ${clientsView === 'grid' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-indigo-600'}`} title="Vista em Grade"><LayoutGrid size={18} /></button>
            <button onClick={() => setClientsView('list')} className={`p-2 rounded-lg transition-all ${clientsView === 'list' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-indigo-600'}`} title="Vista em Lista"><List size={18} /></button>
          </div>
          <button onClick={() => { setClientForm({ id: null, name: '', morada: '', nif: '', valorHora: '', email: '', dataAlteracao: new Date().toISOString().split('T')[0] }); setIsAddingInTab(!isAddingInTab); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className={`px-6 py-3 rounded-2xl font-black text-xs uppercase shadow-lg transition-all ${isAddingInTab ? 'bg-slate-200 text-slate-600' : 'bg-indigo-600 text-white'}`}>{isAddingInTab ? 'Voltar' : 'Registar Cliente'}</button>
        </div>
      </div>

      {isAddingInTab && (
        <div className="mb-10 bg-white p-10 rounded-[3rem] shadow-xl border-2 border-indigo-100">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase ml-1">Empresa</label><input type="text" value={clientForm.name} onChange={e => setClientForm({ ...clientForm, name: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm outline-none shadow-sm" /></div>
            <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase ml-1">NIF</label><input type="text" value={clientForm.nif} onChange={e => setClientForm({ ...clientForm, nif: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm outline-none shadow-sm" /></div>
            <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase ml-1">Valor/h (€)</label>
              <div className="flex gap-2">
                <input type="number" value={clientForm.valorHora} onChange={e => setClientForm({ ...clientForm, valorHora: e.target.value })} className="flex-1 bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm font-bold outline-none shadow-sm" />
                <div className="flex flex-col gap-1">
                  <label className="text-[8px] font-black text-slate-400 uppercase">Valor válido desde</label>
                  <input type="date" value={clientForm.dataAlteracao || ''} onChange={e => setClientForm({ ...clientForm, dataAlteracao: e.target.value })} className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-bold outline-none shadow-sm w-36" />
                </div>
              </div>
            </div>
            <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase ml-1">E-mail de Contato</label><input type="email" value={clientForm.email || ''} onChange={e => setClientForm({ ...clientForm, email: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm outline-none shadow-sm" placeholder="email@exemplo.pt" /></div>
            <div className="space-y-1 md:col-span-2"><label className="text-[10px] font-black text-slate-400 uppercase ml-1">Morada</label><input type="text" value={clientForm.morada} onChange={e => setClientForm({ ...clientForm, morada: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm outline-none shadow-sm" /></div>
          </div>
          <div className="mt-6 flex justify-end gap-3">
            <button onClick={() => setIsAddingInTab(false)} className="px-6 py-3 text-slate-400 font-bold uppercase text-xs">Cancelar</button>
            <button onClick={handleSaveClient} className="bg-indigo-600 text-white px-8 py-3 rounded-xl font-black text-xs uppercase shadow-lg">Salvar</button>
          </div>
        </div>
      )}

      {clientsView === 'list' ? (
        <div className="overflow-x-auto">
          <table className="admin-table">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th onClick={() => setClientsSort(prev => ({ key: 'name', direction: prev.key === 'name' && prev.direction === 'asc' ? 'desc' : 'asc' }))} className="text-left text-xs font-bold text-slate-400 uppercase tracking-wider cursor-pointer hover:text-indigo-600 transition-colors">Cliente {clientsSort.key === 'name' ? (clientsSort.direction === 'asc' ? '↑' : '↓') : ''}</th>
                <th className="text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Morada</th>
                <th onClick={() => setClientsSort(prev => ({ key: 'value', direction: prev.key === 'value' && prev.direction === 'asc' ? 'desc' : 'asc' }))} className="text-left text-xs font-bold text-slate-400 uppercase tracking-wider cursor-pointer hover:text-indigo-600 transition-colors">Valor Hora {clientsSort.key === 'value' ? (clientsSort.direction === 'asc' ? '↑' : '↓') : ''}</th>
                <th className="text-right text-xs font-bold text-slate-400 uppercase tracking-wider">Ações</th>
              </tr>
            </thead>
            <tbody>
              {sortedClients.map(c => (
                <tr key={c.id} className="border-b border-slate-100 hover:bg-indigo-50/40 transition-all even:bg-slate-50/50 last:border-b-0 group">
                  <td className="relative">
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                    <p className="font-black text-slate-900 text-sm uppercase truncate">{c.name}</p>
                    <p className="text-xs text-slate-400 truncate">NIF: {c.nif || 'N/A'}</p>
                  </td>
                  <td className="text-sm font-bold text-slate-500 truncate">{c.morada || 'N/A'}</td>
                  <td className="text-sm text-indigo-600 font-black">
                    <div className="flex items-center gap-1">
                      <span className="truncate">{c.valorHora ? `${c.valorHora}€` : 'N/A'}</span>
                      <button 
                        onClick={() => loadClientValorHoraHistory(c.id, c.name)}
                        className="ml-1 text-xs text-slate-400 hover:text-indigo-600 p-1 rounded hover:bg-indigo-50"
                        title="Ver histórico"
                      >
                        📊
                      </button>
                    </div>
                  </td>
                  <td className="text-right">
                    <div className="flex justify-end gap-2">
                      <button onClick={() => { setClientForm({ ...c, dataAlteracao: new Date().toISOString().split('T')[0] }); setIsAddingInTab(true); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="p-2.5 text-slate-400 hover:text-amber-500 hover:bg-amber-50 rounded-lg transition-all" title="Editar"><Edit2 size={16} /></button>
                      <button onClick={() => handleDeleteClient(c.id)} className="p-2.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all" title="Apagar"><Trash2 size={16} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sortedClients.map(c => (
            <div key={c.id} className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm hover:border-indigo-200 transition-all">
              <div className="flex justify-between items-start mb-4">
                <div className="p-3 bg-indigo-50 rounded-2xl text-indigo-600"><Briefcase size={24} /></div>
                <div className="flex gap-2">
                  <button onClick={() => { setClientForm({ ...c, dataAlteracao: new Date().toISOString().split('T')[0] }); setIsAddingInTab(true); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="p-2 bg-slate-50 rounded-lg text-amber-500 hover:bg-amber-500 hover:text-white transition-all"><Edit2 size={14} /></button>
                  <button onClick={() => handleDeleteClient(c.id)} className="p-2 bg-slate-50 rounded-lg text-red-500 hover:bg-red-500 hover:text-white transition-all"><Trash2 size={14} /></button>
                </div>
              </div>
              <h4 className="text-xl font-black text-indigo-700 mb-1">{c.name}</h4>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b pb-4 mb-4">{c.nif || 'Sem NIF'}</p>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-500"><MapPin size={12} /> {c.morada || 'Sem morada'}</div>
                <div className="flex items-center gap-2 text-xs font-bold text-slate-500"><Euro size={12} /> Valor/h: <span className="text-indigo-600">{c.valorHora ? `${c.valorHora}€` : 'N/A'}</span></div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* D-07: Modal de Histórico de Valor Hora do Cliente */}
      {showClientHistory.show && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowClientHistory({ show: false, clientId: null, clientName: '' })}>
          <div className="bg-white p-6 rounded-2xl max-w-md w-full mx-4 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-black text-indigo-700">Histórico de Valor Hora</h3>
              <button onClick={() => setShowClientHistory({ show: false, clientId: null, clientName: '' })} className="text-slate-400 hover:text-slate-600 text-2xl">&times;</button>
            </div>
            <p className="text-sm font-bold text-slate-500 mb-4">{showClientHistory.clientName}</p>
            {clientValorHoraHistory.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-4">Sem histórico disponível</p>
            ) : (
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {clientValorHoraHistory.map(h => (
                  <div key={h.id} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-slate-600">{h.valor_anterior || 'N/A'}€</span>
                      <span className="text-slate-400">→</span>
                      <span className="text-sm font-bold text-indigo-600">{h.valor_novo}€</span>
                    </div>
                    <span className="text-xs text-slate-400">{new Date(h.data_alteracao).toLocaleDateString('pt-PT')}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const ClientManager = () => {
  return (
    <ClientProvider>
      <ClientManagerContent />
    </ClientProvider>
  );
};

export default ClientManager;
