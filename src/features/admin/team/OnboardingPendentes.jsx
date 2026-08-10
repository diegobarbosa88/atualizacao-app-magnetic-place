import React, { useState, useEffect, useCallback } from 'react';
import { useApp } from '../../../context/AppContext';
import { Users, Eye, CheckCircle, XCircle, Loader2, RefreshCw, Clock, AlertCircle } from 'lucide-react';
import ModalShell from '../../../components/common/ModalShell';

const TABELA_IRS_LABELS = {
  tabelaI:   'Tabela I',
  tabelaII:  'Tabela II',
  tabelaIII: 'Tabela III',
};

const labelCls = 'block text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1';
const inputCls = 'w-full bg-white border border-slate-200 rounded-lg py-[3px] px-2.5 text-sm font-semibold text-slate-800 outline-none focus:border-[#1B3A57] focus:ring-2 focus:ring-[#1B3A57]/10 transition-all';

function Row({ label, value }) {
  if (!value) return null;
  return (
    <div className="flex gap-2 py-1.5 border-b border-slate-50 last:border-0">
      <span className="text-[10px] font-black text-slate-400 uppercase tracking-wide w-28 shrink-0 pt-0.5">{label}</span>
      <span className="text-sm font-semibold text-slate-700 break-all">{value}</span>
    </div>
  );
}

