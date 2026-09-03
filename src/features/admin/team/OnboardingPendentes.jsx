import React, { useState, useEffect, useCallback } from 'react';
import { useApp } from '../../../context/AppContext';
import { FT, SCALE, FONT_TITLE } from '../../../styles/designTokens';
import { Users, Eye, CheckCircle, XCircle, Loader2, RefreshCw, Clock, AlertCircle, ShieldCheck } from 'lucide-react';
import ModalShell from '../../../components/common/ModalShell';
import SelectProfissaoEmpresa from '../../../components/SelectProfissaoEmpresa';
import { autoAtribuirPorProfissao } from '../formacao-interna/formacaoApi';
import { autoGerarDocumentosGate } from './autoGerarDocumentosGate';
import { sendOnboardingApprovedEmail } from '../../../utils/emailUtils';

// Mesmo algoritmo de api/auth.js — o utilizador de login é sempre derivado
// do nome, nunca escolhido, por isso é seguro calcular aqui para informar o
// trabalhador sem esperar por uma resposta do servidor.
function loginKeyFromName(name) {
  if (!name) return '';
  const parts = name.trim().split(/\s+/);
  const first = parts[0].toLowerCase();
  const last = parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
  return first + last;
}

const TABELA_IRS_LABELS = {
  tabelaI:   'Tabela I',
  tabelaII:  'Tabela II',
  tabelaIII: 'Tabela III',
};

const DNI_TIPO_LABELS = {
  cc: 'Cartão de Cidadão',
  titulo_residencia: 'Título de Residência',
  passaporte: 'Passaporte',
  outro: 'Outro',
};

// Valores por omissão pedidos pelo Diego (2026-09-02) — o caso mais comum de
// onboarding hoje. Servem sobretudo submissões sem convite associado ou
// convites antigos sem estes campos gravados — quando há convite com estes
// campos preenchidos, openModal() sobrepõe-nos com o que foi definido lá.
// Mudar aqui exige mudar também os defaults de invite* em TeamManager.jsx.
const ADMIN_FIELDS_VAZIO = {
  data_inicio: '', vencimento_base: '1000', valorHora: '18',
  tipo_contrato: 'termo_incerto', regime: 'tempo_inteiro', horas_semanais: 40,
  modo_trabalho: 'presencial', enquadramento: 'REGE',
  subsidio_alimentacao_dia: '8', subsidio_alimentacao_tipo: 'dinheiro',
  local_trabalho: '1', defaultClientId: '', defaultScheduleId: '',
  comunicar_ss: false, solicitar_seguro: false,
};

const labelCls = `block ${SCALE.text.statLabel} text-[var(--slate-dim)] mb-1`;
const inputCls = 'w-full bg-white border border-[var(--border)] rounded-lg py-[3px] px-2.5 text-sm font-semibold text-[var(--ink)] outline-none focus:border-[var(--navy)] focus:ring-2 focus:ring-[#1B3A57]/10 transition-all';

function Row({ label, value }) {
  if (!value) return null;
  return (
    <div className="flex gap-2 py-1.5 border-b border-[var(--border-soft)] last:border-0">
      <span className={`${SCALE.text.statLabel} text-[var(--slate-dim)] w-28 shrink-0 pt-0.5`}>{label}</span>
      <span className="text-sm font-semibold text-[var(--ink-mid)] break-all">{value}</span>
    </div>
  );
}

