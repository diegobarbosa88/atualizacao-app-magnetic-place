import React, { useState, useEffect } from 'react';
import { useApp } from '../../../context/AppContext';
import { useTeam } from '../contexts/TeamContext';
import {
  User, ShieldOff, Receipt, Wallet, CalendarRange, Save,
  Building2, Timer, CheckCircle, CheckCircle2, ChevronDown,
  ShieldCheck, AlertTriangle, Wallet as WalletIcon,
  Check, Circle, SendHorizonal,
} from 'lucide-react';
import SelectProfissaoEmpresa from '../../../components/SelectProfissaoEmpresa';
import { findProfissaoByCodigo } from '../../../data/profissoesEmpresa';
import { authFetch } from '../../../utils/authFetch';
import SSComunicacaoModal from './SSComunicacaoModal';

const fmtTs = iso => {
  if (!iso) return null;
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
};

const inp = 'w-full bg-white border border-slate-200 rounded-lg py-[3px] px-2.5 text-sm font-semibold outline-none focus:border-[#1B3A57] focus:ring-2 focus:ring-[#1B3A57]/10 transition-all';
const fmtDate = iso => { if (!iso) return 'atual'; const p = iso.split('T')[0].split('-'); return `${p[2]}/${p[1]}/${p[0].slice(2)}`; };
const lbl = 'block text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1';

const TABS = [
  { key: 'pessoal',   label: 'Pessoal',        Icon: User },
  { key: 'contrato',  label: 'Contrato & SS',  Icon: ShieldCheck },
  { key: 'financeiro', label: 'Financeiro',    Icon: WalletIcon },
  { key: 'afetacao',  label: 'Afetação',       Icon: Building2 },
];