export default function OnboardingPendentes() {
  const { supabase, saveToDb } = useApp();
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [adminFields, setAdminFields] = useState({ data_inicio: '', vencimento_base: '', valorHora: '' });
  const [rejectionReason, setRejectionReason] = useState('');
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [saving, setSaving] = useState(false);
  const [modalTab, setModalTab] = useState('dados');

  const loadSubmissions = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    const { data } = await supabase
      .from('worker_onboarding_submissions')
      .select('*')
      .eq('status', 'pending')
      .order('submitted_at', { ascending: false });
    setSubmissions(data || []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { loadSubmissions(); }, [loadSubmissions]);

  const openModal = (sub) => {
    setSelected({ ...sub });
    setAdminFields({ data_inicio: '', vencimento_base: '', valorHora: '' });
    setRejectionReason('');
    setShowRejectInput(false);
    setModalTab('dados');
  };

  const setField = (key, val) => setSelected(prev => ({ ...prev, [key]: val }));

  const handleAprovar = async () => {
    if (!selected || saving) return;
    setSaving(true);
    try {
      const newId = 'worker_' + Date.now();
      await saveToDb('workers', newId, {
        id: newId,
        name: selected.nome,
        profissao: selected.profissao || '',
        tel: selected.tel || '',
        email: selected.email || '',
        dni: selected.dni || '',
        address: selected.address || '',
        tabela_irs: selected.tabela_irs || 'tabelaI',
        n_dependentes: Number(selected.n_dependentes) || 0,
        nis: selected.nis || '',
        nif: selected.nif || '',
        iban: selected.iban || '',
        status: 'ativo',
        is_active: true,
        dataInicio: adminFields.data_inicio || null,
        vencimento_base: adminFields.vencimento_base ? Number(adminFields.vencimento_base) : null,
        valorHora: adminFields.valorHora ? Number(adminFields.valorHora) : null,
        assignedClients: [],
        assignedSchedules: [],
        defaultClientId: '',
        defaultScheduleId: '',
        limited_entry_mode: false,
      });

      await supabase
        .from('worker_onboarding_submissions')
        .update({ status: 'approved', reviewed_at: new Date().toISOString() })
        .eq('id', selected.id);

      setSubmissions(prev => prev.filter(s => s.id !== selected.id));
      setSelected(null);
    } catch (e) {
      console.error('[onboarding] Erro ao aprovar:', e);
    } finally {
      setSaving(false);
    }
  };

  const handleRejeitar = async () => {
    if (!selected || saving) return;
    setSaving(true);
    try {
      await supabase
        .from('worker_onboarding_submissions')
        .update({
          status: 'rejected',
          rejection_reason: rejectionReason || null,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', selected.id);

      setSubmissions(prev => prev.filter(s => s.id !== selected.id));
      setSelected(null);
    } catch (e) {
      console.error('[onboarding] Erro ao rejeitar:', e);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center py-16">
      <Loader2 className="text-[#869AAF] animate-spin" size={24} />
    </div>
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="bg-amber-50 p-2 rounded-xl text-amber-600"><Clock size={18} /></div>
          <div>
            <h3 className="font-black text-base text-slate-800 uppercase tracking-tight">Pedidos Pendentes</h3>
            <p className="text-[10px] text-slate-400 font-bold">Formulários de onboarding aguardando aprovação</p>
          </div>
        </div>
        <button onClick={loadSubmissions} className="p-2 text-slate-400 hover:text-[#869AAF] hover:bg-slate-100 rounded-xl transition-all" title="Atualizar">
          <RefreshCw size={16} />
        </button>
      </div>

      {submissions.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-10 text-center">
          <CheckCircle className="text-emerald-300 mx-auto mb-3" size={32} />
          <p className="font-black text-slate-400 text-sm uppercase tracking-wide">Sem pedidos pendentes</p>
          <p className="text-xs text-slate-300 mt-1">Todos os formulários foram revistos.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="text-left px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Colaborador</th>
                <th className="text-left px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest hidden sm:table-cell">Profissão</th>
                <th className="text-left px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Submetido em</th>
                <th className="text-right px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Ações</th>
              </tr>
            </thead>
            <tbody>
              {submissions.map(s => (
                <tr key={s.id} className="border-b border-slate-50 hover:bg-slate-50/60 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-black text-slate-800 uppercase text-sm">{s.nome}</p>
                    <p className="text-xs text-slate-400">{s.email || '—'}</p>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <p className="text-xs font-bold text-slate-500">{s.profissao || '—'}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-xs font-bold text-slate-500">
                      {new Date(s.submitted_at).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                    </p>
                    <p className="text-[10px] text-slate-400">
                      {new Date(s.submitted_at).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => openModal(s)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase text-white hover:opacity-90 transition-all ml-auto"
                      style={{ backgroundColor: '#1B3A57' }}
                    >
                      <Eye size={12} /> Rever
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal de revisão */}
      <ModalShell
        isOpen={!!selected}
        onClose={() => setSelected(null)}
        title={selected?.nome || 'Pedido de Onboarding'}
        subtitle="Reveja os dados e complete os campos necessários antes de aprovar."
        icon={<Users size={16} />}
        accent="navy"
        size="lg"
        footer={
          <div className="flex items-center justify-between gap-3 w-full">
            <div>
              {!showRejectInput ? (
                <button
                  onClick={() => setShowRejectInput(true)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black uppercase text-rose-600 border border-rose-200 hover:bg-rose-50 transition-all"
                >
                  <XCircle size={14} /> Rejeitar
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <input
                    className="border border-slate-200 rounded-lg py-1.5 px-3 text-xs font-semibold outline-none focus:border-rose-400 w-48"
                    placeholder="Motivo (opcional)"
                    value={rejectionReason}
                    onChange={e => setRejectionReason(e.target.value)}
                  />
                  <button
                    onClick={handleRejeitar}
                    disabled={saving}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase bg-rose-600 text-white hover:bg-rose-700 transition-all disabled:opacity-50"
                  >
                    {saving ? <Loader2 size={12} className="animate-spin" /> : <XCircle size={12} />}
                    Confirmar
                  </button>
                  <button onClick={() => setShowRejectInput(false)} className="text-xs text-slate-400 hover:text-slate-600">
                    Cancelar
                  </button>
                </div>
              )}
            </div>
            <button
              onClick={handleAprovar}
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-black uppercase bg-emerald-600 text-white hover:bg-emerald-700 shadow transition-all disabled:opacity-50"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
              Aprovar e Criar Colaborador
            </button>
          </div>
        }
      >
        {selected && (
          <div className="space-y-5">
            {/* Tabs */}
            <div className="flex items-end gap-1 border-b border-slate-100">
              {['dados', 'completar'].map(t => (
                <button
                  key={t}
                  onClick={() => setModalTab(t)}
                  className={`px-4 py-2 -mb-px border-b-2 text-[11px] font-black uppercase tracking-wide transition-all
                    ${modalTab === t ? 'border-[#EB8D00] text-[#1B3A57]' : 'border-transparent text-slate-400 hover:text-[#1B3A57]'}`}
                >
                  {t === 'dados' ? 'Dados submetidos' : 'Completar registo'}
                </button>
              ))}
            </div>

            {modalTab === 'dados' && (
              <div className="space-y-4">
                <Section title="Dados Pessoais">
                  <Row label="Nome" value={selected.nome} />
                  <Row label="Profissão" value={selected.profissao} />
                  <Row label="Telemóvel" value={selected.tel} />
                  <Row label="Email" value={selected.email} />
                  <Row label="Documento" value={selected.dni} />
                  <Row label="Morada" value={selected.address} />
                </Section>
                <Section title="Situação Fiscal">
                  <Row label="Tabela IRS" value={TABELA_IRS_LABELS[selected.tabela_irs] || selected.tabela_irs} />
                  <Row label="Dependentes" value={String(selected.n_dependentes ?? 0)} />
                </Section>
                <Section title="Dados Financeiros">
                  <Row label="NIF" value={selected.nif} />
                  <Row label="NIS" value={selected.nis} />
                  <Row label="IBAN" value={selected.iban} />
                </Section>

                <div className="pt-2">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Editar campos se necessário</p>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { key: 'nome', label: 'Nome' },
                      { key: 'profissao', label: 'Profissão' },
                      { key: 'tel', label: 'Telemóvel' },
                      { key: 'email', label: 'Email' },
                      { key: 'dni', label: 'Documento' },
                      { key: 'nif', label: 'NIF' },
                      { key: 'nis', label: 'NIS' },
                      { key: 'iban', label: 'IBAN' },
                    ].map(({ key, label }) => (
                      <div key={key}>
                        <label className={labelCls}>{label}</label>
                        <input
                          className={inputCls}
                          value={selected[key] || ''}
                          onChange={e => setField(key, e.target.value)}
                        />
                      </div>
                    ))}
                    <div>
                      <label className={labelCls}>Tabela IRS</label>
                      <select className={inputCls} value={selected.tabela_irs || 'tabelaI'} onChange={e => setField('tabela_irs', e.target.value)}>
                        <option value="tabelaI">Tabela I</option>
                        <option value="tabelaII">Tabela II</option>
                        <option value="tabelaIII">Tabela III</option>
                      </select>
                    </div>
                    <div>
                      <label className={labelCls}>Dependentes</label>
                      <input className={inputCls} type="number" min="0" max="20"
                        value={selected.n_dependentes ?? 0}
                        onChange={e => setField('n_dependentes', e.target.value)} />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {modalTab === 'completar' && (
              <div className="space-y-4">
                <div className="bg-amber-50 rounded-xl p-4 flex gap-3">
                  <AlertCircle className="text-amber-500 shrink-0 mt-0.5" size={16} />
                  <p className="text-[11px] text-amber-700 font-bold leading-relaxed">
                    Estes campos são preenchidos exclusivamente pelo admin. Só são obrigatórios se pretender ativar o colaborador imediatamente.
                  </p>
                </div>
                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <label className={labelCls}>Data de Início do Contrato</label>
                    <input className={inputCls} type="date" value={adminFields.data_inicio}
                      onChange={e => setAdminFields(p => ({ ...p, data_inicio: e.target.value }))} />
                  </div>
                  <div>
                    <label className={labelCls}>Vencimento Base (€/mês)</label>
                    <input className={inputCls} type="number" step="0.01" min="0"
                      value={adminFields.vencimento_base}
                      onChange={e => setAdminFields(p => ({ ...p, vencimento_base: e.target.value }))}
                      placeholder="0.00" />
                  </div>
                  <div>
                    <label className={labelCls}>Valor Hora (€/h)</label>
                    <input className={inputCls} type="number" step="0.01" min="0"
                      value={adminFields.valorHora}
                      onChange={e => setAdminFields(p => ({ ...p, valorHora: e.target.value }))}
                      placeholder="0.00" />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </ModalShell>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div>
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">{title}</p>
      <div className="bg-slate-50 rounded-xl px-4 py-1">
        {children}
      </div>
    </div>
  );
}
