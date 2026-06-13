import React, { useState, useCallback } from 'react';
import { useApp } from '../../context/AppContext';
import CompanySignatureSettings from '../../components/common/CompanySignatureSettings';
import {
  Settings, Lock, Building2, Palette, Sparkles, CheckCircle,
  ShieldCheck, ShieldOff, UserPlus, Wrench, X, Loader2
} from 'lucide-react';
import { calculateDuration } from '../../utils/formatUtils';
import { roundTimeToIntervalTimeUp, roundTimeToIntervalTimeDown } from '../../utils/timeUtils';

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
  } = useApp();

  const updateSetting = (key, value) => saveSystemSettings({ ...systemSettings, [key]: value });

  const nonAdminWorkers = workers.filter(w => !w.isAdmin);

  const [adminFormMode, setAdminFormMode] = useState(null);
  const [adminForm, setAdminForm] = useState({ id: null, name: '', nif: '', selectedWorkerId: '' });
  const [showRecalcModal, setShowRecalcModal] = useState(false);
  const [recalcProgress, setRecalcProgress] = useState({ current: 0, total: 0, done: false });

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
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 sm:gap-0 mb-6 sm:mb-8">
        <h2 className="text-xl sm:text-2xl lg:text-3xl font-black flex items-center gap-2"><Settings size={22} className="text-indigo-600" /> Configurações do Sistema</h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 lg:gap-8">

        {/* Administradores */}
        <div className="bg-white p-4 sm:p-6 lg:p-8 rounded-2xl sm:rounded-[2.5rem] shadow-sm border border-slate-100 lg:col-span-2">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="bg-indigo-50 p-2 rounded-xl text-indigo-600"><ShieldCheck size={20} /></div>
              <h3 className="font-black text-lg text-slate-800">Administradores</h3>
            </div>
            <button onClick={handleOpenAddAdmin} className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider hover:bg-indigo-700 transition-all">
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
                      <input type="text" value={adminForm.name} onChange={e => setAdminForm(p => ({ ...p, name: e.target.value }))} placeholder="Nome completo" className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
                      <input type="text" value={adminForm.nif} onChange={e => setAdminForm(p => ({ ...p, nif: e.target.value }))} placeholder="Senha (NIF)" className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
                      <div className="flex gap-2 pt-1">
                        <button onClick={handleSaveAdmin} className="flex-1 bg-indigo-600 text-white py-2 rounded-xl font-black text-xs uppercase tracking-wider hover:bg-indigo-700 transition-all">Guardar</button>
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
                        <button onClick={() => handleEditAdmin(w)} className="text-xs font-bold text-indigo-500 hover:bg-indigo-50 px-3 py-1.5 rounded-xl transition-all">Editar</button>
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
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">— Selecionar trabalhador existente —</option>
                  {nonAdminWorkers.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              )}
              <input type="text" placeholder="Nome completo" value={adminForm.name} onChange={e => setAdminForm(p => ({ ...p, name: e.target.value }))} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
              <input type="text" placeholder="Senha (NIF)" value={adminForm.nif} onChange={e => setAdminForm(p => ({ ...p, nif: e.target.value }))} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
              <div className="flex gap-2">
                <button onClick={handleSaveAdmin} className="flex-1 bg-indigo-600 text-white py-3 rounded-xl font-black text-xs uppercase tracking-wider hover:bg-indigo-700 transition-all">Criar</button>
                <button onClick={() => { setAdminFormMode(null); setAdminForm({ id: null, name: '', nif: '', selectedWorkerId: '' }); }} className="px-4 py-3 rounded-xl font-black text-xs text-slate-500 hover:bg-slate-100 transition-all">Cancelar</button>
              </div>
            </div>
          )}
        </div>

        {/* Conta e Segurança */}
        <div className="bg-white p-4 sm:p-6 lg:p-8 rounded-2xl sm:rounded-[2.5rem] shadow-sm border border-slate-100">
          <div className="flex items-center gap-3 mb-6">
            <div className="bg-amber-50 p-2 rounded-xl text-amber-600"><Lock size={20} /></div>
            <h3 className="font-black text-lg text-slate-800">Segurança da Conta</h3>
          </div>
          <div className="space-y-4">
            <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">Alterar Senha Administrador</p>
            <div className="flex gap-2">
              <input
                type="password"
                placeholder="Nova Senha"
                className="flex-1 bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                id="new-admin-pass"
              />
              <button
                onClick={() => {
                  const passEl = document.getElementById('new-admin-pass');
                  if (!passEl) return;
                  const newPass = passEl.value;
                  if (!newPass) return;
                  updateSetting('adminPassword', newPass);
                  alert('Senha alterada com sucesso! A nova senha será necessária no próximo login.');
                  passEl.value = '';
                }}
                className="bg-slate-900 text-white px-6 py-2 rounded-xl font-bold text-xs uppercase hover:bg-slate-800 transition-all"
              >
                Atualizar
              </button>
            </div>
            <div className="border-t border-slate-100 pt-4">
              <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mb-2">Chave API Gemini (IA)</p>
              <p className="text-[10px] text-slate-400 mb-3">Obtenha a sua chave em <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer" className="text-indigo-500 underline">aistudio.google.com</a></p>
              <div className="flex gap-2">
                <input
                  type="password"
                  placeholder="AIza..."
                  defaultValue={systemSettings.geminiApiKey || ''}
                  className="flex-1 bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none font-mono"
                  id="gemini-api-key"
                />
                <button
                  onClick={() => {
                    const keyEl = document.getElementById('gemini-api-key');
                    const key = keyEl ? keyEl.value.trim() : '';
                    updateSetting('geminiApiKey', key);
                    alert(key ? 'Chave API guardada! A IA está agora activa.' : 'Chave API removida.');
                  }}
                  className="bg-indigo-600 text-white px-6 py-2 rounded-xl font-bold text-xs uppercase hover:bg-indigo-700 transition-all whitespace-nowrap"
                >
                  Guardar
                </button>
              </div>
              {systemSettings.geminiApiKey ? (
                <p className="text-[10px] text-emerald-600 font-bold mt-2 flex items-center gap-1"><span>•</span> IA activa</p>
              ) : (
                <p className="text-[10px] text-slate-400 font-bold mt-2 flex items-center gap-1"><span>•</span> IA inactiva - configure a chave</p>
              )}
            </div>
          </div>
        </div>

        {/* Identidade Visual */}
        <div className="bg-white p-4 sm:p-6 lg:p-8 rounded-2xl sm:rounded-[2.5rem] shadow-sm border border-slate-100">
          <div className="flex items-center gap-3 mb-6">
            <div className="bg-indigo-50 p-2 rounded-xl text-indigo-600"><Building2 size={20} /></div>
            <h3 className="font-black text-lg text-slate-800">Identidade da Empresa</h3>
          </div>
          <div className="space-y-4">
            <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">Nome da Empresa</p>
            <input
              type="text"
              value={systemSettings.companyName}
              onChange={(e) => setSystemSettings(prev => ({ ...prev, companyName: e.target.value }))}
              onBlur={(e) => updateSetting('companyName', e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none font-bold"
            />
            <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">Morada</p>
            <input
              type="text"
              value={systemSettings.companyAddress || ''}
              onChange={(e) => setSystemSettings(prev => ({ ...prev, companyAddress: e.target.value }))}
              onBlur={(e) => updateSetting('companyAddress', e.target.value)}
              placeholder="Rua, nº, código postal, localidade"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none font-bold"
            />
            <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">NIF</p>
            <input
              type="text"
              value={systemSettings.companyNif || ''}
              onChange={(e) => setSystemSettings(prev => ({ ...prev, companyNif: e.target.value }))}
              onBlur={(e) => updateSetting('companyNif', e.target.value)}
              placeholder="Nº de Identificação Fiscal"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none font-bold"
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
                className="w-32 accent-indigo-600"
              />
            </div>
            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
              <div>
                <p className="text-sm font-bold text-slate-700">Modo Escuro (Interface)</p>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Ajuste de luminosidade</p>
              </div>
              <button
                onClick={() => updateSetting('darkMode', !systemSettings.darkMode)}
                className={`w-14 h-8 rounded-full transition-all flex items-center px-1 ${systemSettings.darkMode ? 'bg-indigo-600' : 'bg-slate-300'}`}
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

        {/* Destaque Informativo */}
        <div className="bg-gradient-to-br from-indigo-600 to-violet-700 p-4 sm:p-6 lg:p-8 rounded-2xl sm:rounded-[2.5rem] shadow-xl text-white relative overflow-hidden flex flex-col justify-center">
          <div className="absolute top-0 right-0 p-6 opacity-10"><Sparkles size={80} /></div>
          <h3 className="text-xl font-black uppercase tracking-tighter mb-2">Magnetic Place Pro</h3>
          <p className="text-sm font-medium opacity-80 leading-relaxed mb-6">Utilize o painel de configurações para moldar a experiência do dashboard conforme as necessidades da sua empresa.</p>
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest"><CheckCircle size={14} /> Relatórios Financeiros</div>
            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest"><CheckCircle size={14} /> Gestão de Equipa Analítica</div>
            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest"><CheckCircle size={14} /> Automação com IA</div>
          </div>
        </div>
      </div>

      {showRecalcModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-black text-slate-800 flex items-center gap-2">
                <Wrench size={20} className="text-amber-600" />
                Corrigir Hours Anteriores
              </h3>
              <button onClick={() => { setShowRecalcModal(false); setRecalcProgress({ current: 0, total: 0, done: false }); }} className="p-2 text-slate-400 hover:text-slate-600 rounded-xl">
                <X size={20} />
              </button>
            </div>
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
            <div className="flex gap-2">
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
                <button onClick={() => { setShowRecalcModal(false); setRecalcProgress({ current: 0, total: 0, done: false }); }} className="flex-1 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-colors">
                  Fechar
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
