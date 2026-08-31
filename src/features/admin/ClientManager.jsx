import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { useClient, ClientProvider } from './contexts/ClientContext';
import {
  Briefcase, LayoutGrid, List, Edit2, Trash2, MapPin, Euro, ShieldOff, Send, AlertTriangle, Shield, Search, MoreVertical, Check, X, Building2, Save, Clock, ClipboardCheck
} from 'lucide-react';
import Card, { CardGrid } from '../../components/common/Card';
import { FT, FONT_TITLE, FONT_MONO, SCALE } from '../../styles/designTokens';
import ClientForm from './client/ClientForm';
import ClientEnviosPanel from './client/ClientEnviosPanel';
import CorrectionsInbox from './corrections/CorrectionsInbox';
import ClientPortalAuditPanel from './client/ClientPortalAuditPanel';
import ValidacaoMensalPanel from './client/ValidacaoMensalPanel';
import ModalShell from '../../components/common/ModalShell';
import SectionHeaderShell from '../../components/common/SectionHeaderShell';

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

  const clientesComValor = clients.filter(c => Number(c.valorHora) > 0);
  const valorMedio = clientesComValor.length
    ? clientesComValor.reduce((sum, c) => sum + Number(c.valorHora), 0) / clientesComValor.length
    : 0;
  const clientesLimitados = clients.filter(c => c.triggers_limited_mode).length;
  const clientesSemMorada = clients.filter(c => !c.morada).length;

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <SectionHeaderShell
        icon={<Building2 size={18} />}
        title="Clientes"
        subtitle="Gestão comercial, envios e auditoria"
        tabs={[
          { id: 'list',      label: 'Clientes',        icon: Building2 },
          { id: 'envios',    label: 'Envios',          icon: Send },
          { id: 'correcoes', label: 'Correções',       icon: AlertTriangle, badge: pendingClientCorrections || null },
          { id: 'validacao', label: 'Validação',       icon: ClipboardCheck },
          { id: 'auditoria', label: 'Auditoria Portal', icon: Shield },
        ]}
        activeTab={clientSubTab}
        onTabChange={setClientSubTab}
        stats={[
          { label: 'Clientes ativos', value: clients.length, colorText: FT.navy, dotColor: FT.slate },
          { label: 'Valor/hora médio', value: `${valorMedio.toFixed(2)}€`, colorText: FT.orangeDeep, dotColor: FT.orange },
          { label: 'Modo limitado', value: clientesLimitados, colorText: '#B8791F', dotColor: '#D98A2B' },
          { label: 'Sem morada', value: clientesSemMorada, colorText: '#B4432F', dotColor: '#B4432F' },
        ]}
      />

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

      {clientSubTab === 'validacao' && (
        <ValidacaoMensalPanel />
      )}

      {clientSubTab === 'auditoria' && (
        <ClientPortalAuditPanel />
      )}

      {clientSubTab === 'list' && (<>
      <div className="flex flex-wrap justify-between items-center gap-3 mb-5">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--slate)] pointer-events-none" />
          <input
            type="text"
            placeholder="Pesquisar cliente..."
            value={clientsSearch}
            onChange={e => setClientsSearch(e.target.value)}
            className="pl-8 pr-3 py-2 text-xs border border-[var(--border)] rounded-xl bg-[var(--surface)] focus:outline-none focus:ring-2 focus:ring-[var(--navy)] w-48 sm:w-64"
          />
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-[var(--surface)] border border-[var(--border)] rounded-xl p-1">
            <button onClick={() => setClientsView('grid')} className={`p-2 rounded-lg transition-all ${clientsView === 'grid' ? 'text-white' : 'text-[var(--slate)] hover:text-[var(--ink-soft)]'}`} style={clientsView === 'grid' ? { backgroundColor: FT.navy } : {}} title="Vista em Grade"><LayoutGrid size={18} /></button>
            <button onClick={() => setClientsView('list')} className={`p-2 rounded-lg transition-all ${clientsView === 'list' ? 'text-white' : 'text-[var(--slate)] hover:text-[var(--ink-soft)]'}`} style={clientsView === 'list' ? { backgroundColor: FT.navy } : {}} title="Vista em Lista"><List size={18} /></button>
          </div>
          <button onClick={() => { setClientForm({ id: null, name: '', morada: '', nif: '', valorHora: '', email: '', dataAlteracao: new Date().toISOString().split('T')[0] }); setIsAddingInTab(true); }} className="px-3 sm:px-5 py-2 rounded-xl font-black text-xs uppercase shadow-lg transition-all whitespace-nowrap text-[var(--navy)]" style={{ backgroundColor: FT.orange }}>Novo</button>
        </div>
      </div>

      <ModalShell
        isOpen={isAddingInTab}
        onClose={() => setIsAddingInTab(false)}
        title={clientForm.name || (clientForm.id ? 'Editar Cliente' : 'Novo Cliente')}
        subtitle={clientForm.id ? 'Cliente · Ficha' : 'Cliente · Novo registo'}
        icon={<Briefcase size={16} />}
        accent="brand"
        size="clientWide"
        footer={
          <div className="flex items-center justify-end gap-2.5 px-[2rem] pt-[1.1rem] pb-[1.3rem]">
            <button
              onClick={() => setIsAddingInTab(false)}
              className={`px-5 py-3 rounded-2xl ${SCALE.border.control} border-[var(--border)] bg-white text-[var(--slate-dim)] hover:bg-[var(--surface)] transition-all ${SCALE.text.badge}`}
            >
              Cancelar
            </button>
            <button
              onClick={handleSaveClient}
              className={`flex items-center gap-2 px-6 py-3 rounded-2xl shadow-lg transition-all ${SCALE.text.badge}`}
              style={{ background: `linear-gradient(135deg, ${FT.orange}, ${FT.orangeDeep})`, color: '#12293e' }}
            >
              <Save size={15} /> Gravar Cliente
            </button>
          </div>
        }
      >
        <ClientForm />
      </ModalShell>

      {clientsView === 'list' ? (
        <div className="bg-white rounded-2xl border border-[var(--border-soft)] shadow-sm overflow-x-auto">
          <table className="min-w-[480px] w-full text-sm table-fixed">
            <colgroup>
              <col className="w-[38%]" />
              <col className="hidden sm:table-column w-[37%]" />
              <col className="w-[13%]" />
              <col className="w-[12%]" />
            </colgroup>
            <thead>
              <tr className="border-b border-[var(--border-soft)] bg-[var(--surface)]">
                <th onClick={() => setClientsSort(prev => ({ key: 'name', direction: prev.key === 'name' && prev.direction === 'asc' ? 'desc' : 'asc' }))} className={`text-left px-4 py-3 text-[var(--slate-dim)] cursor-pointer hover:text-[var(--ink-mid)] transition-colors ${SCALE.text.statLabel}`}>
                  Cliente {clientsSort.key === 'name' ? (clientsSort.direction === 'asc' ? '↑' : '↓') : ''}
                </th>
                <th className={`hidden sm:table-cell text-left px-4 py-3 text-[var(--slate-dim)] ${SCALE.text.statLabel}`}>Morada</th>
                <th onClick={() => setClientsSort(prev => ({ key: 'value', direction: prev.key === 'value' && prev.direction === 'asc' ? 'desc' : 'asc' }))} className={`text-right px-4 py-3 text-[var(--slate-dim)] cursor-pointer hover:text-[var(--ink-mid)] transition-colors ${SCALE.text.statLabel}`}>
                  Valor {clientsSort.key === 'value' ? (clientsSort.direction === 'asc' ? '↑' : '↓') : ''}
                </th>
                <th className={`text-right px-4 py-3 text-[var(--slate-dim)] ${SCALE.text.statLabel}`}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {sortedClients.map(c => (
                <tr key={c.id} className="border-b border-[var(--border-soft)] hover:bg-[var(--surface)] transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-black text-[var(--ink)] text-sm uppercase truncate">{c.name}</p>
                    <p className="text-xs text-[var(--slate-dim)] truncate">NIF: {c.nif || 'N/A'}</p>
                  </td>
                  <td className="hidden sm:table-cell px-4 py-3 text-sm font-bold text-[var(--slate-dim)] truncate">{c.morada || 'N/A'}</td>
                  <td className="px-4 py-3 text-right text-sm font-bold whitespace-nowrap" style={{ color: 'var(--navy)' }}>{c.valorHora ? `${c.valorHora}€` : 'N/A'}</td>
                  <td className="px-3 py-3 text-right">
                    <div className="relative inline-block">
                      <button
                        onClick={() => setOpenMenuId(openMenuId === c.id ? null : c.id)}
                        className="p-1.5 text-[var(--slate)] hover:text-[var(--ink-soft)] hover:bg-[var(--surface-dim)] rounded-lg transition-all"
                        title="Mais ações"
                      >
                        <MoreVertical size={15} />
                      </button>
                      {openMenuId === c.id && (
                        <>
                          <div className="fixed inset-0 z-10" onClick={() => setOpenMenuId(null)} />
                          <div className="absolute right-0 top-full mt-1.5 z-20 bg-white border border-[var(--border)] rounded-2xl shadow-xl ring-1 ring-black/5 py-1.5 min-w-[190px]">
                            <button
                              onClick={() => { openEditClient(c); setOpenMenuId(null); }}
                              className="w-full flex items-center gap-3 px-3.5 py-2.5 hover:bg-[var(--surface)] group transition-colors"
                            >
                              <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-[var(--surface-dim)] group-hover:bg-[var(--border)] transition-colors shrink-0" style={{ color: FT.slate }}><Edit2 size={13} /></span>
                              <span className="text-xs font-semibold text-[var(--ink-mid)]">Editar</span>
                            </button>
                            <button
                              onClick={() => { loadClientValorHoraHistory(c.id, c.name); setOpenMenuId(null); }}
                              className="w-full flex items-center gap-3 px-3.5 py-2.5 hover:bg-[var(--surface)] group transition-colors"
                            >
                              <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-[var(--surface-dim)] group-hover:bg-[var(--border)] transition-colors shrink-0 text-base leading-none">📊</span>
                              <span className="text-xs font-semibold text-[var(--ink-mid)]">Histórico de Valor</span>
                            </button>
                            <div className="mx-3 my-1 border-t border-[var(--border-soft)]" />
                            {confirmDeleteClientId === c.id ? (
                              <div className="mx-2 mb-1.5 p-2.5 bg-rose-50 rounded-xl border border-rose-100">
                                <p className={`${SCALE.text.statLabel} text-rose-500 mb-2`}>Confirmar apagar?</p>
                                <div className="flex gap-1.5">
                                  <button onClick={() => { handleDeleteClient(c.id); setConfirmDeleteClientId(null); setOpenMenuId(null); }} className={`flex-1 py-1.5 bg-rose-600 text-white rounded-lg hover:bg-rose-700 transition-colors ${SCALE.text.meta}`}>Sim</button>
                                  <button onClick={() => setConfirmDeleteClientId(null)} className={`flex-1 py-1.5 bg-white border border-[var(--border)] text-[var(--ink-soft)] rounded-lg hover:bg-[var(--surface)] transition-colors ${SCALE.text.meta}`}>Não</button>
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
        <CardGrid>
          {sortedClients.map(c => {
            const nHorarios = (c.assignedSchedules || []).length;
            return (
              <Card key={c.id} variant="item" interactive>
                <div className="flex items-start justify-between mb-[0.7rem]">
                  <div className="w-[38px] h-[38px] rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: 'rgba(134,154,175,0.15)', color: FT.slate }}>
                    <Briefcase size={17} />
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => loadClientValorHoraHistory(c.id, c.name)} className={`w-[26px] h-[26px] rounded-lg border border-[#E5E1D6] bg-white text-[var(--slate)] hover:text-[var(--ink-soft)] flex items-center justify-center transition-all ${SCALE.text.body}`} title="Histórico de valor">📊</button>
                    <button onClick={() => openEditClient(c)} className="w-[26px] h-[26px] rounded-lg border border-[#E5E1D6] bg-white text-[var(--slate)] hover:text-[var(--navy)] flex items-center justify-center transition-all" title="Editar"><Edit2 size={12} /></button>
                    {confirmDeleteClientId === c.id ? (
                      <>
                        <button onClick={() => { handleDeleteClient(c.id); setConfirmDeleteClientId(null); }} className={`px-2 h-[26px] bg-rose-600 text-white rounded-lg ${SCALE.text.meta}`}>Sim</button>
                        <button onClick={() => setConfirmDeleteClientId(null)} className={`px-2 h-[26px] bg-[var(--surface-dim)] text-[var(--ink-soft)] rounded-lg ${SCALE.text.meta}`}>Não</button>
                      </>
                    ) : (
                      <button onClick={() => setConfirmDeleteClientId(c.id)} className="w-[26px] h-[26px] rounded-lg border border-[#E5E1D6] bg-white text-[var(--slate)] hover:text-rose-500 hover:border-rose-200 flex items-center justify-center transition-all" title="Apagar"><Trash2 size={12} /></button>
                    )}
                  </div>
                </div>

                <p className="text-[1.05rem] font-bold leading-[1.15] text-[var(--ink-mid)] truncate" style={{ fontFamily: FONT_TITLE }} title={c.name}>{c.name}</p>
                <p className={`${SCALE.text.meta} text-[var(--slate-dim)]`} style={{ fontFamily: FONT_MONO }}>
                  {c.nif ? `NIF ${c.nif}` : 'Sem NIF'}
                </p>

                <div className={`flex items-center gap-1.5 mt-[0.55rem] text-[var(--ink-soft)] ${SCALE.text.body}`}>
                  <MapPin size={12} className="shrink-0" style={{ color: FT.slate }} />
                  <span className="truncate" title={c.morada || undefined}>{c.morada || 'Sem morada registada'}</span>
                </div>

                {/* No mockup este badge estava em position:absolute no canto
                    superior direito e colidia com os botões de ação — aqui fica
                    em linha, a seguir à morada. */}
                {c.triggers_limited_mode && (
                  <div className="flex items-center gap-1 mt-1.5">
                    <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 ${SCALE.text.meta}`} style={{ background: '#FBF0DE', color: '#8a4a00' }}>
                      <ShieldOff size={9} /> Modo limitado
                    </span>
                  </div>
                )}

                <div className="flex items-center justify-between mt-[0.85rem] pt-[0.7rem] border-t border-[#F1EFE8]">
                  <span className="text-[1.15rem] font-bold leading-none text-[var(--navy)]" style={{ fontFamily: FONT_TITLE }}>
                    {c.valorHora ? Number(c.valorHora).toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'}
                    <span className={`${SCALE.text.meta} text-[var(--slate-dim)] ml-0.5`}>€/h</span>
                  </span>
                  <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[var(--slate-dim)] ${SCALE.text.meta}`} style={{ fontFamily: FONT_MONO, background: '#F4F2EC' }}>
                    <Clock size={10} /> {nHorarios} horário{nHorarios !== 1 ? 's' : ''}
                  </span>
                </div>
              </Card>
            );
          })}
        </CardGrid>
      )}
      </>)} {/* fim clientSubTab === 'list' */}

      {showClientHistory.show && (
        <ModalShell
          isOpen
          onClose={() => { setShowClientHistory({ show: false, clientId: null, clientName: '' }); setEditingHistoryId(null); }}
          title="Histórico de Valor Hora"
          meta={showClientHistory.clientName}
          size="md"
        >
          <div className="p-6">
            {clientValorHoraHistory.length === 0 ? (
              <p className="text-sm text-[var(--slate-dim)] text-center py-4">Sem histórico disponível</p>
            ) : (
              <div className="space-y-3 max-h-80 overflow-y-auto">
                {clientValorHoraHistory.map(h => (
                  <div key={h.id}>
                    {editingHistoryId === h.id ? (
                      <div className="flex flex-wrap items-center gap-2 p-3 bg-[var(--surface)] rounded-xl border border-[var(--border)]">
                        <input type="number" step="0.01" value={editingHistoryDraft.valor_anterior || ''} onChange={e => setEditingHistoryDraft(d => ({ ...d, valor_anterior: e.target.value }))} className="w-16 border border-[var(--border)] rounded-lg p-1 text-xs font-bold" placeholder="Ant." />
                        <span className="text-[var(--slate)] text-xs">→</span>
                        <input type="number" step="0.01" value={editingHistoryDraft.valor_novo || ''} onChange={e => setEditingHistoryDraft(d => ({ ...d, valor_novo: e.target.value }))} className="w-16 border border-[var(--border)] rounded-lg p-1 text-xs font-bold" placeholder="Novo" />
                        <input type="date" value={editingHistoryDraft.data_alteracao ? editingHistoryDraft.data_alteracao.split('T')[0] : ''} onChange={e => setEditingHistoryDraft(d => ({ ...d, data_alteracao: e.target.value }))} className="border border-[var(--border)] rounded-lg p-1 text-xs font-bold flex-1 min-w-0" />
                        <button onClick={() => handleSaveClientHistory(h)} className="p-1 text-green-600 hover:bg-green-50 rounded-lg"><Check size={14} /></button>
                        <button onClick={() => setEditingHistoryId(null)} className="p-1 text-[var(--slate)] hover:text-[var(--ink-soft)] hover:bg-[var(--surface-dim)] rounded-lg"><X size={14} /></button>
                      </div>
                    ) : confirmDeleteHistoryId === h.id ? (
                      <div className="flex items-center justify-between p-3 bg-red-50 rounded-xl border border-red-200">
                        <span className="text-xs font-bold text-red-600">Apagar este registo?</span>
                        <div className="flex gap-2">
                          <button onClick={() => handleDeleteClientHistory(h.id)} className="px-2 py-1 bg-red-600 text-white text-xs font-bold rounded-lg">Sim</button>
                          <button onClick={() => setConfirmDeleteHistoryId(null)} className="px-2 py-1 bg-[var(--border)] text-[var(--ink-soft)] text-xs font-bold rounded-lg">Não</button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex justify-between items-center p-3 bg-[var(--surface)] rounded-xl">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-[var(--ink-soft)]">{h.valor_anterior || 'N/A'}€</span>
                          <span className="text-[var(--slate)]">→</span>
                          <span className="text-sm font-bold" style={{ color: 'var(--navy)' }}>{h.valor_novo}€</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-[var(--slate-dim)]">{new Date(h.data_alteracao).toLocaleDateString('pt-PT')}</span>
                          <button onClick={() => { setEditingHistoryId(h.id); setEditingHistoryDraft(h); }} className="p-1 text-[var(--slate)] hover:text-amber-600 hover:bg-amber-50 rounded-lg"><Edit2 size={12} /></button>
                          <button onClick={() => setConfirmDeleteHistoryId(h.id)} className="p-1 text-[var(--slate)] hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 size={12} /></button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </ModalShell>
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
