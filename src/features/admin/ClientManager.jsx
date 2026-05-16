import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { useClient, ClientProvider } from './contexts/ClientContext';
import { 
  Briefcase, LayoutGrid, List, Edit2, Trash2, MapPin, Euro, X, Save, Building2, CreditCard, Mail, CalendarRange, Check
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
  const [editingHistoryId, setEditingHistoryId] = useState(null);
  const [editingHistoryDraft, setEditingHistoryDraft] = useState({});
  const [confirmDeleteHistoryId, setConfirmDeleteHistoryId] = useState(null);
  const [confirmDeleteClientId, setConfirmDeleteClientId] = useState(null);

  // D-07: Função para carregar histórico
  const loadClientValorHoraHistory = async (clientId, clientName) => {
    if (!supabase) return;
    const { data } = await supabase
      .from('client_valorhora_history')
      .select('*')
      .eq('client_id', clientId)
      .order('data_alteracao', { ascending: false });
    setClientValorHoraHistory(data || []);
    setShowClientHistory(prev => ({ ...prev, show: true, clientId, clientName }));
  };

  const handleSaveClientHistory = async (h) => {
    if (!supabase) return;
    const draft = {
      valor_anterior: editingHistoryDraft.valor_anterior,
      valor_novo: editingHistoryDraft.valor_novo,
      data_alteracao: editingHistoryDraft.data_alteracao,
    };
    await supabase.from('client_valorhora_history').update(draft).eq('id', h.id);
    setEditingHistoryId(null);
    await loadClientValorHoraHistory(showClientHistory.clientId, showClientHistory.clientName);
  };

  const handleDeleteClientHistory = async (id) => {
    if (!supabase) return;
    const { error } = await supabase.from('client_valorhora_history').delete().eq('id', id);
    if (error) { alert('Erro ao apagar: ' + error.message); return; }
    setConfirmDeleteHistoryId(null);
    await loadClientValorHoraHistory(showClientHistory.clientId, showClientHistory.clientName);
  };

  const openEditClient = async (c) => {
    let dataAlteracao = new Date().toISOString().split('T')[0];
    if (supabase) {
      const { data } = await supabase
        .from('client_valorhora_history')
        .select('data_alteracao')
        .eq('client_id', c.id)
        .order('data_alteracao', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data?.data_alteracao) dataAlteracao = data.data_alteracao.split('T')[0];
    }
    setClientForm({ ...c, dataAlteracao });
    setIsAddingInTab(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
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
      <div className="flex justify-between items-center gap-3 mb-5">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-50 p-2 rounded-xl text-indigo-600"><Briefcase size={20} /></div>
          <h3 className="font-black text-base sm:text-xl text-slate-800 uppercase tracking-tight">Gestão Comercial</h3>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl p-1">
            <button onClick={() => setClientsView('grid')} className={`p-2 rounded-lg transition-all ${clientsView === 'grid' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-indigo-600'}`} title="Vista em Grade"><LayoutGrid size={18} /></button>
            <button onClick={() => setClientsView('list')} className={`p-2 rounded-lg transition-all ${clientsView === 'list' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-indigo-600'}`} title="Vista em Lista"><List size={18} /></button>
          </div>
          <button onClick={() => { setClientForm({ id: null, name: '', morada: '', nif: '', valorHora: '', email: '', dataAlteracao: new Date().toISOString().split('T')[0] }); setIsAddingInTab(!isAddingInTab); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className={`px-3 sm:px-5 py-2 rounded-xl font-black text-xs uppercase shadow-lg transition-all whitespace-nowrap ${isAddingInTab ? 'bg-slate-200 text-slate-600' : 'bg-indigo-600 text-white'}`}>{isAddingInTab ? 'Voltar' : 'Novo'}</button>
        </div>
      </div>

      {isAddingInTab && (
        <div className="mb-6 bg-white p-4 sm:p-6 lg:p-10 rounded-2xl sm:rounded-[2.5rem] shadow-xl border border-slate-100">
          <div className="flex justify-between items-center mb-5 border-b border-slate-100 pb-4">
            <h3 className="text-lg sm:text-2xl font-black text-slate-800 flex items-center gap-2">
              <Building2 className="text-indigo-600" size={22} />
              {clientForm.id ? 'Editar Cliente' : 'Novo Cliente'}
            </h3>
            <button onClick={() => setIsAddingInTab(false)} className="text-slate-400 hover:text-slate-800 transition-colors flex items-center gap-2 font-bold text-xs uppercase tracking-wider bg-slate-50 hover:bg-slate-100 px-4 py-2 rounded-xl">
              <X size={16} /> Fechar Form
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* COLUNA ESQUERDA (8 colunas) */}
            <div className="lg:col-span-8 space-y-8">
              
              {/* DADOS DO CLIENTE */}
              <div className="bg-slate-50/50 p-6 rounded-[2rem] border border-slate-100 space-y-6">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-indigo-100 text-indigo-600 rounded-xl"><Briefcase size={18} /></div>
                  <h4 className="font-black text-slate-700 text-lg uppercase tracking-tight">Dados do Cliente</h4>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider ml-1 flex items-center gap-1"><Building2 size={10} /> Empresa</label>
                    <input type="text" value={clientForm.name} onChange={e => setClientForm({ ...clientForm, name: e.target.value })} className="w-full bg-white border border-slate-200 rounded-xl p-4 text-sm font-bold outline-none shadow-sm focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50 transition-all" placeholder="Nome da empresa" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider ml-1 flex items-center gap-1"><CreditCard size={10} /> NIF</label>
                    <input type="text" value={clientForm.nif || ''} onChange={e => setClientForm({ ...clientForm, nif: e.target.value })} className="w-full bg-white border border-slate-200 rounded-xl p-4 text-sm font-bold outline-none shadow-sm focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50 transition-all" placeholder="Nº de Contribuinte" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider ml-1 flex items-center gap-1"><Mail size={10} /> E-mail de Contato</label>
                    <input type="email" value={clientForm.email || ''} onChange={e => setClientForm({ ...clientForm, email: e.target.value })} className="w-full bg-white border border-slate-200 rounded-xl p-4 text-sm font-bold outline-none shadow-sm focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50 transition-all" placeholder="email@exemplo.pt" />
                  </div>
                  <div className="space-y-1 md:col-span-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider ml-1 flex items-center gap-1"><MapPin size={10} /> Morada</label>
                    <input type="text" value={clientForm.morada || ''} onChange={e => setClientForm({ ...clientForm, morada: e.target.value })} className="w-full bg-white border border-slate-200 rounded-xl p-4 text-sm font-bold outline-none shadow-sm focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50 transition-all" placeholder="Morada completa" />
                  </div>
                </div>
              </div>

              {/* DADOS FINANCEIROS */}
              <div className="bg-emerald-50/30 p-6 rounded-[2rem] border border-emerald-100 space-y-6">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-emerald-100 text-emerald-600 rounded-xl"><Euro size={18} /></div>
                  <h4 className="font-black text-emerald-800 text-lg uppercase tracking-tight">Dados Financeiros</h4>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2 border-t border-emerald-100/50">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-emerald-600/70 uppercase tracking-wider ml-1 flex items-center gap-1"><Euro size={10} /> Valor Hora (€)</label>
                    <input type="number" step="0.01" value={clientForm.valorHora || ''} onChange={e => setClientForm({ ...clientForm, valorHora: e.target.value })} className="w-full bg-white border border-emerald-100 rounded-xl p-4 text-lg text-emerald-700 font-black outline-none shadow-sm focus:border-emerald-400 focus:ring-4 focus:ring-emerald-50 transition-all" placeholder="0.00" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-emerald-600/70 uppercase tracking-wider ml-1 flex items-center gap-1"><CalendarRange size={10} /> Valor válido desde</label>
                    <input type="date" value={clientForm.dataAlteracao || ''} onChange={e => setClientForm({ ...clientForm, dataAlteracao: e.target.value })} className="w-full bg-white border border-emerald-100 rounded-xl p-4 text-sm font-bold outline-none shadow-sm focus:border-emerald-400 focus:ring-4 focus:ring-emerald-50 transition-all" />
                  </div>
                </div>
              </div>
            </div>

            {/* COLUNA DIREITA (4 colunas) */}
            <div className="lg:col-span-4 space-y-6 flex flex-col">
              <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100 flex-1">
                <div className="flex items-center gap-2 mb-4">
                  <Briefcase size={16} className="text-indigo-600" />
                  <h4 className="font-black text-slate-700 text-sm uppercase tracking-widest">Informação Adicional</h4>
                </div>
                <p className="text-xs text-slate-500 mb-4">
                  Ao atualizar o valor/hora de um cliente, todos os registos futuros e os pendentes do mês atual serão atualizados com o novo valor.
                </p>
                <p className="text-xs text-slate-500">
                  Regista a morada e os detalhes de faturação para constarem nos relatórios enviados.
                </p>
              </div>

              {/* AÇÕES */}
              <div className="pt-2">
                <button onClick={handleSaveClient} className="w-full bg-indigo-600 hover:bg-indigo-700 hover:-translate-y-1 text-white p-5 rounded-[1.5rem] font-black text-sm uppercase shadow-lg shadow-indigo-200 transition-all flex items-center justify-center gap-3 border border-indigo-500">
                  <Save size={20} />
                  Gravar Cliente
                </button>
              </div>
            </div>
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
                    <span>{c.valorHora ? `${c.valorHora}€` : 'N/A'}</span>
                  </td>
                  <td className="text-right">
                    <div className="flex justify-end gap-1">
                      <button onClick={() => loadClientValorHoraHistory(c.id, c.name)} className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all text-xs" title="Histórico">📊</button>
                      <button onClick={() => { openEditClient(c); }} className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-all" title="Editar"><Edit2 size={13} /></button>
                      {confirmDeleteClientId === c.id ? (
                        <div className="flex items-center gap-1">
                          <button onClick={() => { handleDeleteClient(c.id); setConfirmDeleteClientId(null); }} className="px-2 py-1 bg-red-600 text-white text-xs font-bold rounded-lg">Sim</button>
                          <button onClick={() => setConfirmDeleteClientId(null)} className="px-2 py-1 bg-slate-200 text-slate-600 text-xs font-bold rounded-lg">Não</button>
                        </div>
                      ) : (
                        <button onClick={() => setConfirmDeleteClientId(c.id)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all" title="Apagar"><Trash2 size={13} /></button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {sortedClients.map(c => (
            <div key={c.id} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md hover:border-indigo-200 hover:-translate-y-0.5 transition-all duration-200">
              {/* Header */}
              <div className="flex justify-between items-start mb-3">
                <div className="px-2.5 py-1 rounded-full text-[9px] font-black uppercase border flex items-center gap-1 text-indigo-600 border-indigo-200 bg-indigo-50">
                  <Briefcase size={10} /> Cliente
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => loadClientValorHoraHistory(c.id, c.name)} className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all border border-slate-100 text-xs" title="Histórico">📊</button>
                  <button onClick={() => { openEditClient(c); }} className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-lg transition-all border border-amber-100" title="Editar"><Edit2 size={12} /></button>
                  {confirmDeleteClientId === c.id ? (
                    <div className="flex items-center gap-1">
                      <button onClick={() => { handleDeleteClient(c.id); setConfirmDeleteClientId(null); }} className="px-2 py-1 bg-red-600 text-white text-xs font-bold rounded-lg">Sim</button>
                      <button onClick={() => setConfirmDeleteClientId(null)} className="px-2 py-1 bg-slate-200 text-slate-600 text-xs font-bold rounded-lg">Não</button>
                    </div>
                  ) : (
                    <button onClick={() => setConfirmDeleteClientId(c.id)} className="p-1.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all border border-slate-100"><Trash2 size={12} /></button>
                  )}
                </div>
              </div>
              {/* Name */}
              <h4 className="font-black text-slate-800 text-sm uppercase truncate mb-0.5">{c.name}</h4>
              <p className="text-[10px] text-slate-400 font-bold truncate mb-3">{c.nif || 'Sem NIF'}</p>
              {/* Info */}
              <div className="text-[10px] text-slate-400 font-bold space-y-1 border-t border-slate-50 pt-2">
                <div className="flex items-center gap-1.5"><MapPin size={10} /> {c.morada || 'Sem morada'}</div>
                <div className="flex items-center gap-1.5"><Euro size={10} /> {c.valorHora ? `${c.valorHora}€/h` : 'N/A'}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* D-07: Modal de Histórico de Valor Hora do Cliente */}
      {showClientHistory.show && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => { setShowClientHistory({ show: false, clientId: null, clientName: '' }); setEditingHistoryId(null); }}>
          <div className="bg-white p-6 rounded-2xl max-w-md w-full mx-4 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-black text-indigo-700">Histórico de Valor Hora</h3>
              <button onClick={() => { setShowClientHistory({ show: false, clientId: null, clientName: '' }); setEditingHistoryId(null); }} className="text-slate-400 hover:text-slate-600 text-2xl">&times;</button>
            </div>
            <p className="text-sm font-bold text-slate-500 mb-4">{showClientHistory.clientName}</p>
            {clientValorHoraHistory.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-4">Sem histórico disponível</p>
            ) : (
              <div className="space-y-3 max-h-80 overflow-y-auto">
                {clientValorHoraHistory.map(h => (
                  <div key={h.id}>
                    {editingHistoryId === h.id ? (
                      <div className="flex flex-wrap items-center gap-2 p-3 bg-indigo-50 rounded-xl border border-indigo-200">
                        <input type="number" step="0.01" value={editingHistoryDraft.valor_anterior || ''} onChange={e => setEditingHistoryDraft(d => ({ ...d, valor_anterior: e.target.value }))} className="w-16 border border-slate-300 rounded-lg p-1 text-xs font-bold" placeholder="Ant." />
                        <span className="text-slate-400 text-xs">→</span>
                        <input type="number" step="0.01" value={editingHistoryDraft.valor_novo || ''} onChange={e => setEditingHistoryDraft(d => ({ ...d, valor_novo: e.target.value }))} className="w-16 border border-slate-300 rounded-lg p-1 text-xs font-bold" placeholder="Novo" />
                        <input type="date" value={editingHistoryDraft.data_alteracao ? editingHistoryDraft.data_alteracao.split('T')[0] : ''} onChange={e => setEditingHistoryDraft(d => ({ ...d, data_alteracao: e.target.value }))} className="border border-slate-300 rounded-lg p-1 text-xs font-bold flex-1 min-w-0" />
                        <button onClick={() => handleSaveClientHistory(h)} className="p-1 text-green-600 hover:bg-green-50 rounded-lg"><Check size={14} /></button>
                        <button onClick={() => setEditingHistoryId(null)} className="p-1 text-slate-400 hover:bg-slate-100 rounded-lg"><X size={14} /></button>
                      </div>
                    ) : confirmDeleteHistoryId === h.id ? (
                      <div className="flex items-center justify-between p-3 bg-red-50 rounded-xl border border-red-200">
                        <span className="text-xs font-bold text-red-600">Apagar este registo?</span>
                        <div className="flex gap-2">
                          <button onClick={() => handleDeleteClientHistory(h.id)} className="px-2 py-1 bg-red-600 text-white text-xs font-bold rounded-lg">Sim</button>
                          <button onClick={() => setConfirmDeleteHistoryId(null)} className="px-2 py-1 bg-slate-200 text-slate-600 text-xs font-bold rounded-lg">Não</button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex justify-between items-center p-3 bg-slate-50 rounded-xl">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-slate-600">{h.valor_anterior || 'N/A'}€</span>
                          <span className="text-slate-400">→</span>
                          <span className="text-sm font-bold text-indigo-600">{h.valor_novo}€</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-slate-400">{new Date(h.data_alteracao).toLocaleDateString('pt-PT')}</span>
                          <button onClick={() => { setEditingHistoryId(h.id); setEditingHistoryDraft(h); }} className="p-1 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg"><Edit2 size={12} /></button>
                          <button onClick={() => setConfirmDeleteHistoryId(h.id)} className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 size={12} /></button>
                        </div>
                      </div>
                    )}
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
