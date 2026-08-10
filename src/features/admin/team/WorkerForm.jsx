import React, { useState, useEffect } from 'react';
import { useApp } from '../../../context/AppContext';
import { useTeam } from '../contexts/TeamContext';
import {
  User, ShieldOff, Receipt, Wallet, CalendarRange, Save,
  Building2, Timer, CheckCircle, CheckCircle2, ChevronDown,
  ShieldCheck, AlertTriangle
} from 'lucide-react';
import SelectProfissaoEmpresa from '../../../components/SelectProfissaoEmpresa';
import { findProfissaoByCodigo } from '../../../data/profissoesEmpresa';

const fmtTs = iso => {
  if (!iso) return null;
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
};

const inp = 'w-full bg-white border border-slate-200 rounded-lg py-[3px] px-2.5 text-sm font-semibold outline-none focus:border-[#1B3A57] focus:ring-2 focus:ring-[#1B3A57]/10 transition-all';
const fmtDate = iso => { if (!iso) return 'atual'; const p = iso.split('T')[0].split('-'); return `${p[2]}/${p[1]}/${p[0].slice(2)}`; };
const lbl = 'block text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1';

const WorkerForm = () => {
  const { clients, schedules } = useApp();
  const { workerForm, setWorkerForm, handleSaveWorker } = useTeam();
  const [saveSuccessClientId, setSaveSuccessClientId] = useState(null);
  const [saveSuccessScheduleId, setSaveSuccessScheduleId] = useState(null);
  const [expandedClientPeriods, setExpandedClientPeriods] = useState({});
  const [expandedSchedulePeriods, setExpandedSchedulePeriods] = useState({});
  const [valorHoraHistory, setValorHoraHistory] = useState([]);
  const [employmentHistory, setEmploymentHistory] = useState([]);
  const supabase = window.supabaseInstance;

  useEffect(() => {
    if (!workerForm.id || !supabase) { setValorHoraHistory([]); setEmploymentHistory([]); return; }
    supabase.from('worker_valorhora_history').select('*').eq('worker_id', workerForm.id).order('data_alteracao', { ascending: false }).limit(4).then(({ data }) => setValorHoraHistory(data || []));
    supabase.from('worker_employment_history').select('*').eq('worker_id', workerForm.id).order('created_at', { ascending: false }).limit(4).then(({ data }) => setEmploymentHistory(data || []));
  }, [workerForm.id]);

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
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* ── COLUNA ESQUERDA ── */}
        <div className="lg:col-span-2 space-y-5">

          {/* Dados do Colaborador */}
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
              <div>
                <label className={lbl}>Data Início</label>
                <input type="date" value={workerForm.dataInicio || ''} onChange={f('dataInicio')} className={inp} />
              </div>
              <div>
                <label className={lbl}>Data Fim</label>
                <input type="date" value={workerForm.dataFim || ''} onChange={f('dataFim')} className={inp} />
              </div>
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

          {/* IRS */}
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

          {/* Segurança Social */}
          <div className="border-t border-slate-100 pt-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5 mb-3">
              <ShieldCheck size={10} /> Segurança Social
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
                    : <p className="text-xs text-slate-400 py-[5px] px-2.5 bg-slate-50 border border-slate-200 rounded-lg italic">Sem profissão definida — selecionar em Dados do Colaborador</p>;
                })()}
              </div>
              <div>
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
            {/* Estado de comunicação SS (só leitura) */}
            {workerForm.id && (
              <div className="mt-3 grid grid-cols-2 gap-2">
                <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-bold border ${workerForm.ss_admissao_comunicada_em ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-amber-50 border-amber-200 text-amber-700'}`}>
                  {workerForm.ss_admissao_comunicada_em
                    ? <><CheckCircle size={10} className="shrink-0" /> Admissão: {fmtTs(workerForm.ss_admissao_comunicada_em)}</>
                    : <><AlertTriangle size={10} className="shrink-0" /> Admissão por comunicar</>}
                </div>
                <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-bold border ${workerForm.ss_cessacao_comunicada_em ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : workerForm.dataFim ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-slate-50 border-slate-200 text-slate-400'}`}>
                  {workerForm.ss_cessacao_comunicada_em
                    ? <><CheckCircle size={10} className="shrink-0" /> Cessação: {fmtTs(workerForm.ss_cessacao_comunicada_em)}</>
                    : workerForm.dataFim
                      ? <><AlertTriangle size={10} className="shrink-0" /> Cessação por comunicar</>
                      : <span className="text-slate-400">Cessação — n/a</span>}
                </div>
              </div>
            )}
          </div>

          {/* Financeiro */}
          <div className="border-t border-slate-100 pt-4">
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
        </div>

        {/* ── COLUNA DIREITA ── */}
        <div className="space-y-3">

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

          {/* Gravar */}
          <button onClick={handleSaveWorker} className="w-full p-3 rounded-xl font-black text-xs uppercase shadow-lg transition-all flex items-center justify-center gap-2" style={{ backgroundColor: '#EB8D00', color: '#1B3A57' }}>
            <Save size={14} /> Gravar Colaborador
          </button>
        </div>
      </div>
    </div>
  );
};

export default WorkerForm;
