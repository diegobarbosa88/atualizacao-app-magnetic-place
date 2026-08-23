import React, { useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { authFetch } from '../../utils/authFetch';
import CompanySignatureSettings from '../../components/common/CompanySignatureSettings';
import ContadorAcessoPanel from './ContadorAcessoPanel';
import SSConsultasPanel from './team/SSConsultasPanel';
import ImportarContratosSSDModal from './team/ImportarContratosSSDModal';
import SectionHeaderShell from '../../components/common/SectionHeaderShell';
import SubTabBar from '../../components/common/SubTabBar';
import {
  Settings, Lock, Building2, Palette, Sparkles, CheckCircle,
  ShieldCheck, ShieldOff, UserPlus, Wrench, Loader2, CalendarX, Plus, Trash2,
  Globe, TestTube2, CheckCircle2, AlertTriangle, ChevronDown, ChevronUp,
  FileSpreadsheet, Upload,
} from 'lucide-react';
import ModalShell from '../../components/common/ModalShell';
import { calculateDuration } from '../../utils/formatUtils';
import { roundTimeToIntervalTimeUp, roundTimeToIntervalTimeDown } from '../../utils/timeUtils';
import { FT } from '../../styles/designTokens';

export default function AdminSettings() {
  const {
    workers,
    systemSettings,
    setSystemSettings,
    saveSystemSettings,
    saveToDb,
    logs,
    companySignature,
    saveCompanySignature,
    saveAbsenceConfig,
  } = useApp();

  const absenceConfig = systemSettings?.absenceConfig || {
    absence_reasons: ['Doença', 'Consulta médica', 'Emergência familiar', 'Férias', 'Assunto pessoal', 'Outro'],
    absence_notify_client: false,
  };
  const [newReason, setNewReason] = useState('');
  const [geminiKeyInput, setGeminiKeyInput] = useState(systemSettings.geminiApiKey || '');

  const updateSetting = (key, value) => saveSystemSettings({ ...systemSettings, [key]: value });

  React.useEffect(() => {
    if (systemSettings.geminiApiKey) setGeminiKeyInput(systemSettings.geminiApiKey);
  }, [systemSettings.geminiApiKey]);

  const nonAdminWorkers = workers.filter(w => !w.isAdmin);

  const [adminFormMode, setAdminFormMode] = useState(null);
  const [adminForm, setAdminForm] = useState({ id: null, name: '', nif: '', selectedWorkerId: '' });
  const [showRecalcModal, setShowRecalcModal] = useState(false);
  const [recalcProgress, setRecalcProgress] = useState({ current: 0, total: 0, done: false });

  const [showImportarContratos, setShowImportarContratos] = useState(false);

  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'geral';
  const setTab = (tab) => setSearchParams({ tab });

  // Estado do painel Segurança Social
  const [ssStatus, setSsStatus] = useState(null); // { configurado, ambiente, nissEmpresa }
  const [ssPingResult, setSsPingResult] = useState(null); // { ok, erro? }
  const [ssPingLoading, setSsPingLoading] = useState(false);
  const [ssPsiGuideOpen, setSsPsiGuideOpen] = useState(false);

  React.useEffect(() => {
    authFetch('/api/seguranca-social?action=status')
      .then(r => r.json())
      .then(d => setSsStatus(d))
      .catch(() => setSsStatus({ configurado: false, ambiente: 'teste', nissEmpresa: null }));
  }, []);

  async function handleSsPing() {
    setSsPingLoading(true);
    setSsPingResult(null);
    try {
      const r = await authFetch('/api/seguranca-social?action=ping');
      const d = await r.json();
      setSsPingResult(d);
    } catch {
      setSsPingResult({ ok: false, erro: 'Erro de ligação à API.' });
    } finally {
      setSsPingLoading(false);
    }
  }

  const handleOpenAddAdmin = () => {
    setAdminForm({ id: null, name: '', nif: '', selectedWorkerId: '' });
    setAdminFormMode('new');
  };

  const handleSelectExistingWorker = (workerId) => {
    const w = workers.find(x => x.id === workerId);
    if (!w) return;
    setAdminForm({ id: w.id, name: w.name, nif: w.nif || '', selectedWorkerId: workerId });
    setAdminFormMode('existing');
  };

  const handleEditAdmin = (worker) => {
    setAdminForm({ id: worker.id, name: worker.name, nif: worker.nif || '', selectedWorkerId: worker.id });
    setAdminFormMode('edit');
  };

  const handleSaveAdmin = async () => {
    if (!adminForm.name.trim() || !adminForm.nif.trim()) return alert('Nome e senha são obrigatórios.');
    if (adminFormMode === 'edit' || adminFormMode === 'existing') {
      const existing = workers.find(w => w.id === adminForm.id);
      await saveToDb('workers', adminForm.id, { ...existing, name: adminForm.name.trim(), nif: adminForm.nif.trim(), isAdmin: true });
    } else {
      const id = `worker_${Date.now()}`;
      await saveToDb('workers', id, { id, name: adminForm.name.trim(), nif: adminForm.nif.trim(), isAdmin: true, status: 'ativo', assignedClients: [], assignedSchedules: [] });
    }
    setAdminFormMode(null);
    setAdminForm({ id: null, name: '', nif: '', selectedWorkerId: '' });
  };

function NavModePicker({ value, onChange }) {
  const current = value || 'sidebar';
  return (
    <div className="grid grid-cols-2 gap-3">
      <NavModeOption
        selected={current === 'sidebar'}
        onClick={() => onChange('sidebar')}
        title="Menu Lateral"
        subtitle="Sidebar à esquerda"
        preview={
          <svg viewBox="0 0 80 50" className="w-full h-12">
            <rect x="2" y="2" width="22" height="46" rx="3" fill="#eef2ff" stroke="#c7d2fe" />
            <rect x="6" y="7" width="14" height="3.5" rx="1" fill={FT.navy} />
            <rect x="6" y="14" width="14" height="3.5" rx="1" fill="#cbd5e1" />
            <rect x="6" y="21" width="14" height="3.5" rx="1" fill="#cbd5e1" />
            <rect x="6" y="28" width="14" height="3.5" rx="1" fill="#cbd5e1" />
            <rect x="6" y="35" width="14" height="3.5" rx="1" fill="#cbd5e1" />
            <rect x="28" y="2" width="50" height="46" rx="3" fill="#f8fafc" stroke="#e2e8f0" />
            <rect x="32" y="8" width="22" height="3" rx="1" fill="#cbd5e1" />
            <rect x="32" y="15" width="40" height="3" rx="1" fill="#e2e8f0" />
            <rect x="32" y="22" width="40" height="3" rx="1" fill="#e2e8f0" />
            <rect x="32" y="29" width="40" height="3" rx="1" fill="#e2e8f0" />
          </svg>
        }
      />
      <NavModeOption
        selected={current === 'topbar'}
        onClick={() => onChange('topbar')}
        title="Barra Superior"
        subtitle="Topbar horizontal"
        preview={
          <svg viewBox="0 0 80 50" className="w-full h-12">
            <rect x="2" y="2" width="76" height="10" rx="2" fill="#f8fafc" stroke="#e2e8f0" />
            <rect x="5" y="4.5" width="14" height="5" rx="1" fill={FT.navy} />
            <rect x="21" y="4.5" width="14" height="5" rx="1" fill="#cbd5e1" />
            <rect x="37" y="4.5" width="14" height="5" rx="1" fill="#cbd5e1" />
            <rect x="53" y="4.5" width="14" height="5" rx="1" fill="#cbd5e1" />
            <rect x="2" y="15" width="76" height="33" rx="3" fill="#f8fafc" stroke="#e2e8f0" />
            <rect x="6" y="20" width="22" height="3" rx="1" fill="#cbd5e1" />
            <rect x="6" y="27" width="68" height="3" rx="1" fill="#e2e8f0" />
            <rect x="6" y="34" width="68" height="3" rx="1" fill="#e2e8f0" />
            <rect x="6" y="41" width="68" height="3" rx="1" fill="#e2e8f0" />
          </svg>
        }
      />
    </div>
  );
}

function NavModeOption({ selected, onClick, title, subtitle, preview }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`relative text-left rounded-2xl border-2 p-3 transition-all ${
        selected
          ? 'shadow-sm'
          : 'border-slate-200 bg-white hover:border-slate-300'
      }`}
      style={selected ? { borderColor: FT.orange, backgroundColor: 'rgba(235,141,0,0.06)' } : {}}
    >
      {selected && (
        <CheckCircle size={16} className="absolute top-2 right-2" style={{ color: FT.orange }} />
      )}
      <div className="mb-2">{preview}</div>
      <p className="text-xs font-black text-slate-700">{title}</p>
      <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">{subtitle}</p>
    </button>
  );
}

  const handleRevokeAdmin = async (worker) => {
    await saveToDb('workers', worker.id, { ...worker, isAdmin: false });
  };

  const handleRecalcHours = useCallback(async () => {
    const interval = systemSettings?.minuteInterval || 30;
    const logsToFix = logs.filter(l => l.startTime && l.endTime);
    if (logsToFix.length === 0) { setRecalcProgress({ current: 0, total: 0, done: true }); return; }
    setRecalcProgress({ current: 0, total: logsToFix.length, done: false });
    let fixed = 0;
    for (let i = 0; i < logsToFix.length; i++) {
      const log = logsToFix[i];
      const roundedStart = roundTimeToIntervalTimeUp(log.startTime, interval);
      const roundedEnd = roundTimeToIntervalTimeDown(log.endTime, interval);
      const roundedBreakStart = log.breakStart ? roundTimeToIntervalTimeUp(log.breakStart, interval) : null;
      const roundedBreakEnd = log.breakEnd ? roundTimeToIntervalTimeDown(log.breakEnd, interval) : null;
      const newHours = calculateDuration(roundedStart, roundedEnd, roundedBreakStart, roundedBreakEnd);
      await saveToDb('logs', log.id, { ...log, hours: newHours });
      fixed++;
      setRecalcProgress(prev => ({ ...prev, current: fixed }));
    }
    setRecalcProgress(prev => ({ ...prev, done: true }));
  }, [logs, systemSettings, saveToDb]);

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-8">
      <SectionHeaderShell
        icon={<Settings size={18} />}
        title="Configurações do Sistema"
      />

      {/* Navegação por tabs */}
      <SubTabBar
        tabs={[
          { id: 'geral', label: 'Geral' },
          { id: 'utilizadores', label: 'Utilizadores e Acesso' },
          { id: 'psi', label: 'Segurança Social PSI' },
          { id: 'integracoes', label: 'Integrações' },
        ]}
        activeTab={activeTab}
        onTabChange={setTab}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 lg:gap-8">

        {activeTab === 'utilizadores' && (<>
        {/* Administradores */}
        <div className="bg-white p-4 sm:p-6 lg:p-8 rounded-2xl sm:rounded-[2.5rem] shadow-sm border border-slate-100 lg:col-span-2">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl" style={{ backgroundColor: 'rgba(134,154,175,0.15)', color: FT.slate }}><ShieldCheck size={20} /></div>
              <h3 className="font-black text-lg text-slate-800">Administradores</h3>
            </div>
            <button onClick={handleOpenAddAdmin} className="flex items-center gap-2 text-[var(--navy)] px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all" style={{ backgroundColor: FT.orange }}>
              <UserPlus size={14} /> Adicionar
            </button>
          </div>

          <div className="space-y-2 mb-4">
            {workers.filter(w => w.isAdmin).length === 0 && !adminFormMode && (
              <p className="text-xs text-slate-400 font-bold text-center py-4">Nenhum administrador configurado.</p>
            )}
            {workers.filter(w => w.isAdmin).map(w => {
              const parts = (w.name || '').trim().split(/\s+/);
              const username = parts.length > 1 ? (parts[0] + parts[parts.length - 1]).toLowerCase() : parts[0].toLowerCase();
              const isEditing = adminFormMode === 'edit' && adminForm.id === w.id;
              return (
                <div key={w.id} className={`p-3 bg-slate-50 rounded-2xl border transition-all ${isEditing ? 'border-indigo-200 bg-indigo-50/30' : 'border-slate-100'}`}>
                  {isEditing ? (
                    <div className="space-y-2">
                      <input type="text" value={adminForm.name} onChange={e => setAdminForm(p => ({ ...p, name: e.target.value }))} placeholder="Nome completo" className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-sm outline-none focus:ring-2 focus:ring-[var(--navy)]" />
                      <input type="text" value={adminForm.nif} onChange={e => setAdminForm(p => ({ ...p, nif: e.target.value }))} placeholder="Senha (NIF)" className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-sm outline-none focus:ring-2 focus:ring-[var(--navy)]" />
                      <div className="flex gap-2 pt-1">
                        <button onClick={handleSaveAdmin} className="flex-1 text-white py-2 rounded-xl font-black text-xs uppercase tracking-wider transition-all" style={{ backgroundColor: FT.navy }}>Guardar</button>
                        <button onClick={() => setAdminFormMode(null)} className="px-4 py-2 rounded-xl font-black text-xs text-slate-500 hover:bg-slate-100 transition-all">Cancelar</button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-black text-slate-800">{w.name}</p>
                        <p className="text-[10px] text-slate-400 font-mono">{username}</p>
                      </div>
                      <div className="flex gap-1">
                        <button onClick={() => handleEditAdmin(w)} className="text-xs font-bold hover:bg-slate-100 px-3 py-1.5 rounded-xl transition-all" style={{ color: FT.slate }}>Editar</button>
                        <button onClick={() => handleRevokeAdmin(w)} className="flex items-center gap-1 text-xs font-bold text-rose-500 hover:bg-rose-50 px-3 py-1.5 rounded-xl transition-all"><ShieldOff size={12} /> Revogar</button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {(adminFormMode === 'new' || adminFormMode === 'existing') && (
            <div className="border-t border-slate-100 pt-5 space-y-3">
              <p className="text-xs font-black text-slate-500 uppercase tracking-widest">Novo Administrador</p>
              {nonAdminWorkers.length > 0 && (
                <select
                  value={adminForm.selectedWorkerId}
                  onChange={e => handleSelectExistingWorker(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm outline-none focus:ring-2 focus:ring-[var(--navy)]"
                >
                  <option value="">— Selecionar trabalhador existente —</option>
                  {nonAdminWorkers.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              )}
              <input type="text" placeholder="Nome completo" value={adminForm.name} onChange={e => setAdminForm(p => ({ ...p, name: e.target.value }))} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm outline-none focus:ring-2 focus:ring-[var(--navy)]" />
              <input type="text" placeholder="Senha (NIF)" value={adminForm.nif} onChange={e => setAdminForm(p => ({ ...p, nif: e.target.value }))} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm outline-none focus:ring-2 focus:ring-[var(--navy)]" />
              <div className="flex gap-2">
                <button onClick={handleSaveAdmin} className="flex-1 text-[var(--navy)] py-3 rounded-xl font-black text-xs uppercase tracking-wider transition-all" style={{ backgroundColor: FT.orange }}>Criar</button>
                <button onClick={() => { setAdminFormMode(null); setAdminForm({ id: null, name: '', nif: '', selectedWorkerId: '' }); }} className="px-4 py-3 rounded-xl font-black text-xs text-slate-500 hover:bg-slate-100 transition-all">Cancelar</button>
              </div>
            </div>
          )}
        </div>

        {/* Alterar Senha */}
        <div className="bg-white p-4 sm:p-6 lg:p-8 rounded-2xl sm:rounded-[2.5rem] shadow-sm border border-slate-100">
          <div className="flex items-center gap-3 mb-6">
            <div className="bg-amber-50 p-2 rounded-xl text-amber-600"><Lock size={20} /></div>
            <h3 className="font-black text-lg text-slate-800">Segurança da Conta</h3>
          </div>
          <div className="space-y-4">
            <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">Alterar Senha Administrador</p>
            <div className="flex gap-2">
              <input type="password" placeholder="Nova Senha" className="flex-1 bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm outline-none" id="new-admin-pass" />
              <button onClick={() => { const passEl = document.getElementById('new-admin-pass'); if (!passEl) return; const newPass = passEl.value; if (!newPass) return; updateSetting('adminPassword', newPass); alert('Senha alterada com sucesso! A nova senha será necessária no próximo login.'); passEl.value = ''; }} className="text-white px-6 py-2 rounded-xl font-bold text-xs uppercase transition-all hover:opacity-90" style={{ backgroundColor: FT.navy }}>Atualizar</button>
            </div>
          </div>
        </div>

        <ContadorAcessoPanel />
        </>)}

        {activeTab === 'psi' && (<>
        {/* Segurança Social — Comunicações PSI */}
        <div className="bg-white p-4 sm:p-6 lg:p-8 rounded-2xl sm:rounded-[2.5rem] shadow-sm border border-slate-100">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-xl" style={{ backgroundColor: 'rgba(134,154,175,0.15)', color: FT.slate }}><Globe size={20} /></div>
            <div>
              <h3 className="font-black text-lg text-slate-800">Segurança Social — Comunicações</h3>
              <p className="text-xs text-slate-400 font-medium">Plataforma de Serviços de Interoperabilidade (PSI)</p>
            </div>
          </div>

          {/* Status das credenciais */}
          <div className="space-y-3">
            {ssStatus === null ? (
              <div className="flex items-center gap-2 text-slate-400 text-xs"><Loader2 size={13} className="animate-spin" /> A verificar configuração…</div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold border ${ssStatus.configurado ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
                  {ssStatus.configurado ? <CheckCircle2 size={13} /> : <AlertTriangle size={13} />}
                  {ssStatus.configurado ? 'Credenciais configuradas' : 'Credenciais em falta'}
                </div>
                <div className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold border ${ssStatus.ambiente === 'producao' ? 'bg-slate-50 border-slate-200 text-slate-700' : 'bg-orange-50 border-orange-200 text-orange-700'}`}>
                  {ssStatus.ambiente === 'producao' ? <Globe size={13} /> : <TestTube2 size={13} />}
                  {ssStatus.ambiente === 'producao' ? 'Produção' : 'Modo teste'}
                </div>
                {ssStatus.nissEmpresa && (
                  <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold border bg-slate-50 border-slate-200 text-slate-500">
                    NISS: <span className="font-mono">{ssStatus.nissEmpresa}</span>
                  </div>
                )}
              </div>
            )}

            {/* Botão testar ligação */}
            {ssStatus?.configurado && (
              <div className="flex items-center gap-3">
                <button
                  onClick={handleSsPing}
                  disabled={ssPingLoading}
                  className="flex items-center gap-2 px-4 py-2 text-white rounded-xl text-xs font-black transition-colors disabled:opacity-60" style={{ backgroundColor: FT.navy }}
                >
                  {ssPingLoading ? <Loader2 size={13} className="animate-spin" /> : <Globe size={13} />}
                  Testar Ligação ao Webservice
                </button>
                {ssPingResult && (
                  <span className={`flex items-center gap-1.5 text-xs font-bold ${ssPingResult.ok ? 'text-emerald-600' : 'text-red-600'}`}>
                    {ssPingResult.ok ? <CheckCircle2 size={13} /> : <AlertTriangle size={13} />}
                    {ssPingResult.ok ? `Ligação OK (${ssStatus?.ambiente || 'teste'})` : ssPingResult.erro}
                  </span>
                )}
              </div>
            )}

            {/* Configuração (informação — valores vêm de env vars Vercel) */}
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 space-y-1.5">
              <p className="text-xs font-black text-blue-700 uppercase tracking-wide mb-2">Como configurar</p>
              <p className="text-xs text-blue-600 leading-relaxed">
                As credenciais PSI são geridas como variáveis de ambiente no <strong>Vercel Dashboard</strong> (Settings → Environment Variables) — nunca ficam expostas no browser:
              </p>
              <div className="bg-white border border-blue-200 rounded-lg p-2.5 font-mono text-[10px] text-slate-600 space-y-0.5">
                <div><span className="text-blue-500">SS_NISS_EMPRESA</span> = NISS da empresa (11 dígitos)</div>
                <div><span className="text-blue-500">SS_PSI_TOKEN</span> = token gerado em SSD → Gestão de autenticação → Tokens de acesso</div>
                <div><span className="text-blue-500">SS_AMBIENTE</span> = <span className="text-orange-500">teste</span> <span className="text-slate-400">(mudar para "producao" após testes)</span></div>
              </div>
            </div>

            {/* Guia de adesão à PSI */}
            <div className="border border-slate-100 rounded-xl overflow-hidden">
              <button
                onClick={() => setSsPsiGuideOpen(v => !v)}
                className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors"
              >
                <span className="text-xs font-black text-slate-700 uppercase tracking-wide">Como aderir à PSI (pré-requisito)</span>
                {ssPsiGuideOpen ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
              </button>
              {ssPsiGuideOpen && (
                <div className="px-4 py-4 space-y-3 text-xs text-slate-600 bg-white border-t border-slate-100">
                  <div className="flex gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-600 font-black text-[10px] flex items-center justify-center shrink-0">1</span>
                    <div><strong>Aderir em produção:</strong> Aceder à Segurança Social Direta (seg-social.pt) → Perfil → <em>Aderir à Plataforma de Serviços de Interoperabilidade</em> → Aceitar termos. A password a usar é a mesma password de login do Portal da Segurança Social Direta — não existe uma password PSI separada.</div>
                  </div>
                  <div className="flex gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-orange-100 text-orange-600 font-black text-[10px] flex items-center justify-center shrink-0">2</span>
                    <div><strong>Pedir acesso ao ambiente de teste:</strong> Enviar email a <strong>suporte-psi@seg-social.pt</strong> com: NISS da empresa, nome do solicitante e telefone. O acesso é concedido em 24–48h.</div>
                  </div>
                  <div className="flex gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-600 font-black text-[10px] flex items-center justify-center shrink-0">3</span>
                    <div><strong>Configurar variáveis de ambiente:</strong> No Vercel Dashboard → Settings → Environment Variables, adicionar <code className="bg-slate-100 px-1 rounded text-[10px]">SS_NISS_EMPRESA</code>, <code className="bg-slate-100 px-1 rounded text-[10px]">SS_PSI_TOKEN</code> e <code className="bg-slate-100 px-1 rounded text-[10px]">SS_AMBIENTE=teste</code>. O token é gerado em SSD → Gestão de autenticação → Tokens de acesso → Criar token de acesso (o valor só é mostrado uma vez — se perdido, revogar e criar novo).</div>
                  </div>
                  <div className="flex gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-600 font-black text-[10px] flex items-center justify-center shrink-0">4</span>
                    <div><strong>Testar:</strong> Clicar "Testar Ligação" acima para confirmar que as credenciais estão corretas antes de fazer comunicações reais.</div>
                  </div>
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                    <p className="font-bold text-amber-700 mb-1">Aviso legal (DL n.º 127/2025, em vigor desde 1/1/2026)</p>
                    <p className="text-amber-600 leading-relaxed">Admissão deve ser comunicada <strong>até ao início da execução do contrato</strong>. Cessação até ao <strong>dia 10 do mês seguinte</strong>. Incumprimento = contraordenação muito grave (até €24.000).</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Segurança Social — Consultas PSI (Fase 1) */}
        {ssStatus?.configurado && (
          <div className="bg-white p-4 sm:p-6 lg:p-8 rounded-2xl sm:rounded-[2.5rem] shadow-sm border border-slate-100">
            <div className="flex items-center gap-3 mb-5">
              <div className="p-2 rounded-xl" style={{ backgroundColor: 'rgba(134,154,175,0.15)', color: FT.slate }}><Globe size={20} /></div>
              <div>
                <h3 className="font-black text-lg text-slate-800">Segurança Social — Consultas</h3>
                <p className="text-xs text-slate-400 font-medium">Comprovativos · Documentos · Remunerações Permanentes</p>
              </div>
            </div>
            <SSConsultasPanel />
          </div>
        )}

        {/* Importar Contratos da SS Direta */}
        <div className="bg-white p-4 sm:p-6 lg:p-8 rounded-2xl sm:rounded-[2.5rem] shadow-sm border border-slate-100">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl shrink-0" style={{ backgroundColor: 'rgba(134,154,175,0.15)', color: FT.slate }}><FileSpreadsheet size={20} /></div>
              <div>
                <h3 className="font-black text-lg text-slate-800">Importar Contratos da SS Direta</h3>
                <p className="text-xs text-slate-400 font-medium mt-0.5">Sincronizar vínculos exportados da Segurança Social Direta com os perfis dos trabalhadores</p>
              </div>
            </div>
            <button
              onClick={() => setShowImportarContratos(true)}
              className="shrink-0 flex items-center gap-2 px-4 py-2.5 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all" style={{ backgroundColor: FT.navy }}
            >
              <Upload size={13} /> Importar CSV
            </button>
          </div>
          <div className="mt-4 text-xs text-slate-400 space-y-1 pl-11">
            <p>1. Na SS Direta: <span className="font-semibold text-slate-500">Emprego → Vínculos de trabalhadores → Exportar</span></p>
            <p>2. Fazer upload do CSV — pré-visualização mostra alterações campo a campo antes de aplicar</p>
            <p>3. Matching por NISS · profissão, contrato, regime, horas e vencimento base sincronizados automaticamente</p>
          </div>
        </div>

        </>)}

        {activeTab === 'integracoes' && (<>
        {/* Gemini API */}
        <div className="bg-white p-4 sm:p-6 lg:p-8 rounded-2xl sm:rounded-[2.5rem] shadow-sm border border-slate-100 lg:col-span-2">
          <div className="flex items-center gap-3 mb-6">
            <div className="bg-amber-50 p-2 rounded-xl text-amber-600"><Sparkles size={20} /></div>
            <h3 className="font-black text-lg text-slate-800">Inteligência Artificial — Gemini</h3>
          </div>
          <div className="max-w-lg space-y-4">
            <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">Chave API Gemini</p>
            <p className="text-[10px] text-slate-400">Obtenha a sua chave em <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer" className="text-indigo-500 underline">aistudio.google.com</a></p>
            <div className="flex gap-2">
              <input type="password" placeholder="AIza..." value={geminiKeyInput} onChange={e => setGeminiKeyInput(e.target.value)} className="flex-1 bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm outline-none font-mono" />
              <button onClick={() => { const key = geminiKeyInput.trim(); updateSetting('geminiApiKey', key); alert(key ? 'Chave API guardada! A IA está agora activa.' : 'Chave API removida.'); }} className="text-white px-6 py-2 rounded-xl font-bold text-xs uppercase transition-all whitespace-nowrap" style={{ backgroundColor: FT.navy }}>Guardar</button>
            </div>
            {systemSettings.geminiApiKey ? (
              <p className="text-[10px] text-emerald-600 font-bold flex items-center gap-1"><span>•</span> IA activa</p>
            ) : (
              <p className="text-[10px] text-slate-400 font-bold flex items-center gap-1"><span>•</span> IA inactiva — configure a chave</p>
            )}
          </div>
        </div>
        </>)}

        {activeTab === 'geral' && (<>
        {/* Identidade Visual */}
        <div className="bg-white p-4 sm:p-6 lg:p-8 rounded-2xl sm:rounded-[2.5rem] shadow-sm border border-slate-100">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-xl" style={{ backgroundColor: 'rgba(134,154,175,0.15)', color: FT.slate }}><Building2 size={20} /></div>
            <h3 className="font-black text-lg text-slate-800">Identidade da Empresa</h3>
          </div>
          <div className="space-y-4">
            <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">Nome da Empresa</p>
            <input
              type="text"
              value={systemSettings.companyName}
              onChange={(e) => setSystemSettings(prev => ({ ...prev, companyName: e.target.value }))}
              onBlur={(e) => updateSetting('companyName', e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-[var(--navy)] outline-none font-bold"
            />
            <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">Morada</p>
            <input
              type="text"
              value={systemSettings.companyAddress || ''}
              onChange={(e) => setSystemSettings(prev => ({ ...prev, companyAddress: e.target.value }))}
              onBlur={(e) => updateSetting('companyAddress', e.target.value)}
              placeholder="Rua, nº, código postal, localidade"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-[var(--navy)] outline-none font-bold"
            />
            <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">NIF</p>
            <input
              type="text"
              value={systemSettings.companyNif || ''}
              onChange={(e) => setSystemSettings(prev => ({ ...prev, companyNif: e.target.value }))}
              onBlur={(e) => updateSetting('companyNif', e.target.value)}
              placeholder="Nº de Identificação Fiscal"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-[var(--navy)] outline-none font-bold"
            />
          </div>
        </div>

        {/* Assinatura da Empresa */}
        <CompanySignatureSettings
          companySignature={companySignature}
          saveCompanySignature={saveCompanySignature}
        />

        {/* Personalização Visual */}
        <div className="bg-white p-4 sm:p-6 lg:p-8 rounded-2xl sm:rounded-[2.5rem] shadow-sm border border-slate-100">
          <div className="flex items-center gap-3 mb-6">
            <div className="bg-emerald-50 p-2 rounded-xl text-emerald-600"><Palette size={20} /></div>
            <h3 className="font-black text-lg text-slate-800">Visual e Tema</h3>
          </div>
          <div className="space-y-6">
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
              <div className="mb-3">
                <p className="text-sm font-bold text-slate-700">Layout de Navegação</p>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Escolha entre menu lateral ou barra superior</p>
              </div>
              <NavModePicker
                value={systemSettings.navMode || 'sidebar'}
                onChange={(v) => updateSetting('navMode', v)}
              />
            </div>
            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
              <div>
                <p className="text-sm font-bold text-slate-700">Largura do App (Desktop)</p>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{systemSettings.appWidth}px</p>
              </div>
              <input
                type="range"
                min="1000"
                max="4000"
                step="20"
                value={Number(systemSettings.appWidth)}
                onChange={(e) => {
                  const val = e.target.value;
                  setSystemSettings(prev => ({ ...prev, appWidth: val }));
                }}
                onMouseUp={(e) => updateSetting('appWidth', e.target.value)}
                onTouchEnd={(e) => updateSetting('appWidth', e.target.value)}
                className="w-32 accent-[var(--orange)]"
              />
            </div>
            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
              <div>
                <p className="text-sm font-bold text-slate-700">Modo Escuro (Interface)</p>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Ajuste de luminosidade</p>
              </div>
              <button
                onClick={() => updateSetting('darkMode', !systemSettings.darkMode)}
                className={`w-14 h-8 rounded-full transition-all flex items-center px-1 ${systemSettings.darkMode ? '' : 'bg-slate-300'}`}
                style={systemSettings.darkMode ? { backgroundColor: FT.navy } : {}}
              >
                <div className={`w-6 h-6 bg-white rounded-full shadow-md transition-all ${systemSettings.darkMode ? 'translate-x-6' : 'translate-x-0'}`} />
              </button>
            </div>
            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
              <div>
                <p className="text-sm font-bold text-slate-700">Intervalo de Arredondamento</p>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Arredonda horários a cada {systemSettings.minuteInterval || 30} min</p>
              </div>
              <select
                value={systemSettings.minuteInterval || 30}
                onChange={(e) => updateSetting('minuteInterval', Number(e.target.value))}
                className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold shadow-sm"
              >
                <option value={5}>5 min</option>
                <option value={10}>10 min</option>
                <option value={15}>15 min</option>
                <option value={30}>30 min</option>
                <option value={60}>60 min</option>
              </select>
            </div>
            <div className="flex items-center justify-between p-4 bg-amber-50 rounded-2xl border border-amber-200">
              <div>
                <p className="text-sm font-bold text-amber-700">Corrigir Hours Anteriores</p>
                <p className="text-[10px] text-amber-500 font-bold uppercase tracking-wider">Recalcular horas com arredondamento</p>
              </div>
              <button
                onClick={() => setShowRecalcModal(true)}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-colors"
              >
                Recalcular
              </button>
            </div>
          </div>
        </div>

        {/* Avisos de Falta */}
        <div className="bg-white p-4 sm:p-6 lg:p-8 rounded-2xl sm:rounded-[2.5rem] shadow-sm border border-slate-100">
          <div className="flex items-center gap-3 mb-6">
            <div className="bg-orange-50 p-2 rounded-xl text-orange-600"><CalendarX size={20} /></div>
            <h3 className="font-black text-lg text-slate-800">Avisos de Falta</h3>
          </div>
          <div className="space-y-5">
            {/* Notify client toggle */}
            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
              <div>
                <p className="text-sm font-bold text-slate-700">Mostrar email do cliente no aviso</p>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">
                  Quando activo, aparece um botão para copiar mensagem pronta ao cliente
                </p>
              </div>
              <button
                onClick={() => saveAbsenceConfig({ ...absenceConfig, absence_notify_client: !absenceConfig.absence_notify_client })}
                className={`relative w-11 h-6 rounded-full transition-colors ${absenceConfig.absence_notify_client ? 'bg-orange-500' : 'bg-slate-200'}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${absenceConfig.absence_notify_client ? 'translate-x-5' : 'translate-x-0'}`} />
              </button>
            </div>

            {/* Reasons list */}
            <div>
              <p className="text-xs font-black uppercase text-slate-500 tracking-widest mb-3">Motivos Predefinidos</p>
              <div className="space-y-2">
                {(absenceConfig.absence_reasons || []).map((r, i) => (
                  <div key={i} className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
                    <span className="flex-1 text-sm font-bold text-slate-700">{r}</span>
                    {(absenceConfig.absence_reasons || []).length > 1 && (
                      <button
                        onClick={() => {
                          const updated = (absenceConfig.absence_reasons || []).filter((_, idx) => idx !== i);
                          saveAbsenceConfig({ ...absenceConfig, absence_reasons: updated });
                        }}
                        className="p-1.5 text-slate-300 hover:text-rose-500 transition-colors rounded-lg"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <div className="flex gap-2 mt-3">
                <input
                  type="text"
                  value={newReason}
                  onChange={e => setNewReason(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && newReason.trim()) {
                      saveAbsenceConfig({ ...absenceConfig, absence_reasons: [...(absenceConfig.absence_reasons || []), newReason.trim()] });
                      setNewReason('');
                    }
                  }}
                  placeholder="Adicionar motivo..."
                  className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition-all"
                />
                <button
                  onClick={() => {
                    if (!newReason.trim()) return;
                    saveAbsenceConfig({ ...absenceConfig, absence_reasons: [...(absenceConfig.absence_reasons || []), newReason.trim()] });
                    setNewReason('');
                  }}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all hover:opacity-90"
                  style={{ backgroundColor: FT.orange, color: FT.navy }}
                >
                  <Plus size={13} /> Adicionar
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Destaque Informativo */}
        <div className="p-4 sm:p-6 lg:p-8 rounded-2xl sm:rounded-[2.5rem] shadow-xl text-white relative overflow-hidden flex flex-col justify-center" style={{ background: `linear-gradient(135deg, ${FT.navy} 0%, #0d2236 100%)` }}>
          <div className="absolute top-0 right-0 p-6 opacity-10"><Sparkles size={80} /></div>
          <h3 className="text-xl font-black uppercase tracking-tighter mb-2">Magnetic Place Pro</h3>
          <p className="text-sm font-medium opacity-80 leading-relaxed mb-6">Utilize o painel de configurações para moldar a experiência do dashboard conforme as necessidades da sua empresa.</p>
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest"><CheckCircle size={14} /> Relatórios Financeiros</div>
            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest"><CheckCircle size={14} /> Gestão de Equipa Analítica</div>
            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest"><CheckCircle size={14} /> Automação com IA</div>
          </div>
        </div>
        </>)}
      </div>

      {showRecalcModal && (
        <ModalShell
          isOpen
          onClose={() => { setShowRecalcModal(false); setRecalcProgress({ current: 0, total: 0, done: false }); }}
          busy={recalcProgress.total > 0 && !recalcProgress.done}
          title="Corrigir Hours Anteriores"
          icon={<Wrench size={20} />}
          size="md"
          closeOnOverlay={false}
          footer={
            <div className="flex gap-2 p-6">
              {!recalcProgress.done ? (
                <>
                  <button onClick={() => setShowRecalcModal(false)} className="flex-1 px-4 py-2.5 bg-slate-200 text-slate-700 rounded-xl text-xs font-black uppercase tracking-wider hover:bg-slate-300 transition-colors">
                    Cancelar
                  </button>
                  <button onClick={handleRecalcHours} disabled={recalcProgress.total > 0} className="flex-1 px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                    {recalcProgress.total > 0 ? <><Loader2 size={14} className="animate-spin" /> A processar...</> : 'Iniciar'}
                  </button>
                </>
              ) : (
                <button onClick={() => { setShowRecalcModal(false); setRecalcProgress({ current: 0, total: 0, done: false }); }} className="flex-1 px-4 py-2.5 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-colors" style={{ backgroundColor: FT.navy }}>
                  Fechar
                </button>
              )}
            </div>
          }
        >
          <div className="p-6">
            <p className="text-sm text-slate-600 mb-4">
              Este processo vai recalcular as horas de todos os registos existentes usando o arredondamento configurado (entrada ↑, saída ↓) e guardar o valor correto.
            </p>
            {recalcProgress.total === 0 && !recalcProgress.done && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4">
                <p className="text-xs text-amber-700 font-bold">Atenção:</p>
                <p className="text-xs text-amber-600 mt-1">Os registos existentes que não foram criados com arredondamento vão ser corrigidos. Esta ação não pode ser desfeita.</p>
              </div>
            )}
            {recalcProgress.total > 0 && !recalcProgress.done && (
              <div className="mb-4">
                <div className="flex justify-between text-xs font-bold text-slate-600 mb-2">
                  <span>A processar...</span>
                  <span>{recalcProgress.current} / {recalcProgress.total}</span>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-3">
                  <div className="bg-amber-600 h-3 rounded-full transition-all" style={{ width: `${(recalcProgress.current / recalcProgress.total) * 100}%` }} />
                </div>
              </div>
            )}
            {recalcProgress.done && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 mb-4">
                <p className="text-sm font-bold text-emerald-700 flex items-center gap-2">
                  <CheckCircle size={16} />
                  Correção concluída!
                </p>
                <p className="text-xs text-emerald-600 mt-1">{recalcProgress.current} registos corrigidos.</p>
              </div>
            )}
          </div>
        </ModalShell>
      )}

      {showImportarContratos && (
        <ImportarContratosSSDModal
          workers={workers}
          onClose={() => setShowImportarContratos(false)}
          onImportado={() => setShowImportarContratos(false)}
        />
      )}
    </div>
  );
}