export default function OnboardingPendentes() {
  const { supabase, clients, schedules } = useApp();
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [adminFields, setAdminFields] = useState(ADMIN_FIELDS_VAZIO);
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

  const openModal = async (sub) => {
    setSelected({ ...sub });
    setAdminFields(ADMIN_FIELDS_VAZIO);
    setRejectionReason('');
    setShowRejectInput(false);
    setModalTab('dados');

    // Pré-preenche com o que o admin já definiu ao gerar o convite —
    // vencimento_base/data_inicio_prevista/subsídio/tipo de contrato/regime/
    // horas semanais/código de local de trabalho (ver TeamManager.jsx e o
    // Trabalhador Virtual, que também os podem definir).
    if (sub.invite_id && supabase) {
      const { data: invite } = await supabase
        .from('worker_onboarding_invites')
        .select('vencimento_base, data_inicio_prevista, subsidio_alimentacao_dia, subsidio_alimentacao_tipo, tipo_contrato, regime, horas_semanais, local_trabalho_ss, valor_hora, default_client_id, default_schedule_id')
        .eq('id', sub.invite_id)
        .maybeSingle();
      if (invite) {
        setAdminFields(prev => ({
          ...prev,
          data_inicio: invite.data_inicio_prevista || prev.data_inicio,
          vencimento_base: invite.vencimento_base != null ? String(invite.vencimento_base) : prev.vencimento_base,
          valorHora: invite.valor_hora || prev.valorHora,
          subsidio_alimentacao_dia: invite.subsidio_alimentacao_dia != null ? String(invite.subsidio_alimentacao_dia) : prev.subsidio_alimentacao_dia,
          subsidio_alimentacao_tipo: invite.subsidio_alimentacao_tipo || prev.subsidio_alimentacao_tipo,
          tipo_contrato: invite.tipo_contrato || prev.tipo_contrato,
          regime: invite.regime || prev.regime,
          horas_semanais: invite.horas_semanais != null ? invite.horas_semanais : prev.horas_semanais,
          local_trabalho: invite.local_trabalho_ss != null ? String(invite.local_trabalho_ss) : prev.local_trabalho,
          defaultClientId: invite.default_client_id || prev.defaultClientId,
          defaultScheduleId: invite.default_schedule_id || prev.defaultScheduleId,
        }));
      }
    }
  };

  const setField = (key, val) => setSelected(prev => ({ ...prev, [key]: val }));

  const handleAprovar = async () => {
    if (!selected || saving || !supabase) return;
    setSaving(true);
    try {
      // A RPC preenche nome/contacto/fiscais a partir da própria submissão —
      // aqui só se sobrepõem os campos editados/completados pelo admin
      // (Dados submetidos + Completar registo).
      const { data: newWorkerId, error } = await supabase.rpc('aprovar_onboarding_submissao', {
        p_submission_id: selected.id,
        p_overrides: {
          nome: selected.nome, profissao: selected.profissao, profissao_cnp: selected.profissao_cnp,
          tel: selected.tel, email: selected.email, dni: selected.dni, address: selected.address,
          tabela_irs: selected.tabela_irs, n_dependentes: selected.n_dependentes,
          nis: selected.nis, nif: selected.nif, iban: selected.iban,
          data_inicio: adminFields.data_inicio || null,
          vencimento_base: adminFields.vencimento_base || null,
          valor_hora: adminFields.valorHora || null,
          tipo_contrato: adminFields.tipo_contrato,
          regime: adminFields.regime,
          horas_semanais: adminFields.horas_semanais,
          modo_trabalho: adminFields.modo_trabalho,
          enquadramento: adminFields.enquadramento,
          subsidio_alimentacao_dia: adminFields.subsidio_alimentacao_dia || null,
          subsidio_alimentacao_tipo: adminFields.subsidio_alimentacao_tipo,
          local_trabalho: adminFields.local_trabalho || null,
          default_client_id: adminFields.defaultClientId || null,
          default_schedule_id: adminFields.defaultScheduleId || null,
        },
      });
      if (error) throw error;

      // Atribuição de formação e geração de documentos são efeitos
      // secundários — nunca devem bloquear nem falhar visivelmente a
      // aprovação, que já foi gravada. Mesmo par de chamadas que
      // TeamContext.jsx faz ao criar um trabalhador pelo formulário normal
      // ("Novo Colaborador") — sem isto, um trabalhador aprovado por
      // onboarding nunca teria os itens do Gate gerados, e ficava preso
      // (worker_document_id/participante_id sempre null).
      try {
        await autoAtribuirPorProfissao(newWorkerId, selected.profissao_cnp || null);
      } catch (e) {
        console.warn('Falha ao atribuir formações automáticas:', e.message);
      }
      try {
        await autoGerarDocumentosGate(newWorkerId);
      } catch (e) {
        console.warn('Falha ao gerar documentos automáticos do gate de onboarding:', e.message);
      }

      // Avisa o próprio trabalhador de que já pode aceder — efeito
      // secundário, mesma lógica de não bloquear a aprovação já gravada.
      try {
        await sendOnboardingApprovedEmail({
          toEmail: selected.email,
          workerName: selected.nome,
          username: loginKeyFromName(selected.nome),
          password: selected.nif,
        });
      } catch (e) {
        console.warn('Falha ao enviar email de aprovação ao trabalhador:', e.message);
      }

      // Se pediram para comunicar SS e/ou solicitar seguro, agenda para o
      // dia anterior à data de início — o Trabalhador Virtual pede
      // autorização nesse dia em vez de executar já.
      if ((adminFields.comunicar_ss || adminFields.solicitar_seguro) && adminFields.data_inicio) {
        const dataExecucao = new Date(adminFields.data_inicio + 'T00:00:00');
        dataExecucao.setDate(dataExecucao.getDate() - 1);
        await supabase.from('worker_ativacao_agendada').insert({
          id: 'ativ_' + Date.now(),
          worker_id: newWorkerId,
          worker_nome: selected.nome,
          data_execucao: dataExecucao.toISOString().split('T')[0],
          comunicar_ss: !!adminFields.comunicar_ss,
          solicitar_seguro: !!adminFields.solicitar_seguro,
        });
      }

      setSubmissions(prev => prev.filter(s => s.id !== selected.id));
      setSelected(null);
    } catch (e) {
      console.error('[onboarding] Erro ao aprovar:', e);
    } finally {
      setSaving(false);
    }
  };

  const handleRejeitar = async () => {
    if (!selected || saving || !supabase) return;
    setSaving(true);
    try {
      const { error } = await supabase.rpc('rejeitar_onboarding_submissao', {
        p_submission_id: selected.id,
        p_motivo: rejectionReason || null,
      });
      if (error) throw error;

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
      <Loader2 className="text-[var(--slate)] animate-spin" size={24} />
    </div>
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-[var(--tone-amber-bg)] text-[var(--tone-amber)]"><Clock size={16} /></div>
          <div>
            <h3 className="font-black text-base text-[var(--ink)] uppercase tracking-tight" style={{ fontFamily: FONT_TITLE }}>Pedidos Pendentes</h3>
            <p className={`${SCALE.text.meta} text-[var(--slate-dim)]`}>Formulários de onboarding aguardando aprovação</p>
          </div>
        </div>
        <button onClick={loadSubmissions} className="p-2 text-[var(--slate)] hover:text-[var(--ink-soft)] hover:bg-[var(--surface-dim)] rounded-xl transition-all" title="Atualizar">
          <RefreshCw size={16} />
        </button>
      </div>

      {submissions.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[var(--border-soft)] shadow-sm p-10 text-center">
          <CheckCircle className="text-emerald-300 mx-auto mb-3" size={32} />
          <p className="font-black text-[var(--slate-dim)] text-sm uppercase tracking-wide">Sem pedidos pendentes</p>
          <p className="text-xs text-[var(--slate-dim)] mt-1">Todos os formulários foram revistos.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-[var(--border-soft)] shadow-sm overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border-soft)] bg-[var(--surface)]">
                <th className={`text-left px-4 py-3 ${SCALE.text.statLabel} text-[var(--slate-dim)]`}>Colaborador</th>
                <th className={`text-left px-4 py-3 ${SCALE.text.statLabel} text-[var(--slate-dim)] hidden sm:table-cell`}>Profissão</th>
                <th className={`text-left px-4 py-3 ${SCALE.text.statLabel} text-[var(--slate-dim)]`}>Submetido em</th>
                <th className={`text-right px-4 py-3 ${SCALE.text.statLabel} text-[var(--slate-dim)]`}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {submissions.map(s => (
                <tr key={s.id} className="border-b border-[var(--border-soft)] hover:bg-[var(--surface)] transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-black text-[var(--ink)] uppercase text-sm">{s.nome}</p>
                    <p className="text-xs text-[var(--slate-dim)]">{s.email || '—'}</p>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <p className="text-xs font-bold text-[var(--slate-dim)]">{s.profissao || '—'}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-xs font-bold text-[var(--slate-dim)]">
                      {new Date(s.submitted_at).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                    </p>
                    <p className={`${SCALE.text.meta} text-[var(--slate-dim)]`}>
                      {new Date(s.submitted_at).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => openModal(s)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-white hover:opacity-90 transition-all ml-auto ${SCALE.text.badge}`}
                      style={{ backgroundColor: FT.navy }}
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
        busy={saving}
        title={selected?.nome || 'Pedido de Onboarding'}
        icon={<Users size={16} />}
        accent="brand"
        size="lg"
        footer={
          <div className="flex items-center justify-between gap-3 w-full px-6 py-4">
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
                    className="border border-[var(--border)] rounded-lg py-1.5 px-3 text-xs font-semibold outline-none focus:border-rose-400 w-48"
                    placeholder="Motivo (opcional)"
                    value={rejectionReason}
                    onChange={e => setRejectionReason(e.target.value)}
                  />
                  <button
                    onClick={handleRejeitar}
                    disabled={saving}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600 text-white hover:bg-rose-700 transition-all disabled:opacity-50 ${SCALE.text.badge}`}
                  >
                    {saving ? <Loader2 size={12} className="animate-spin" /> : <XCircle size={12} />}
                    Confirmar
                  </button>
                  <button onClick={() => setShowRejectInput(false)} className="text-xs text-[var(--slate-dim)] hover:text-[var(--ink-soft)]">
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
          <div className="p-6 space-y-5">
            <p className="text-sm text-[var(--slate-dim)] leading-relaxed -mt-1">
              Reveja os dados e complete os campos necessários antes de aprovar.
            </p>
            {/* Tabs */}
            <div className="flex items-end gap-1 border-b border-[var(--border-soft)]">
              {['dados', 'completar'].map(t => (
                <button
                  key={t}
                  onClick={() => setModalTab(t)}
                  className={`px-4 py-2 -mb-px border-b-2 ${SCALE.text.badge} transition-all
                    ${modalTab === t ? 'border-[var(--orange)] text-[var(--navy)]' : 'border-transparent text-[var(--slate-dim)] hover:text-[var(--navy)]'}`}
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
                  <Row label="Tipo de documento" value={DNI_TIPO_LABELS[selected.dni_tipo] || selected.dni_tipo} />
                  <Row label="Nº do documento" value={selected.dni} />
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
                  <p className={`${SCALE.text.statLabel} text-[var(--slate-dim)] mb-2`}>Editar campos se necessário</p>
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
                  <p className={`${SCALE.text.body} text-amber-700 leading-relaxed`}>
                    Estes campos definem o contrato do colaborador. Data de início e vencimento base vêm pré-preenchidos do convite, quando definidos ao gerá-lo — reveja antes de aprovar.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3">
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
                  <div>
                    <label className={labelCls}>Subsídio Alimentação/Dia (€)</label>
                    <input className={inputCls} type="number" step="0.01" min="0"
                      value={adminFields.subsidio_alimentacao_dia}
                      onChange={e => setAdminFields(p => ({ ...p, subsidio_alimentacao_dia: e.target.value }))}
                      placeholder="9.60" />
                  </div>
                  <div>
                    <label className={labelCls}>Tipo de Subsídio</label>
                    <select className={inputCls} value={adminFields.subsidio_alimentacao_tipo}
                      onChange={e => setAdminFields(p => ({ ...p, subsidio_alimentacao_tipo: e.target.value }))}>
                      <option value="cartao">Cartão</option>
                      <option value="dinheiro">Dinheiro</option>
                    </select>
                  </div>
                </div>

                <div className="pt-1">
                  <p className={`${SCALE.text.statLabel} text-[var(--slate-dim)] mb-2`}>Contrato e Segurança Social</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelCls}>Tipo de Contrato</label>
                      <select className={inputCls} value={adminFields.tipo_contrato}
                        onChange={e => setAdminFields(p => ({ ...p, tipo_contrato: e.target.value }))}>
                        <option value="sem_termo">Sem Termo</option>
                        <option value="termo_certo">A Termo Certo</option>
                        <option value="termo_incerto">A Termo Incerto</option>
                        <option value="muito_curta_duracao">Muito Curta Duração</option>
                      </select>
                    </div>
                    <div>
                      <label className={labelCls}>Regime</label>
                      <select className={inputCls} value={adminFields.regime}
                        onChange={e => setAdminFields(p => ({ ...p, regime: e.target.value }))}>
                        <option value="tempo_inteiro">Tempo Inteiro</option>
                        <option value="tempo_parcial">Tempo Parcial</option>
                      </select>
                    </div>
                    <div>
                      <label className={labelCls}>Horas / Semana</label>
                      <input className={inputCls} type="number" min="1" max="48" step="0.5"
                        value={adminFields.horas_semanais}
                        onChange={e => setAdminFields(p => ({ ...p, horas_semanais: parseFloat(e.target.value) || 40 }))} />
                    </div>
                    <div>
                      <label className={labelCls}>Modo de Trabalho</label>
                      <select className={inputCls} value={adminFields.modo_trabalho}
                        onChange={e => setAdminFields(p => ({ ...p, modo_trabalho: e.target.value }))}>
                        <option value="presencial">Presencial</option>
                        <option value="remoto">Remoto (Teletrabalho)</option>
                        <option value="hibrido">Híbrido (Teletrabalho parcial)</option>
                      </select>
                    </div>
                    <div>
                      <label className={labelCls}>Enquadramento PSI</label>
                      <select className={inputCls} value={adminFields.enquadramento}
                        onChange={e => setAdminFields(p => ({ ...p, enquadramento: e.target.value }))}>
                        <option value="REGE">REGE — Regime Geral</option>
                        <option value="TRCD">TRCD — Contrato muito curta duração</option>
                        <option value="TCCD">TCCD — Cultura muito curta duração</option>
                        <option value="TRAG">TRAG — Trabalhadores agrícolas</option>
                        <option value="RGTC">RGTC — Carris — Regime Geral</option>
                        <option value="RGTL">RGTL — Lanifícios — Regime Geral</option>
                        <option value="RGTS">RGTS — Seguros — Regime Geral</option>
                        <option value="PEIN">PEIN — Pensionistas por invalidez</option>
                        <option value="PEVE">PEVE — Pensionistas de velhice</option>
                        <option value="PFPI">PFPI — Funções públicas — invalidez</option>
                        <option value="PFPV">PFPV — Funções públicas — velhice</option>
                      </select>
                    </div>
                    <div>
                      <label className={labelCls}>Cód. Local de Trabalho (SS)</label>
                      <input className={inputCls} type="number" min="1"
                        value={adminFields.local_trabalho}
                        onChange={e => setAdminFields(p => ({ ...p, local_trabalho: e.target.value }))}
                        placeholder="ex: 1" />
                    </div>
                    <div className="col-span-2">
                      <label className={labelCls}>Profissão CPP (código para a SS)</label>
                      <SelectProfissaoEmpresa
                        value={selected.profissao_cnp || ''}
                        className={inputCls}
                        onChange={(codigo, rotulo) => setSelected(prev => ({ ...prev, profissao_cnp: codigo, profissao: rotulo || prev.profissao }))}
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-1">
                  <p className={`${SCALE.text.statLabel} text-[var(--slate-dim)] mb-2`}>Afetação</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelCls}>Cliente Padrão</label>
                      <select className={inputCls} value={adminFields.defaultClientId}
                        onChange={e => setAdminFields(p => ({ ...p, defaultClientId: e.target.value }))}>
                        <option value="">— Sem cliente —</option>
                        {(clients || []).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className={labelCls}>Horário Padrão</label>
                      <select className={inputCls} value={adminFields.defaultScheduleId}
                        onChange={e => setAdminFields(p => ({ ...p, defaultScheduleId: e.target.value }))}>
                        <option value="">— Sem horário —</option>
                        {(schedules || []).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-[var(--border-soft)]">
                  <p className={`${SCALE.text.statLabel} text-[var(--slate-dim)] mb-2 flex items-center gap-1.5`}>
                    <ShieldCheck size={11} /> Ao aprovar, agendar para o dia anterior ao início
                  </p>
                  <div className="bg-[var(--surface)] rounded-xl p-3 space-y-2">
                    <label className="flex items-center gap-2.5 cursor-pointer">
                      <input type="checkbox" checked={adminFields.comunicar_ss}
                        onChange={e => setAdminFields(p => ({ ...p, comunicar_ss: e.target.checked }))}
                        className="w-4 h-4 rounded border-[var(--border)]" />
                      <span className="text-xs font-semibold text-[var(--ink-soft)]">Comunicar admissão à Segurança Social</span>
                    </label>
                    <label className="flex items-center gap-2.5 cursor-pointer">
                      <input type="checkbox" checked={adminFields.solicitar_seguro}
                        onChange={e => setAdminFields(p => ({ ...p, solicitar_seguro: e.target.checked }))}
                        className="w-4 h-4 rounded border-[var(--border)]" />
                      <span className="text-xs font-semibold text-[var(--ink-soft)]">Solicitar inclusão no seguro de acidentes de trabalho</span>
                    </label>
                    <p className={`${SCALE.text.meta} text-[var(--slate-dim)] leading-relaxed pt-1`}>
                      Nada é comunicado agora. O Trabalhador Virtual pede-te autorização por WhatsApp no dia
                      anterior à data de início e só executa depois de confirmares — precisa de uma data de início preenchida acima.
                    </p>
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
      <p className={`${SCALE.text.statLabel} text-[var(--slate-dim)] mb-2`}>{title}</p>
      <div className="bg-[var(--surface)] rounded-xl px-4 py-1">
        {children}
      </div>
    </div>
  );
}