// ── Linha do tempo do vínculo — proposta v2 ─────────────────────────────
// Substitui os dois badges soltos (admissão/cessação) por uma única peça:
// admissão → hoje → cessação, com o estado da comunicação SS embutido em
// cada ponta. Clicar num estado "por comunicar" abre o mesmo
// SSComunicacaoModal de sempre.
function VinculoTimeline({ workerForm, apoliceSeguro, onAbrirSS }) {
  const temInicio = !!workerForm.dataInicio;
  const temFim = !!workerForm.dataFim;
  const admissaoFeita = !!workerForm.ss_admissao_comunicada_em;
  const cessacaoFeita = !!workerForm.ss_cessacao_comunicada_em;

  const diasAtivo = (() => {
    if (!temInicio) return null;
    const inicio = new Date(workerForm.dataInicio.split('T')[0]);
    const fim = temFim ? new Date(workerForm.dataFim.split('T')[0]) : new Date();
    const dias = Math.max(0, Math.round((fim - inicio) / 86400000));
    return dias;
  })();

  return (
    <div className="border-t border-b border-slate-100 -mx-4 sm:-mx-5 px-4 sm:px-5 py-4 bg-slate-50/60">
      <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-3">Ciclo de Vida do Vínculo</p>
      <div className="flex items-start">

        {/* Admissão */}
        <div className="flex flex-col items-center text-center w-[120px] sm:w-[150px] shrink-0">
          <div className="flex items-center w-full">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 border-2 z-10 ${
              admissaoFeita ? 'bg-emerald-500 border-emerald-500 text-white'
              : temInicio ? 'text-white' : 'bg-white border-slate-200 text-slate-300'
            }`} style={!admissaoFeita && temInicio ? { backgroundColor: '#1B3A57', borderColor: '#1B3A57' } : {}}>
              {admissaoFeita ? <Check size={13} /> : <Circle size={11} fill="currentColor" />}
            </div>
            <div className="h-[2.5px] flex-1" style={{ background: temInicio ? '#10b981' : undefined, backgroundImage: !temInicio ? 'repeating-linear-gradient(90deg, #e2e8f0 0 6px, transparent 6px 11px)' : undefined }} />
          </div>
          <div className="mt-2">
            <p className="text-[9px] font-black uppercase tracking-wide text-slate-400">Admissão</p>
            <p className="text-xs font-black text-slate-700 my-0.5">{temInicio ? fmtDate(workerForm.dataInicio) : '— sem data'}</p>
            {temInicio ? (
              admissaoFeita ? (
                <span className="inline-flex items-center gap-1 text-[9px] font-black px-1.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700">✓ SS comunicada</span>
              ) : (
                <button
                  type="button"
                  onClick={() => onAbrirSS('admissao')}
                  className="inline-flex items-center gap-1 text-[9px] font-black px-1.5 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-700 hover:bg-amber-100 transition-colors cursor-pointer"
                >
                  <SendHorizonal size={9} /> SS por comunicar
                </button>
              )
            ) : (
              <span className="inline-flex items-center gap-1 text-[9px] font-black px-1.5 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-slate-400">sem data</span>
            )}
          </div>
        </div>

        {/* Hoje */}
        <div className="flex flex-col items-center text-center flex-1 shrink-0">
          <div className="flex items-center w-full">
            <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 border-2 z-10 text-white" style={{ backgroundColor: temInicio ? '#1B3A57' : '#cbd5e1', borderColor: temInicio ? '#1B3A57' : '#cbd5e1' }}>
              <Circle size={9} fill="currentColor" />
            </div>
            <div className="h-[2.5px] flex-1" style={{ backgroundImage: 'repeating-linear-gradient(90deg, #e2e8f0 0 6px, transparent 6px 11px)' }} />
          </div>
          <div className="mt-2">
            <p className="text-[9px] font-black uppercase tracking-wide text-slate-400">Hoje</p>
            <p className="text-xs font-black text-slate-700 my-0.5">
              {temFim ? 'Período fechado' : diasAtivo !== null ? `Ativo — ${diasAtivo}d` : 'Sem período aberto'}
            </p>
            <span className="inline-flex items-center gap-1 text-[9px] font-black px-1.5 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-slate-400">
              {temFim ? 'encerrado' : temInicio ? 'em curso' : 'n/a'}
            </span>
          </div>
        </div>

        {/* Cessação */}
        <div className="flex flex-col items-center text-center w-[120px] sm:w-[150px] shrink-0">
          <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 border-2" style={
            cessacaoFeita ? { backgroundColor: '#10b981', borderColor: '#10b981', color: '#fff' }
            : temFim ? { backgroundColor: '#1B3A57', borderColor: '#1B3A57', color: '#fff' }
            : { backgroundColor: '#fff', borderColor: '#e2e8f0', color: '#cbd5e1' }
          }>
            {cessacaoFeita ? <Check size={13} /> : <Circle size={11} fill="currentColor" />}
          </div>
          <div className="mt-2">
            <p className="text-[9px] font-black uppercase tracking-wide text-slate-400">Cessação</p>
            <p className="text-xs font-black text-slate-700 my-0.5">{temFim ? fmtDate(workerForm.dataFim) : 'sem data'}</p>
            {temFim ? (
              cessacaoFeita ? (
                <span className="inline-flex items-center gap-1 text-[9px] font-black px-1.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700">✓ SS comunicada</span>
              ) : (
                <button
                  type="button"
                  onClick={() => onAbrirSS('cessacao')}
                  className="inline-flex items-center gap-1 text-[9px] font-black px-1.5 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-700 hover:bg-amber-100 transition-colors cursor-pointer"
                >
                  <SendHorizonal size={9} /> SS por comunicar
                </button>
              )
            ) : (
              <span className="inline-flex items-center gap-1 text-[9px] font-black px-1.5 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-slate-400">n/a</span>
            )}
          </div>
        </div>
      </div>

      {apoliceSeguro?.status && (
        <div className="mt-3 pt-3 border-t border-slate-200/70 flex items-center gap-1.5">
          {apoliceSeguro.status === 'ativo'
            ? <ShieldCheck size={11} className="text-emerald-600 shrink-0" />
            : <AlertTriangle size={11} className="text-amber-500 shrink-0" />}
          <span className="text-[10px] font-bold text-slate-500">
            Apólice de Seguro: <span className={apoliceSeguro.status === 'ativo' ? 'text-emerald-600' : 'text-amber-600'}>{apoliceSeguro.status[0].toUpperCase()}{apoliceSeguro.status.slice(1)}</span>
          </span>
        </div>
      )}
    </div>
  );
}

const WorkerForm = () => {
  const { clients, schedules, supabase, setWorkers } = useApp();
  const { workerForm, setWorkerForm, handleSaveWorker } = useTeam();
  const [activeTab, setActiveTab] = useState('pessoal');
  const [saveSuccessClientId, setSaveSuccessClientId] = useState(null);
  const [saveSuccessScheduleId, setSaveSuccessScheduleId] = useState(null);
  const [expandedClientPeriods, setExpandedClientPeriods] = useState({});
  const [expandedSchedulePeriods, setExpandedSchedulePeriods] = useState({});
  const [valorHoraHistory, setValorHoraHistory] = useState([]);
  const [employmentHistory, setEmploymentHistory] = useState([]);
  const [apoliceSeguro, setApoliceSeguro] = useState(null);
  const [ssModal, setSsModal] = useState(null); // 'admissao' | 'cessacao' | null
  const [ssAmbiente, setSsAmbiente] = useState('teste');

  // supabase vem do AppContext, não de window.supabaseInstance direto — esse
  // global pode não estar pronto no primeiro mount em certas condições de
  // arranque (ver WorkerList.jsx, mesmo bug já apanhado lá).
  useEffect(() => {
    if (!workerForm.id || !supabase) { setValorHoraHistory([]); setEmploymentHistory([]); setApoliceSeguro(null); return; }
    supabase.from('worker_valorhora_history').select('*').eq('worker_id', workerForm.id).order('data_alteracao', { ascending: false }).limit(4).then(({ data }) => setValorHoraHistory(data || []));
    supabase.from('worker_employment_history').select('*').eq('worker_id', workerForm.id).order('created_at', { ascending: false }).limit(4).then(({ data }) => setEmploymentHistory(data || []));
    supabase.from('worker_apolice_seguro').select('*').eq('worker_id', workerForm.id).maybeSingle().then(({ data }) => setApoliceSeguro(data));
  }, [workerForm.id, supabase]);

  useEffect(() => {
    authFetch('/api/seguranca-social?action=status')
      .then(r => r.json())
      .then(d => { if (d.ambiente) setSsAmbiente(d.ambiente); })
      .catch(() => {});
  }, []);

  const handleSsSuccess = (data, tipo) => {
    const campo = tipo === 'admissao'
      ? { ss_admissao_comunicada_em: data.dataHora || new Date().toISOString(), ss_admissao_num_registo: data.numRegisto || null }
      : { ss_cessacao_comunicada_em: data.dataHora || new Date().toISOString(), ss_cessacao_num_registo: data.numRegisto || null };
    setWorkerForm(prev => ({ ...prev, ...campo }));
    if (workerForm.id) setWorkers(prev => prev.map(w => w.id === workerForm.id ? { ...w, ...campo } : w));
  };

  const handleSaveClientDates = async (clientId, dataInicio, dataFim) => {
    if (!workerForm.id || !supabase) return;
    await supabase.from('worker_client_history').update({ data_fim: new Date().toISOString().split('T')[0] }).eq('worker_id', workerForm.id).eq('client_id', clientId).is('data_fim', null);
    await supabase.from('worker_client_history').insert({ worker_id: workerForm.id, client_id: clientId, data_inicio: dataInicio, data_fim: dataFim || null });
    setWorkerForm(prev => ({ ...prev, assignedClientDates: { ...(prev.assignedClientDates || {}), [clientId]: { dataInicio, dataFim } } }));
    setSaveSuccessClientId(clientId);
    setTimeout(() => setSaveSuccessClientId(null), 3000);
  };

  const handleSaveScheduleDates = async (scheduleId, dataInicio, dataFim) => {
    if (!workerForm.id || !supabase) return;
    await supabase.from('worker_schedule_history').update({ data_fim: new Date().toISOString().split('T')[0] }).eq('worker_id', workerForm.id).eq('schedule_id', scheduleId).is('data_fim', null);
    await supabase.from('worker_schedule_history').insert({ worker_id: workerForm.id, schedule_id: scheduleId, data_inicio: dataInicio, data_fim: dataFim || null });
    setWorkerForm(prev => ({ ...prev, assignedScheduleDates: { ...(prev.assignedScheduleDates || {}), [scheduleId]: { dataInicio, dataFim } } }));
    setSaveSuccessScheduleId(scheduleId);
    setTimeout(() => setSaveSuccessScheduleId(null), 3000);
  };

  const f = field => e => setWorkerForm(prev => ({ ...prev, [field]: e.target.value }));
  const tog = field => () => setWorkerForm(prev => ({ ...prev, [field]: !prev[field] }));

  return (
    <div className="p-4 sm:p-5">

      {/* ── Linha do tempo do vínculo (proposta v2) ── */}
      {workerForm.id && (
        <VinculoTimeline workerForm={workerForm} apoliceSeguro={apoliceSeguro} onAbrirSS={setSsModal} />
      )}

      {/* ── Abas por assunto ── */}
      <div className="flex items-center gap-1 border-b border-slate-100 mt-4 mb-4 overflow-x-auto">
        {TABS.map(({ key, label, Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => setActiveTab(key)}
            className={`flex items-center gap-1.5 px-3 py-2.5 -mb-px border-b-2 text-[11px] font-black uppercase tracking-wide whitespace-nowrap transition-all ${
              activeTab === key ? 'border-[#EB8D00] text-[#1B3A57]' : 'border-transparent text-slate-400 hover:text-[#1B3A57]'
            }`}
          >
            <Icon size={12} /> {label}
          </button>
        ))}
      </div>

      <div className="space-y-5">

          {/* Pessoal */}
          {activeTab === 'pessoal' && (
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5 mb-3">
                <User size={10} /> Dados do Colaborador
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={lbl}>Nome</label>
                  <input type="text" value={workerForm.name} onChange={f('name')} className={inp} placeholder="João Silva" />
                </div>
                <div>
                  <label className={lbl}>Profissão</label>
                  <SelectProfissaoEmpresa
                    value={workerForm.profissao_cnp || ''}
                    className={inp}
                    onChange={(codigo, rotulo) => setWorkerForm(prev => ({
                      ...prev,
                      profissao_cnp: codigo,
                      profissao: rotulo,
                    }))}
                  />
                </div>
                <div>
                  <label className={lbl}>Telemóvel</label>
                  <input type="text" value={workerForm.tel} onChange={f('tel')} className={inp} placeholder="912 345 678" />
                </div>
                <div>
                  <label className={lbl}>Email</label>
                  <input type="email" value={workerForm.email || ''} onChange={f('email')} className={inp} placeholder="exemplo@dominio.pt" />
                </div>
                <div>
                  <label className={lbl}>Estado</label>
                  <select value={workerForm.status || 'ativo'} onChange={f('status')} className={inp}>
                    <option value="ativo">Ativo</option>
                    <option value="inativo">Inativo</option>
                  </select>
                </div>
                <div>
                  <label className={lbl}>DNI</label>
                  <input type="text" value={workerForm.dni || ''} onChange={f('dni')} className={inp} placeholder="DNI" />
                </div>
                <div>
                  <label className={lbl}>Data de Nascimento</label>
                  <input type="date" value={workerForm.data_nascimento || ''} onChange={f('data_nascimento')} className={inp} />
                </div>
                <div className="col-span-2">
                  <label className={lbl}>Morada</label>
                  <input type="text" value={workerForm.address || ''} onChange={f('address')} className={inp} placeholder="Morada" />
                </div>
                <div>
                  <label className={lbl}>Admin</label>
                  <button type="button" onClick={tog('isAdmin')} className={`w-full flex items-center justify-between p-2.5 rounded-lg border text-xs font-semibold transition-all ${workerForm.isAdmin ? '' : 'bg-white border-slate-200 text-slate-500'}`} style={workerForm.isAdmin ? { backgroundColor: 'rgba(27,58,87,0.06)', borderColor: 'rgba(27,58,87,0.25)', color: '#1B3A57' } : {}}>
                    <span>Admin</span>
                    <div className="w-8 h-4 rounded-full relative transition-all" style={{ backgroundColor: workerForm.isAdmin ? '#1B3A57' : '#E2E8F0' }}>
                      <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full shadow transition-all ${workerForm.isAdmin ? 'left-4' : 'left-0.5'}`} />
                    </div>
                  </button>
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wide text-amber-500 mb-1">Modo Limitado</label>
                  <button type="button" onClick={tog('limited_entry_mode')} className={`w-full flex items-center justify-between p-2.5 rounded-lg border text-xs font-semibold transition-all ${workerForm.limited_entry_mode ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-white border-slate-200 text-slate-500'}`}>
                    <span className="flex items-center gap-1.5"><ShieldOff size={11} /> Pedido de Registo</span>
                    <div className={`w-8 h-4 rounded-full relative transition-all ${workerForm.limited_entry_mode ? 'bg-amber-400' : 'bg-slate-200'}`}>
                      <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full shadow transition-all ${workerForm.limited_entry_mode ? 'left-4' : 'left-0.5'}`} />
                    </div>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Contrato & SS */}
          {activeTab === 'contrato' && (
            <div className="space-y-5">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5 mb-3">
                  <CalendarRange size={10} /> Vínculo
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={lbl}>Data Início</label>
                    <input type="date" value={workerForm.dataInicio || ''} onChange={f('dataInicio')} className={inp} />
                  </div>
                  <div>
                    <label className={lbl}>Data Fim</label>
                    <input type="date" value={workerForm.dataFim || ''} onChange={f('dataFim')} className={inp} />
                  </div>
                  {workerForm.dataFim && (
                    <div className="col-span-2">
                      <button
                        type="button"
                        onClick={() => {
                          const hoje = new Date().toISOString().split('T')[0];
                          setWorkerForm(prev => ({
                            ...prev,
                            status: 'ativo',
                            dataInicio: hoje,
                            dataFim: null,
                            ss_admissao_comunicada_em: null,
                            ss_admissao_num_registo: null,
                            ss_cessacao_comunicada_em: null,
                            ss_cessacao_num_registo: null,
                          }));
                        }}
                        className="w-full text-[10px] font-bold uppercase tracking-wide px-2.5 py-2 rounded-lg border border-dashed transition-all hover:bg-slate-50"
                        style={{ color: '#1B3A57', borderColor: '#1B3A57' }}
                        title="Fecha o período atual (guarda no histórico ao gravar) e prepara um novo período em aberto — limpa também as comunicações de admissão/cessação à SS para poderes comunicar de novo."
                      >
                        ↻ Iniciar Novo Período (reentrada)
                      </button>
                    </div>
                  )}
                  {!workerForm.dataFim && !!workerForm.dataInicio && (
                    <div className="col-span-2 flex items-start gap-2 bg-amber-50 border border-amber-100 rounded-lg px-2.5 py-2">
                      <AlertTriangle size={11} className="text-amber-500 shrink-0 mt-0.5" />
                      <p className="text-[10px] text-amber-700 font-semibold leading-relaxed">Cessação por preparar — sem data de fim, não é possível comunicar a cessação à SS.</p>
                    </div>
                  )}
                  {employmentHistory.length > 0 && (
                    <div className="col-span-2 border-l-2 border-slate-100 pl-2 space-y-0.5">
                      {employmentHistory.map(p => (
                        <p key={p.id} className="text-[9px] text-slate-400 font-mono leading-tight">
                          {fmtDate(p.data_inicio)} → {p.data_fim ? fmtDate(p.data_fim) : <span className="font-bold" style={{ color: '#1B3A57' }}>atual</span>}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="border-t border-slate-100 pt-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5 mb-3">
                  <ShieldCheck size={10} /> Enquadramento PSI
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={lbl}>Tipo de Contrato</label>
                    <select value={workerForm.tipo_contrato || 'sem_termo'} onChange={f('tipo_contrato')} className={inp}>
                      <option value="sem_termo">Sem Termo</option>
                      <option value="termo_certo">A Termo Certo</option>
                      <option value="termo_incerto">A Termo Incerto</option>
                      <option value="muito_curta_duracao">Muito Curta Duração</option>
                    </select>
                  </div>
                  <div>
                    <label className={lbl}>Regime</label>
                    <select value={workerForm.regime || 'tempo_inteiro'} onChange={f('regime')} className={inp}>
                      <option value="tempo_inteiro">Tempo Inteiro</option>
                      <option value="tempo_parcial">Tempo Parcial</option>
                    </select>
                  </div>
                  <div>
                    <label className={lbl}>Horas / Semana</label>
                    <input type="number" min="1" max="48" step="0.5" value={workerForm.horas_semanais ?? 40} onChange={e => setWorkerForm(prev => ({ ...prev, horas_semanais: parseFloat(e.target.value) || 40 }))} className={inp} />
                  </div>
                  <div>
                    <label className={lbl}>Modo de Trabalho</label>
                    <select value={workerForm.modo_trabalho || 'presencial'} onChange={f('modo_trabalho')} className={inp}>
                      <option value="presencial">Presencial</option>
                      <option value="remoto">Remoto (Teletrabalho)</option>
                      <option value="hibrido">Híbrido (Teletrabalho parcial)</option>
                    </select>
                  </div>
                  <div>
                    <label className={lbl}>Enquadramento PSI</label>
                    <select
                      value={workerForm.enquadramento || 'REGE'}
                      onChange={e => setWorkerForm(prev => ({ ...prev, enquadramento: e.target.value }))}
                      className={inp}
                    >
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
                    <label className={lbl}>Cód. CPP Profissão</label>
                    {(() => {
                      const p = findProfissaoByCodigo(workerForm.profissao_cnp);
                      return p
                        ? <p className="text-xs font-mono font-semibold text-slate-700 py-[5px] px-2.5 bg-slate-50 border border-slate-200 rounded-lg">{p.codigoCPP} — {p.designacaoModal}</p>
                        : <p className="text-xs text-slate-400 py-[5px] px-2.5 bg-slate-50 border border-slate-200 rounded-lg italic">Sem profissão definida — selecionar em Pessoal</p>;
                    })()}
                  </div>
                  <div className="col-span-2">
                    <label className={lbl}>Cód. Local Trabalho</label>
                    <input
                      type="number"
                      min="1"
                      value={workerForm.local_trabalho || ''}
                      onChange={e => setWorkerForm(prev => ({ ...prev, local_trabalho: parseInt(e.target.value, 10) || null }))}
                      placeholder="ex: 1"
                      className={inp}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Financeiro */}
          {activeTab === 'financeiro' && (
            <div className="space-y-5">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-emerald-500 flex items-center gap-1.5 mb-3">
                  <Wallet size={10} /> Financeiro
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={lbl}>NIS</label>
                    <input type="text" value={workerForm.nis || ''} onChange={f('nis')} className={inp} placeholder="NIS" />
                  </div>
                  <div>
                    <label className={lbl}>NIF</label>
                    <input type="text" value={workerForm.nif || ''} onChange={f('nif')} className={inp} placeholder="NIF" />
                  </div>
                  <div className="col-span-2">
                    <label className={lbl}>IBAN</label>
                    <input type="text" value={workerForm.iban} onChange={f('iban')} className={inp + ' font-mono uppercase'} placeholder="PT50..." />
                  </div>
                  <div>
                    <label className={lbl}>Valor Hora (€)</label>
                    <input type="number" step="0.01" value={workerForm.valorHora} onChange={f('valorHora')} className={inp + ' text-emerald-700 font-black'} placeholder="0.00" />
                    {valorHoraHistory.length > 0 && (
                      <div className="mt-1 border-l-2 border-emerald-100 pl-2 space-y-0.5">
                        {valorHoraHistory.map(h => (
                          <p key={h.id} className="text-[9px] text-slate-400 font-mono leading-tight">
                            {h.valor_anterior ?? '—'} → <span className="text-emerald-600">{h.valor_novo}€</span> · {fmtDate(h.data_alteracao)}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                  <div>
                    <label className={lbl}>Desde</label>
                    <input type="date" value={workerForm.dataAlteracao || ''} onChange={f('dataAlteracao')} className={inp} />
                  </div>
                  <div>
                    <label className={lbl}>Vencimento Base (€)</label>
                    <input type="number" step="0.01" value={workerForm.vencimento_base ?? ''} onChange={f('vencimento_base')} className={inp + ' text-emerald-700 font-black'} placeholder="0.00" />
                  </div>
                  <div>
                    <label className={lbl}>Subsídio Alimentação/Dia (€)</label>
                    <input type="number" step="0.01" value={workerForm.subsidio_alimentacao_dia ?? ''} onChange={f('subsidio_alimentacao_dia')} className={inp + ' text-emerald-700 font-black'} placeholder="9.60" />
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-100 pt-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5 mb-3">
                  <Receipt size={10} /> IRS — Situação Fiscal
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className={lbl}>Tabela de Retenção</label>
                    <select value={workerForm.tabela_irs || 'tabelaI'} onChange={f('tabela_irs')} className={inp}>
                      <option value="tabelaI">Tabela I — Não casado / Casado, dois titulares</option>
                      <option value="tabelaII">Tabela II — Não casado, com dependentes</option>
                      <option value="tabelaIII">Tabela III — Casado, único titular</option>
                    </select>
                  </div>
                  <div>
                    <label className={lbl}>Nº de Dependentes</label>
                    <input type="number" min="0" value={workerForm.n_dependentes ?? 0} onChange={e => setWorkerForm(prev => ({ ...prev, n_dependentes: parseInt(e.target.value, 10) || 0 }))} className={inp} placeholder="0" />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Afetação — aba própria, mesmo nível das outras três (Clientes + Horários lado a lado) */}
          {activeTab === 'afetacao' && (
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5 mb-3">
                <Building2 size={10} /> Afetação — Clientes &amp; Horários
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <AfetacaoCards
                  clients={clients} schedules={schedules} workerForm={workerForm} setWorkerForm={setWorkerForm}
                  expandedClientPeriods={expandedClientPeriods} setExpandedClientPeriods={setExpandedClientPeriods}
                  expandedSchedulePeriods={expandedSchedulePeriods} setExpandedSchedulePeriods={setExpandedSchedulePeriods}
                  saveSuccessClientId={saveSuccessClientId} saveSuccessScheduleId={saveSuccessScheduleId}
                  handleSaveClientDates={handleSaveClientDates} handleSaveScheduleDates={handleSaveScheduleDates}
                />
              </div>
            </div>
          )}
      </div>

      {/* Gravar — sempre visível, independente da aba */}
      <button onClick={handleSaveWorker} className="w-full mt-5 p-3 rounded-xl font-black text-xs uppercase shadow-lg transition-all flex items-center justify-center gap-2" style={{ backgroundColor: '#EB8D00', color: '#1B3A57' }}>
        <Save size={14} /> Gravar Colaborador
      </button>

      {ssModal && workerForm.id && (
        <SSComunicacaoModal
          worker={workerForm}
          tipo={ssModal}
          ambiente={ssAmbiente}
          onClose={() => setSsModal(null)}
          onSuccess={(data) => { handleSsSuccess(data, ssModal); setSsModal(null); }}
        />
      )}
    </div>
  );
};

// ── Cartões de Clientes/Horários — extraídos para reutilizar em mobile (aba) e desktop (coluna) ──
function AfetacaoCards({
  clients, schedules, workerForm, setWorkerForm,
  expandedClientPeriods, setExpandedClientPeriods, expandedSchedulePeriods, setExpandedSchedulePeriods,
  saveSuccessClientId, saveSuccessScheduleId, handleSaveClientDates, handleSaveScheduleDates,
}) {
  return (
    <>
      {/* CARD: Clientes */}
      <div className="rounded-xl border border-slate-200 overflow-hidden">
        <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 border-b border-slate-100">
          <Building2 size={12} className="text-[#869AAF]" />
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-600">Clientes</span>
        </div>
        <div className="max-h-[150px] overflow-y-auto p-2 space-y-0.5 bg-white">
          {clients.map(c => {
            const isAssigned = workerForm.assignedClients?.includes(c.id);
            return (
              <label key={c.id} className={`flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer transition-all ${isAssigned ? '' : 'hover:bg-slate-50'}`} style={isAssigned ? { backgroundColor: 'rgba(27,58,87,0.05)' } : {}}>
                <div className={`w-3.5 h-3.5 rounded flex items-center justify-center border shrink-0 ${isAssigned ? '' : 'border-slate-300'}`} style={isAssigned ? { backgroundColor: '#1B3A57', borderColor: '#1B3A57' } : {}}>
                  {isAssigned && <CheckCircle size={9} className="text-white" />}
                </div>
                <input type="checkbox" className="hidden" checked={isAssigned} onChange={() => {
                  const current = workerForm.assignedClients || [];
                  setWorkerForm(prev => ({ ...prev, assignedClients: current.includes(c.id) ? current.filter(id => id !== c.id) : [...current, c.id] }));
                }} />
                <span className="text-[10px] font-bold truncate" style={{ color: isAssigned ? '#1B3A57' : '#475569' }}>{c.name}</span>
              </label>
            );
          })}
        </div>
        <div className="px-2 py-2 border-t border-slate-100 bg-slate-50/50">
          <label className="text-[9px] font-bold uppercase text-slate-400 block mb-1">Padrão</label>
          <select value={workerForm.defaultClientId || ''} onChange={e => setWorkerForm(prev => ({ ...prev, defaultClientId: e.target.value }))} className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs font-semibold outline-none focus:border-[#1B3A57] transition-all">
            <option value="">Selecionar</option>
            {clients.filter(c => workerForm.assignedClients?.includes(c.id)).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        {(workerForm.assignedClients?.length > 0) && <>
          <div className="flex items-center gap-1.5 px-3 py-1.5 border-t border-slate-100 bg-slate-50">
            <CalendarRange size={9} className="text-[#869AAF]" />
            <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Períodos</span>
            {!workerForm.id && <span className="ml-auto text-[9px] text-amber-500 font-bold">Guarde primeiro</span>}
          </div>
          <div className="p-2 space-y-1 bg-white">
            {clients.filter(c => workerForm.assignedClients?.includes(c.id)).map(c => {
              const dates = workerForm.assignedClientDates?.[c.id] || {};
              const isOpen = !!expandedClientPeriods[c.id];
              return (
                <div key={c.id} className="border border-slate-100 rounded-lg overflow-hidden">
                  <button type="button" onClick={() => setExpandedClientPeriods(prev => ({ ...prev, [c.id]: !prev[c.id] }))} className="w-full flex items-center justify-between px-2.5 py-1.5 hover:bg-slate-50 transition-colors">
                    <span className="text-[9px] font-black uppercase truncate" style={{ color: '#1B3A57' }}>{c.name}</span>
                    <ChevronDown size={11} className={`text-slate-400 shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {isOpen && (
                    <div className="px-2 pb-2 pt-1.5 space-y-1.5 border-t border-slate-50 bg-slate-50/40">
                      <div className="grid grid-cols-2 gap-1.5">
                        <div>
                          <label className="text-[8px] font-bold uppercase text-slate-400 block mb-0.5">Início</label>
                          <input type="date" value={dates.dataInicio || ''} onChange={e => setWorkerForm(prev => ({ ...prev, assignedClientDates: { ...(prev.assignedClientDates || {}), [c.id]: { ...dates, dataInicio: e.target.value } } }))} className="w-full bg-white border border-slate-200 rounded p-1.5 text-[10px] font-bold outline-none focus:border-[#1B3A57] transition-all" />
                        </div>
                        <div>
                          <label className="text-[8px] font-bold uppercase text-slate-400 block mb-0.5">Fim</label>
                          <input type="date" value={dates.dataFim || ''} onChange={e => setWorkerForm(prev => ({ ...prev, assignedClientDates: { ...(prev.assignedClientDates || {}), [c.id]: { ...dates, dataFim: e.target.value } } }))} className="w-full bg-white border border-slate-200 rounded p-1.5 text-[10px] font-bold outline-none focus:border-[#1B3A57] transition-all" />
                        </div>
                      </div>
                      {workerForm.id && (
                        <button onClick={() => handleSaveClientDates(c.id, dates.dataInicio || new Date().toISOString().split('T')[0], dates.dataFim || '')} className={`w-full flex items-center justify-center gap-1 py-1 rounded text-[9px] font-black uppercase transition-all text-white ${saveSuccessClientId === c.id ? 'bg-emerald-500' : ''}`} style={saveSuccessClientId === c.id ? {} : { backgroundColor: '#1B3A57' }}>
                          {saveSuccessClientId === c.id ? <><CheckCircle2 size={9} /> Gravado</> : <><Save size={9} /> Gravar</>}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>}
      </div>

      {/* CARD: Horários */}
      <div className="rounded-xl border border-slate-200 overflow-hidden">
        <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 border-b border-slate-100">
          <Timer size={12} className="text-[#869AAF]" />
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-600">Horários</span>
        </div>
        <div className="max-h-[150px] overflow-y-auto p-2 space-y-0.5 bg-white">
          {schedules.map(s => {
            const isAssigned = workerForm.assignedSchedules?.includes(s.id);
            return (
              <label key={s.id} className={`flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer transition-all ${isAssigned ? '' : 'hover:bg-slate-50'}`} style={isAssigned ? { backgroundColor: 'rgba(27,58,87,0.05)' } : {}}>
                <div className={`w-3.5 h-3.5 rounded flex items-center justify-center border shrink-0 ${isAssigned ? '' : 'border-slate-300'}`} style={isAssigned ? { backgroundColor: '#1B3A57', borderColor: '#1B3A57' } : {}}>
                  {isAssigned && <CheckCircle size={9} className="text-white" />}
                </div>
                <input type="checkbox" className="hidden" checked={isAssigned} onChange={() => {
                  const current = workerForm.assignedSchedules || [];
                  setWorkerForm(prev => ({ ...prev, assignedSchedules: current.includes(s.id) ? current.filter(id => id !== s.id) : [...current, s.id] }));
                }} />
                <span className="text-[10px] font-bold truncate" style={{ color: isAssigned ? '#1B3A57' : '#475569' }}>{s.name}</span>
              </label>
            );
          })}
        </div>
        <div className="px-2 py-2 border-t border-slate-100 bg-slate-50/50">
          <label className="text-[9px] font-bold uppercase text-slate-400 block mb-1">Padrão</label>
          <select value={workerForm.defaultScheduleId || ''} onChange={e => setWorkerForm(prev => ({ ...prev, defaultScheduleId: e.target.value }))} className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs font-semibold outline-none focus:border-[#1B3A57] transition-all">
            <option value="">Selecionar</option>
            {schedules.filter(s => workerForm.assignedSchedules?.includes(s.id)).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        {(workerForm.assignedSchedules?.length > 0) && <>
          <div className="flex items-center gap-1.5 px-3 py-1.5 border-t border-slate-100 bg-slate-50">
            <CalendarRange size={9} className="text-[#869AAF]" />
            <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Períodos</span>
            {!workerForm.id && <span className="ml-auto text-[9px] text-amber-500 font-bold">Guarde primeiro</span>}
          </div>
          <div className="p-2 space-y-1 bg-white">
            {schedules.filter(s => workerForm.assignedSchedules?.includes(s.id)).map(s => {
              const dates = workerForm.assignedScheduleDates?.[s.id] || {};
              const isOpen = !!expandedSchedulePeriods[s.id];
              return (
                <div key={s.id} className="border border-slate-100 rounded-lg overflow-hidden">
                  <button type="button" onClick={() => setExpandedSchedulePeriods(prev => ({ ...prev, [s.id]: !prev[s.id] }))} className="w-full flex items-center justify-between px-2.5 py-1.5 hover:bg-slate-50 transition-colors">
                    <span className="text-[9px] font-black uppercase truncate" style={{ color: '#1B3A57' }}>{s.name}</span>
                    <ChevronDown size={11} className={`text-slate-400 shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {isOpen && (
                    <div className="px-2 pb-2 pt-1.5 space-y-1.5 border-t border-slate-50 bg-slate-50/40">
                      <div className="grid grid-cols-2 gap-1.5">
                        <div>
                          <label className="text-[8px] font-bold uppercase text-slate-400 block mb-0.5">Início</label>
                          <input type="date" value={dates.dataInicio || ''} onChange={e => setWorkerForm(prev => ({ ...prev, assignedScheduleDates: { ...(prev.assignedScheduleDates || {}), [s.id]: { ...dates, dataInicio: e.target.value } } }))} className="w-full bg-white border border-slate-200 rounded p-1.5 text-[10px] font-bold outline-none focus:border-[#1B3A57] transition-all" />
                        </div>
                        <div>
                          <label className="text-[8px] font-bold uppercase text-slate-400 block mb-0.5">Fim</label>
                          <input type="date" value={dates.dataFim || ''} onChange={e => setWorkerForm(prev => ({ ...prev, assignedScheduleDates: { ...(prev.assignedScheduleDates || {}), [s.id]: { ...dates, dataFim: e.target.value } } }))} className="w-full bg-white border border-slate-200 rounded p-1.5 text-[10px] font-bold outline-none focus:border-[#1B3A57] transition-all" />
                        </div>
                      </div>
                      {workerForm.id && (
                        <button onClick={() => handleSaveScheduleDates(s.id, dates.dataInicio || new Date().toISOString().split('T')[0], dates.dataFim || '')} className={`w-full flex items-center justify-center gap-1 py-1 rounded text-[9px] font-black uppercase transition-all text-white ${saveSuccessScheduleId === s.id ? 'bg-emerald-500' : ''}`} style={saveSuccessScheduleId === s.id ? {} : { backgroundColor: '#1B3A57' }}>
                          {saveSuccessScheduleId === s.id ? <><CheckCircle2 size={9} /> Gravado</> : <><Save size={9} /> Gravar</>}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>}
      </div>
    </>
  );
}

export default WorkerForm;
