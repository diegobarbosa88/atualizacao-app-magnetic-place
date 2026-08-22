import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { useClient, ClientProvider } from './contexts/ClientContext';
import {
  Briefcase, LayoutGrid, List, Edit2, Trash2, MapPin, Euro, ShieldOff, Send, AlertTriangle, Shield, Search, MoreVertical, Check, X, Building2, Save
} from 'lucide-react';
import ClientForm from './client/ClientForm';
import ClientEnviosPanel from './client/ClientEnviosPanel';
import CorrectionsInbox from './corrections/CorrectionsInbox';
import ClientPortalAuditPanel from './client/ClientPortalAuditPanel';
import ModalShell from '../../components/common/ModalShell';

const ClientManagerContent = ({ setClienteSelecionado, setModalEmailAberto, setPrintingReport, portalMonth, setPortalMonth }) => {
  const { clients, supabase, corrections } = useApp();

  const pendingClientCorrections = (corrections || []).filter(c =>
    c.type !== 'creation_request' && c.type !== 'deletion_request' &&
    (c.status === 'submitted' || c.status === 'under_review' || c.status === 'pending')
  ).length;

  const [searchParams] = useSearchParams();
  const [clientSubTab, setClientSubTab] = useState(() => searchParams.get('subtab') || 'list');

  useEffect(() => {
    const tab = searchParams.get('subtab');
    if (tab) setClientSubTab(tab);
  }, [searchParams]);

  const {
    isAddingInTab, setIsAddingInTab,
    clientsView, setClientsView,
    clientsSearch, setClientsSearch,
    clientsSort, setClientsSort,
    clientForm, setClientForm,
    handleDeleteClient,
    handleSaveClient
  } = useClient();

  // D-07: Estado para histórico de valor hora do cliente
  const [showClientHistory, setShowClientHistory] = useState({ show: false, clientId: null, clientName: '' });
  const [clientValorHoraHistory, setClientValorHoraHistory] = useState([]);
  const [editingHistoryId, setEditingHistoryId] = useState(null);
  const [editingHistoryDraft, setEditingHistoryDraft] = useState({});
  const [confirmDeleteHistoryId, setConfirmDeleteHistoryId] = useState(null);
  const [confirmDeleteClientId, setConfirmDeleteClientId] = useState(null);
  const [openMenuId, setOpenMenuId] = useState(null);

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
  };

  const sortedClients = [...clients].filter(c =>
    !clientsSearch || c.name.toLowerCase().includes(clientsSearch.toLowerCase()) || (c.nif || '').toLowerCase().includes(clientsSearch.toLowerCase()) || (c.morada || '').toLowerCase().includes(clientsSearch.toLowerCase())
  ).sort((a, b) => {
    let res = 0;
    if (clientsSort.key === 'name') res = a.name.localeCompare(b.name);
    if (clientsSort.key === 'nif') res = (a.nif || '').localeCompare(b.nif || '');
    if (clientsSort.key === 'morada') res = (a.morada || '').localeCompare(b.morada || '');
    if (clientsSort.key === 'value') res = (Number(a.valorHora) || 0) - (Number(b.valorHora) || 0);
    return clientsSort.direction === 'asc' ? res : -res;
  });

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Sub-tab navigation */}
      <div className="flex flex-wrap items-end gap-1 mb-5 border-b border-slate-100">
        <button
          onClick={() => setClientSubTab('list')}
          className={`flex items-center gap-2 px-3 pb-2.5 pt-1 text-[11px] font-black uppercase tracking-wider transition-all border-b-2 -mb-px ${clientSubTab === 'list' ? 'border-[#EB8D00] text-[#1B3A57]' : 'border-transparent text-slate-400 hover:text-[#1B3A57]'}`}
        >
          <Building2 size={14} /> Clientes
        </button>
        <button
          onClick={() => setClientSubTab('envios')}
          className={`flex items-center gap-2 px-3 pb-2.5 pt-1 text-[11px] font-black uppercase tracking-wider transition-all border-b-2 -mb-px ${clientSubTab === 'envios' ? 'border-[#EB8D00] text-[#1B3A57]' : 'border-transparent text-slate-400 hover:text-[#1B3A57]'}`}
        >
          <Send size={14} /> Envios
        </button>
        <button
          onClick={() => setClientSubTab('correcoes')}
          className={`flex items-center gap-2 px-3 pb-2.5 pt-1 text-[11px] font-black uppercase tracking-wider transition-all border-b-2 -mb-px ${clientSubTab === 'correcoes' ? 'border-[#EB8D00] text-[#1B3A57]' : 'border-transparent text-slate-400 hover:text-[#1B3A57]'}`}
        >
          <AlertTriangle size={14} /> Correções
          {pendingClientCorrections > 0 && (
            <span className="bg-rose-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full">{pendingClientCorrections}</span>
          )}
        </button>
        <button
          onClick={() => setClientSubTab('auditoria')}
          className={`flex items-center gap-2 px-3 pb-2.5 pt-1 text-[11px] font-black uppercase tracking-wider transition-all border-b-2 -mb-px ${clientSubTab === 'auditoria' ? 'border-[#EB8D00] text-[#1B3A57]' : 'border-transparent text-slate-400 hover:text-[#1B3A57]'}`}
        >
          <Shield size={14} /> Auditoria Portal
        </button>
      </div>

      {clientSubTab === 'envios' && (
        <ClientEnviosPanel
          portalMonth={portalMonth}
          setPortalMonth={setPortalMonth}
          setClienteSelecionado={setClienteSelecionado}
          setModalEmailAberto={setModalEmailAberto}
          setPrintingReport={setPrintingReport}
        />
      )}

      {clientSubTab === 'correcoes' && (
        <CorrectionsInbox forcedSource="clients" />
      )}

      {clientSubTab === 'auditoria' && (
        <ClientPortalAuditPanel />
      )}

      {clientSubTab === 'list' && (<>
      <div className="flex flex-wrap justify-between items-center gap-3 mb-5">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl" style={{ backgroundColor: 'rgba(134,154,175,0.15)', color: '#869AAF' }}><Briefcase size={20} /></div>
          <h3 className="font-black text-base sm:text-xl text-slate-800 uppercase tracking-tight">Gestão Comercial</h3>
        </div>
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Pesquisar cliente..."
            value={clientsSearch}
            onChange={e => setClientsSearch(e.target.value)}
            className="pl-8 pr-3 py-2 text-xs border border-slate-200 rounded-xl bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[#1B3A57] w-48 sm:w-64"
          />
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl p-1">
            <button onClick={() => setClientsView('grid')} className={`p-2 rounded-lg transition-all ${clientsView === 'grid' ? 'text-white' : 'text-slate-400 hover:text-slate-600'}`} style={clientsView === 'grid' ? { backgroundColor: '#1B3A57' } : {}} title="Vista em Grade"><LayoutGrid size={18} /></button>
            <button onClick={() => setClientsView('list')} className={`p-2 rounded-lg transition-all ${clientsView === 'list' ? 'text-white' : 'text-slate-400 hover:text-slate-600'}`} style={clientsView === 'list' ? { backgroundColor: '#1B3A57' } : {}} title="Vista em Lista"><List size={18} /></button>
          </div>
          <button onClick={() => { setClientForm({ id: null, name: '', morada: '', nif: '', valorHora: '', email: '', dataAlteracao: new Date().toISOString().split('T')[0] }); setIsAddingInTab(true); }} className="px-3 sm:px-5 py-2 rounded-xl font-black text-xs uppercase shadow-lg transition-all whitespace-nowrap text-white" style={{ backgroundColor: '#EB8D00' }}>Novo</button>
        </div>
      </div>

      <ModalShell
        isOpen={isAddingInTab}
        onClose={() => setIsAddingInTab(false)}
        title={clientForm.name || (clientForm.id ? 'Editar Cliente' : 'Novo Cliente')}
        subtitle={clientForm.id ? 'Cliente · Ficha' : 'Cliente · Novo registo'}
        icon={<Briefcase size={16} />}
        accent="navyGradient"
        size="clientWide"
        footer={
          <div className="flex items-center justify-end gap-2.5 px-[2rem] pt-[1.1rem] pb-[1.3rem] border-t border-slate-100">
            <button
              onClick={() => setIsAddingInTab(false)}
              className="px-5 py-3 rounded-2xl border-[1.5px] border-slate-200 bg-white text-[11px] font-black uppercase tracking-wide text-slate-500 hover:bg-slate-50 transition-all"
            >
              Cancelar
            </button>
            <button
              onClick={handleSaveClient}
              className="flex items-center gap-2 px-6 py-3 rounded-2xl text-[11.5px] font-black uppercase tracking-wide shadow-lg transition-all"
              style={{ background: 'linear-gradient(135deg, #EB8D00, #C97600)', color: '#12293e' }}
            >
              <Save size={15} /> Gravar Cliente
            </button>
          </div>
        }
      >
        <ClientForm />
      </ModalShell>

      {clientsView === 'list' ? (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-x-auto">
          <table className="min-w-[480px] w-full text-sm table-fixed">
            <colgroup>
              <col className="w-[38%]" />
              <col className="hidden sm:table-column w-[37%]" />
              <col className="w-[13%]" />
              <col className="w-[12%]" />
            </colgroup>
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th onClick={() => setClientsSort(prev => ({ key: 'name', direction: prev.key === 'name' && prev.direction === 'asc' ? 'desc' : 'asc' }))} className="text-left px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest cursor-pointer hover:text-slate-700 transition-colors">
                  Cliente {clientsSort.key === 'name' ? (clientsSort.direction === 'asc' ? '↑' : '↓') : ''}
                </th>
                <th className="hidden sm:table-cell text-left px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Morada</th>
                <th onClick={() => setClientsSort(prev => ({ key: 'value', direction: prev.key === 'value' && prev.direction === 'asc' ? 'desc' : 'asc' }))} className="text-right px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest cursor-pointer hover:text-slate-700 transition-colors">
                  Valor {clientsSort.key === 'value' ? (clientsSort.direction === 'asc' ? '↑' : '↓') : ''}
                </th>
                <th className="text-right px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Ações</th>
              </tr>
            </thead>
            <tbody>
              {sortedClients.map(c => (
                <tr key={c.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-black text-slate-800 text-sm uppercase truncate">{c.name}</p>
                    <p className="text-xs text-slate-400 truncate">NIF: {c.nif || 'N/A'}</p>
                  </td>
                  <td className="hidden sm:table-cell px-4 py-3 text-sm font-bold text-slate-500 truncate">{c.morada || 'N/A'}</td>
                  <td className="px-4 py-3 text-right text-sm font-bold whitespace-nowrap" style={{ color: '#1B3A57' }}>{c.valorHora ? `${c.valorHora}€` : 'N/A'}</td>
                  <td className="px-3 py-3 text-right">
                    <div className="relative inline-block">
                      <button
                        onClick={() => setOpenMenuId(openMenuId === c.id ? null : c.id)}
                        className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-all"
                        title="Mais ações"
                      >
                        <MoreVertical size={15} />
                      </button>
                      {openMenuId === c.id && (
                        <>
                          <div className="fixed inset-0 z-10" onClick={() => setOpenMenuId(null)} />
                          <div className="absolute right-0 top-full mt-1.5 z-20 bg-white border border-slate-200/80 rounded-2xl shadow-xl ring-1 ring-black/5 py-1.5 min-w-[190px]">
                            <button
                              onClick={() => { openEditClient(c); setOpenMenuId(null); }}
                              className="w-full flex items-center gap-3 px-3.5 py-2.5 hover:bg-slate-50 group transition-colors"
                            >
                              <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-slate-100 group-hover:bg-slate-200 transition-colors shrink-0" style={{ color: '#869AAF' }}><Edit2 size={13} /></span>
                              <span className="text-xs font-semibold text-slate-700">Editar</span>
                            </button>
                            <button
                              onClick={() => { loadClientValorHoraHistory(c.id, c.name); setOpenMenuId(null); }}
                              className="w-full flex items-center gap-3 px-3.5 py-2.5 hover:bg-slate-50 group transition-colors"
                            >
                              <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-slate-100 group-hover:bg-slate-200 transition-colors shrink-0 text-base leading-none">📊</span>
                              <span className="text-xs font-semibold text-slate-700">Histórico de Valor</span>
                            </button>
                            <div className="mx-3 my-1 border-t border-slate-100" />
                            {confirmDeleteClientId === c.id ? (
                              <div className="mx-2 mb-1.5 p-2.5 bg-rose-50 rounded-xl border border-rose-100">
                                <p className="text-[10px] font-black text-rose-500 uppercase tracking-wider mb-2">Confirmar apagar?</p>
                                <div className="flex gap-1.5">
                                  <button onClick={() => { handleDeleteClient(c.id); setConfirmDeleteClientId(null); setOpenMenuId(null); }} className="flex-1 py-1.5 bg-rose-600 text-white text-[10px] font-black rounded-lg hover:bg-rose-700 transition-colors">Sim</button>
                                  <button onClick={() => setConfirmDeleteClientId(null)} className="flex-1 py-1.5 bg-white border border-slate-200 text-slate-600 text-[10px] font-black rounded-lg hover:bg-slate-50 transition-colors">Não</button>
                                </div>
                              </div>
                            ) : (
                              <button
                                onClick={() => setConfirmDeleteClientId(c.id)}
                                className="w-full flex items-center gap-3 px-3.5 py-2.5 hover:bg-rose-50 group transition-colors"
                              >
                                <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-rose-100 text-rose-500 group-hover:bg-rose-200 transition-colors shrink-0"><Trash2 size={13} /></span>
                                <span className="text-xs font-semibold text-rose-500 group-hover:text-rose-600">Apagar</span>
                              </button>
                            )}
                          </div>
                        </>
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
            <div key={c.id} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md hover:border-slate-200 hover:-translate-y-0.5 transition-all duration-200">
              {/* Header */}
              <div className="flex justify-between items-start mb-3">
                <div className="px-2.5 py-1 rounded-full text-[9px] font-black uppercase border flex items-center gap-1" style={{ color: '#869AAF', borderColor: 'rgba(134,154,175,0.4)', backgroundColor: 'rgba(134,154,175,0.1)' }}>
                  <Briefcase size={10} /> Cliente
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => loadClientValorHoraHistory(c.id, c.name)} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg transition-all border border-slate-100 text-xs" title="Histórico">📊</button>
                  <button onClick={() => { openEditClient(c); }} className="p-1.5 rounded-lg hover:bg-slate-50 transition-all border" style={{ color: '#869AAF', borderColor: 'rgba(134,154,175,0.3)' }} title="Editar"><Edit2 size={12} /></button>
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
                {c.triggers_limited_mode && (
                  <div className="flex items-center gap-1.5 text-amber-600 font-black mt-1">
                    <ShieldOff size={10} /> Modo Limitado
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      </>)} {/* fim clientSubTab === 'list' */}

      {showClientHistory.show && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => { setShowClientHistory({ show: false, clientId: null, clientName: '' }); setEditingHistoryId(null); }}>
          <div className="bg-white p-6 rounded-2xl max-w-md w-full mx-4 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-black" style={{ color: '#1B3A57' }}>Histórico de Valor Hora</h3>
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
                      <div className="flex flex-wrap items-center gap-2 p-3 bg-slate-50 rounded-xl border border-slate-200">
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
                          <span className="text-sm font-bold" style={{ color: '#1B3A57' }}>{h.valor_novo}€</span>
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

const ClientManager = ({ setClienteSelecionado, setModalEmailAberto, setPrintingReport, portalMonth, setPortalMonth }) => {
  return (
    <ClientProvider>
      <ClientManagerContent
        setClienteSelecionado={setClienteSelecionado}
        setModalEmailAberto={setModalEmailAberto}
        setPrintingReport={setPrintingReport}
        portalMonth={portalMonth}
        setPortalMonth={setPortalMonth}
      />
    </ClientProvider>
  );
};

export default ClientManager;
