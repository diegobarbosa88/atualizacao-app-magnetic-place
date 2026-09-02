import React, { useState, useEffect, useMemo } from 'react';
import { Megaphone, Bell, BellRing, BellOff, Loader2, Plus, Trash2, Inbox, Search, CheckCircle, AlertTriangle, XCircle, X } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { usePushSubscription } from '../../hooks/usePushSubscription';
import Card from '../../components/common/Card';
import ModalShell from '../../components/common/ModalShell';
import { FT, SCALE } from '../../styles/designTokens';

const SYSTEM_PATTERNS = [
  'Pedido de Correção',
  'Contra-proposta',
  'Correção Aplicada',
  'Correção Resolvida',
  'Correção Rejeitada',
  'Alteração de Dados',
  'Solicitação de Alteração',
  'Reporte de Divergência',
];

// Ícone + tom por tipo — mesmo mapeamento do banner in-app (app.jsx NOTIF_TONE).
// Cores por `style` (var() resolve em runtime) em vez de className — uma
// classe Tailwind construída com template literal (`bg-[var(--tone-${tone}-bg)]`)
// nunca é gerada pelo JIT, que só vê classes literais no código-fonte.
const TYPE_TONE = {
  success: { icon: CheckCircle, accent: 'var(--tone-emerald)', bg: 'var(--tone-emerald-bg)' },
  warning: { icon: AlertTriangle, accent: 'var(--tone-amber)', bg: 'var(--tone-amber-bg)' },
  error:   { icon: XCircle, accent: 'var(--tone-rose)', bg: 'var(--tone-rose-bg)' },
  info:    { icon: Megaphone, accent: 'var(--tone-indigo)', bg: 'var(--tone-indigo-bg)' },
};

const TARGET_LABEL = { admin: 'Admin', specific: 'Trabalhador', client: 'Cliente', all: 'Difusão' };

function dayBucket(dateStr) {
  const d = new Date(dateStr);
  const startOfDay = (dt) => new Date(dt.getFullYear(), dt.getMonth(), dt.getDate()).getTime();
  const diffDays = Math.round((startOfDay(new Date()) - startOfDay(d)) / 86400000);
  if (diffDays <= 0) return 'Hoje';
  if (diffDays === 1) return 'Ontem';
  if (diffDays <= 7) return 'Esta semana';
  return 'Mais antigas';
}

function formatWhen(dateStr, bucket) {
  const d = new Date(dateStr);
  const time = d.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
  if (bucket === 'Hoje' || bucket === 'Ontem') return time;
  return d.toLocaleDateString('pt-PT', { day: '2-digit', month: 'short' }) + ' · ' + time;
}

// Uma notificação conta como "por resolver" enquanto quem a devia tratar
// ainda não a dispensou — o admin em si para target_type='admin', quem a
// recebeu para 'specific'/'client'/'all'. Não tenta perceber se TODOS os
// admins/trabalhadores já trataram — é uma vista de trabalho, não a mesma
// lógica exacta do banner de cada utilizador.
function isResolved(n, currentUserId) {
  const dismissed = n.dismissed_by_ids || [];
  if (n.target_type === 'admin') return dismissed.includes(currentUserId);
  if (n.target_type === 'specific') return (n.target_worker_ids || []).some(id => dismissed.includes(String(id)));
  if (n.target_type === 'client') return n.target_client_id && dismissed.includes(String(n.target_client_id));
  return dismissed.length > 0;
}

const NotificationsAdmin = ({ workers, appNotifications, saveToDb, handleDelete, supabase }) => {
  const { currentUser, clients } = useApp();
  const [screen, setScreen] = useState('inbox'); // 'inbox' | 'manage'
  const { permission, isSubscribed, subscribing, subscribe, supported } = usePushSubscription({ supabase, role: 'admin' });
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [type, setType] = useState('info');
  const [targetType, setTargetType] = useState('all');
  const [isDismissible, setIsDismissible] = useState(true);
  const [selectedWorkers, setSelectedWorkers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showViewDetails, setShowViewDetails] = useState(null);
  const [viewDetailsTab, setViewDetailsTab] = useState('viewed');
  const [dismissedNotifs, setDismissedNotifs] = useState([]);
  const [pushCounts, setPushCounts] = useState(null);

  useEffect(() => {
    if (!supabase) return;
    supabase.from('push_subscriptions').select('role').then(({ data, error }) => {
      if (error) return console.warn('[NotificationsAdmin] falha a contar push_subscriptions:', error);
      const counts = { admin: 0, worker: 0, client: 0 };
      (data || []).forEach(r => { counts[r.role] = (counts[r.role] || 0) + 1; });
      setPushCounts(counts);
    });
  }, [supabase]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('dismissed_admin_notifs');
      if (stored) setDismissedNotifs(JSON.parse(stored));
    } catch {}
  }, []);

  useEffect(() => {
    if (!supabase) return;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);
    // Só apaga o que já foi dispensado por alguém — uma notificação nunca vista
    // (dismissed_by_ids ainda vazio) fica, por mais antiga que seja, até ser tratada.
    supabase
      .from('app_notifications')
      .delete()
      .lt('created_at', cutoff.toISOString())
      .neq('dismissed_by_ids', '[]')
      .then(({ error }) => { if (error) console.warn('Cleanup notifs:', error); });
  }, [supabase]);

  const manualNotifications = appNotifications.filter(n => {
    if (SYSTEM_PATTERNS.some(p => n.title?.includes(p))) return false;
    if ((n.read_by_admin_ids || []).includes(currentUser?.id)) return false;
    if (dismissedNotifs.includes(n.id)) return false;
    return true;
  });

  const handleAdd = async () => {
    if (!title || !message) return alert('Preencha o título e a mensagem!');
    setLoading(true);
    const id = "notif_" + Date.now();
    const newNotif = {
      id,
      title,
      message,
      type,
      target_type: targetType,
      target_worker_ids: targetType === 'specific' ? selectedWorkers : [],
      is_dismissible: isDismissible,
      is_active: true,
      read_by_ids: [],
      created_at: new Date().toISOString()
    };
    await saveToDb('app_notifications', id, newNotif);
    setTitle('');
    setMessage('');
    setType('info');
    setTargetType('all');
    setIsDismissible(true);
    setSelectedWorkers([]);
    setLoading(false);
    alert('Aviso criado com sucesso!');
  };

  const toggleStatus = async (notif) => {
    const updated = { ...notif, is_active: !notif.is_active };
    await saveToDb('app_notifications', notif.id, updated);
  };

  // ---------- Caixa de Entrada ----------
  const [inboxTab, setInboxTab] = useState('pending'); // 'pending' | 'resolved' | 'all'
  const [inboxTarget, setInboxTarget] = useState('all'); // 'all' | 'admin' | 'specific' | 'client'
  const [inboxSearch, setInboxSearch] = useState('');

  const resolveName = (id) => {
    if (id === 'admin_system') return 'Admin';
    const w = workers?.find(w => String(w.id) === String(id));
    if (w) return w.name;
    const c = clients?.find(c => String(c.id) === String(id));
    if (c) return c.name;
    return id;
  };

  const inboxGroups = useMemo(() => {
    const term = inboxSearch.trim().toLowerCase();
    const filtered = (appNotifications || []).filter(n => {
      if (!n.is_active) return false;
      const resolved = isResolved(n, currentUser?.id);
      if (inboxTab === 'pending' && resolved) return false;
      if (inboxTab === 'resolved' && !resolved) return false;
      if (inboxTarget !== 'all') {
        if (inboxTarget === 'specific' && n.target_type !== 'specific' && n.target_type !== 'all') return false;
        if (inboxTarget !== 'specific' && n.target_type !== inboxTarget) return false;
      }
      if (term) {
        const haystack = `${n.title || ''} ${n.message || ''}`.toLowerCase();
        if (!haystack.includes(term)) return false;
      }
      return true;
    }).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    const order = ['Hoje', 'Ontem', 'Esta semana', 'Mais antigas'];
    const buckets = {};
    filtered.forEach(n => {
      const b = dayBucket(n.created_at);
      (buckets[b] ||= []).push(n);
    });
    return order.filter(b => buckets[b]?.length).map(b => ({ label: b, items: buckets[b] }));
  }, [appNotifications, inboxTab, inboxTarget, inboxSearch, currentUser?.id]);

  const inboxCounts = useMemo(() => {
    const active = (appNotifications || []).filter(n => n.is_active);
    const pending = active.filter(n => !isResolved(n, currentUser?.id)).length;
    return { pending, resolved: active.length - pending, all: active.length };
  }, [appNotifications, currentUser?.id]);

  const handleDismissFromInbox = async (n) => {
    if (!supabase || !currentUser) return;
    const dismissed = n.dismissed_by_ids || [];
    if (dismissed.includes(currentUser.id)) return;
    await supabase.from('app_notifications').update({ dismissed_by_ids: [...dismissed, currentUser.id] }).eq('id', n.id);
  };

  return (
    <Card className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center gap-3 mb-5 border-b border-[var(--border-soft)] pb-4">
        <div className="bg-amber-50 p-2 rounded-xl text-amber-600">
          {screen === 'inbox' ? <Inbox size={20} /> : <Megaphone size={20} />}
        </div>
        <h3 className="font-black text-base sm:text-xl text-[var(--ink)] uppercase tracking-tight flex-1">Notificações</h3>
        {supported && (
          <button
            onClick={subscribe}
            disabled={subscribing || isSubscribed}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl transition-all ${SCALE.text.badge} ${
              isSubscribed ? 'bg-emerald-50 text-emerald-600' : 'bg-[var(--surface-dim)] text-[var(--ink-soft)] hover:bg-[var(--border)]'
            }`}
          >
            {subscribing ? <Loader2 size={13} className="animate-spin" /> : isSubscribed ? <BellRing size={13} /> : permission === 'denied' ? <BellOff size={13} /> : <Bell size={13} />}
            {isSubscribed ? 'Push ativo' : permission === 'denied' ? 'Push bloqueado' : 'Ativar push'}
          </button>
        )}
      </div>

      <div className="flex gap-1 p-1 mb-5 bg-[var(--surface-dim)] border border-[var(--border-soft)] rounded-2xl w-fit">
        {[{ id: 'inbox', label: 'Caixa de Entrada' }, { id: 'manage', label: 'Criar Aviso' }].map(t => (
          <button
            key={t.id}
            onClick={() => setScreen(t.id)}
            className={`px-4 py-2 rounded-xl transition-all ${SCALE.text.badge} ${screen === t.id ? 'bg-[var(--panel)] shadow-sm text-[var(--navy)]' : 'text-[var(--ink-soft)] hover:text-[var(--navy)]'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {screen === 'inbox' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3 justify-between">
            <div className="flex gap-1 p-1 bg-[var(--surface-dim)] border border-[var(--border-soft)] rounded-2xl">
              {[
                { id: 'pending', label: 'Por resolver', count: inboxCounts.pending },
                { id: 'resolved', label: 'Dispensadas', count: inboxCounts.resolved },
                { id: 'all', label: 'Todas', count: inboxCounts.all },
              ].map(t => (
                <button
                  key={t.id}
                  onClick={() => setInboxTab(t.id)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl transition-all ${SCALE.text.badge} ${inboxTab === t.id ? 'bg-[var(--panel)] shadow-sm text-[var(--navy)]' : 'text-[var(--ink-soft)] hover:text-[var(--navy)]'}`}
                >
                  {t.label}
                  <span className={`px-1.5 rounded-full ${inboxTab === t.id ? 'bg-[var(--orange)] text-[var(--navy)]' : 'bg-[var(--panel)] text-[var(--slate-dim)]'}`}>{t.count}</span>
                </button>
              ))}
            </div>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--slate)]" />
              <input
                value={inboxSearch}
                onChange={e => setInboxSearch(e.target.value)}
                placeholder="Procurar…"
                className="pl-9 pr-3 py-2 rounded-xl border border-[var(--border)] bg-white text-xs font-medium outline-none w-52"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {[{ id: 'all', label: 'Todos os alvos' }, { id: 'admin', label: 'Admin' }, { id: 'specific', label: 'Trabalhador' }, { id: 'client', label: 'Cliente' }].map(c => (
              <button
                key={c.id}
                onClick={() => setInboxTarget(c.id)}
                className={`px-3 py-1.5 rounded-full border ${SCALE.text.badge} transition-all ${inboxTarget === c.id ? 'text-white border-transparent' : 'bg-white text-[var(--ink-soft)] border-[var(--border)] hover:border-[var(--slate)]'}`}
                style={inboxTarget === c.id ? { backgroundColor: FT.navy } : {}}
              >
                {c.label}
              </button>
            ))}
          </div>

          {inboxGroups.length === 0 ? (
            <p className="text-center py-10 text-[var(--slate-dim)] text-xs font-bold">Nada por aqui.</p>
          ) : (
            inboxGroups.map(group => (
              <div key={group.label}>
                <div className="flex items-center gap-2 py-2">
                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: FT.orange }} />
                  <span className={`${SCALE.text.statLabel} text-[var(--navy)]`}>{group.label}</span>
                  <span className="flex-1 h-px bg-[var(--border-soft)]" />
                  <span className={`${SCALE.text.meta} text-[var(--slate-dim)]`}>{group.items.length}</span>
                </div>
                <div className="bg-white rounded-2xl border border-[var(--border-soft)] overflow-hidden">
                  {group.items.map(n => {
                    const cfg = TYPE_TONE[n.type] || TYPE_TONE.info;
                    const Icon = cfg.icon;
                    const resolved = isResolved(n, currentUser?.id);
                    const dismissedCount = (n.dismissed_by_ids || []).length;
                    return (
                      <div
                        key={n.id}
                        onClick={() => { setShowViewDetails(n.id); setViewDetailsTab('viewed'); }}
                        className="flex items-start gap-3 px-4 py-3 border-b border-[var(--border-soft)] last:border-b-0 hover:bg-[var(--surface)] cursor-pointer transition-colors"
                      >
                        <div className="p-2 rounded-xl shrink-0 mt-0.5" style={{ background: cfg.bg, color: cfg.accent }}><Icon size={16} /></div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline gap-2">
                            <p className="text-sm font-black text-[var(--ink)] truncate flex-1">{n.title}</p>
                            <span className={`${SCALE.text.meta} text-[var(--slate-dim)] shrink-0`}>{formatWhen(n.created_at, group.label)}</span>
                          </div>
                          <p className={`${SCALE.text.meta} text-[var(--slate-dim)] truncate mt-0.5`}>{n.message}</p>
                          <div className="flex items-center gap-2 mt-1.5">
                            <span className={`${SCALE.text.badge} px-2 py-0.5 rounded-full bg-[var(--surface-dim)] text-[var(--ink-soft)]`}>{TARGET_LABEL[n.target_type] || n.target_type}</span>
                            {resolved ? (
                              <span className={`${SCALE.text.meta} text-[var(--slate-dim)]`}>{dismissedCount} dispensou{dismissedCount === 1 ? '' : 'aram'}</span>
                            ) : (
                              <span className="w-1.5 h-1.5 rounded-full bg-[var(--tone-rose)]" title="Ainda por resolver" />
                            )}
                          </div>
                        </div>
                        {n.target_type === 'admin' && !resolved && (
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDismissFromInbox(n); }}
                            className="p-1.5 rounded-lg text-[var(--slate)] hover:text-[var(--ink-soft)] hover:bg-[var(--surface-dim)] shrink-0"
                            title="Dispensar"
                          >
                            <X size={14} />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {screen === 'manage' && (<>

      {pushCounts && (
        <div className="flex flex-wrap items-center gap-2 mb-5">
          <span className={`${SCALE.text.statLabel} text-[var(--slate-dim)]`}>Subscrições push ativas:</span>
          {[{ label: 'Admin', key: 'admin' }, { label: 'Trabalhadores', key: 'worker' }, { label: 'Clientes', key: 'client' }].map(({ label, key }) => (
            <span key={key} className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg ${SCALE.text.meta} bg-[var(--surface-dim)] text-[var(--ink-soft)]`}>
              {pushCounts[key]} {label}
            </span>
          ))}
        </div>
      )}

      <div className="bg-[var(--surface)] rounded-2xl sm:rounded-[2rem] p-4 sm:p-6 mb-5 border border-[var(--border-soft)]">
        <p className={`${SCALE.text.statLabel} text-[var(--slate-dim)] mb-4 ml-1`}>Criar Novo Aviso</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div className="space-y-1">
            <label className={`${SCALE.text.statLabel} text-[var(--slate-dim)] ml-2`}>Título do Banner</label>
            <input
              className="w-full p-3 rounded-xl border border-[var(--border)] bg-white text-sm outline-none font-medium"
              placeholder="Ex: Reunião Geral"
              value={title}
              onChange={e => setTitle(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <label className={`${SCALE.text.statLabel} text-[var(--slate-dim)] ml-2`}>Tipo / Estilo</label>
            <select
              className="w-full p-3 rounded-xl border border-[var(--border)] bg-white text-sm outline-none font-medium"
              value={type}
              onChange={e => setType(e.target.value)}
            >
              <option value="info">Informação (Azul)</option>
              <option value="warning">Aviso (Laranja)</option>
              <option value="urgent">Urgente (Vermelho)</option>
              <option value="success">Sucesso (Verde)</option>
            </select>
          </div>
          <div className="flex items-center gap-3 bg-white p-3 rounded-xl border border-[var(--border)]">
            <input
              type="checkbox"
              id="dismissible"
              checked={isDismissible}
              onChange={e => setIsDismissible(e.target.checked)}
              className="w-4 h-4 rounded text-[var(--navy)] cursor-pointer"
            />
            <label htmlFor="dismissible" className={`text-[var(--ink-soft)] cursor-pointer ${SCALE.text.statLabel}`}>
              Permitir que o trabalhador feche este aviso
            </label>
          </div>
        </div>
        <div className="space-y-1 mb-4">
          <label className={`${SCALE.text.statLabel} text-[var(--slate-dim)] ml-2`}>Mensagem</label>
          <textarea
            className="w-full p-3 rounded-xl border border-[var(--border)] bg-white text-sm outline-none font-medium h-20"
            placeholder="Escreva aqui o conteúdo do aviso..."
            value={message}
            onChange={e => setMessage(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div className="space-y-1">
            <label className={`${SCALE.text.statLabel} text-[var(--slate-dim)] ml-2`}>Público-Alvo</label>
            <select
              className="w-full p-3 rounded-xl border border-[var(--border)] bg-white text-sm outline-none font-medium"
              value={targetType}
              onChange={e => setTargetType(e.target.value)}
            >
              <option value="all">Todos os Trabalhadores</option>
              <option value="specific">Apenas trabalhadores selecionados</option>
            </select>
          </div>
          {targetType === 'specific' && (
            <div className="space-y-1">
              <label className={`${SCALE.text.statLabel} text-[var(--slate-dim)] ml-2`}>Selecionar Trabalhadores</label>
              <div className="flex flex-wrap gap-2 p-2 min-h-[42px] rounded-xl border border-[var(--border)] bg-white">
                {workers.map(w => (
                  <button
                    key={w.id}
                    onClick={() => {
                      setSelectedWorkers(prev =>
                        prev.includes(w.id) ? prev.filter(id => id !== w.id) : [...prev, w.id]
                      )
                    }}
                    className={`px-2 py-1 rounded-lg transition-all ${SCALE.text.meta} ${selectedWorkers.includes(w.id) ? 'text-white' : 'bg-[var(--surface-dim)] text-[var(--ink-soft)]'}`}
                    style={selectedWorkers.includes(w.id) ? { backgroundColor: FT.navy } : {}}
                  >
                    {w.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        <button
          onClick={handleAdd}
          disabled={loading}
 className="w-full py-4 rounded-2xl font-black uppercase text-xs tracking-widest flex items-center justify-center gap-3 shadow-lg active:scale-[0.98] transition-all hover:opacity-90"
          style={{ backgroundColor: FT.orange, color: FT.navy }}
        >
          {loading ? <Loader2 className="animate-spin" size={18} /> : <Plus size={18} />} Criar Aviso no App
        </button>
      </div>

      <div className="space-y-3">
        <p className={`${SCALE.text.statLabel} text-[var(--slate-dim)] ml-1`}>Avisos Existentes</p>
        {manualNotifications.length === 0 ? (
          <p className="text-center py-10 text-[var(--slate-dim)] text-xs font-bold">Nenhum aviso criado.</p>
        ) : (
          manualNotifications.map(notif => (
            <div key={notif.id} className={`p-4 rounded-[1.5rem] border flex items-center justify-between gap-3 shadow-sm hover:shadow-md transition-all ${notif.is_active ? 'bg-white border-[var(--border-soft)]' : 'bg-[var(--surface)] border-[var(--border)] opacity-60'}`}>
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className={`p-3 rounded-2xl ${notif.type === 'urgent' ? 'bg-rose-50 text-rose-600' :
                  notif.type === 'warning' ? 'bg-amber-50 text-amber-600' :
                    notif.type === 'success' ? 'bg-emerald-50 text-emerald-600' :
                      'bg-blue-50 text-blue-600'
                  }`}>
                  <Bell size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-black text-[var(--ink)] truncate">{notif.title}</p>
                  <p className={`${SCALE.text.meta} text-[var(--slate-dim)] truncate`}>{notif.message}</p>
                  <p className={`${SCALE.text.statLabel} mt-1`} style={{ color: 'var(--slate-dim)' }}>
                    🎯 {notif.target_type === 'all' ? 'Todos' : `${notif.target_worker_ids?.length || 0} específicos`} • {notif.is_dismissible ? 'Fechável' : 'Fixo'}
                  </p>
                  <div
                    onClick={() => setShowViewDetails(notif.id)}
                    className="mt-2 flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
                  >
                    <div className="flex -space-x-2">
                      {(notif.viewed_by_ids || []).slice(0, 5).map(vId => (
                        <div key={vId} title={workers.find(w => w.id === vId)?.name} className={`w-5 h-5 rounded-full border-2 border-white flex items-center justify-center ${SCALE.text.badge}`} style={{ backgroundColor: FT.navy, color: FT.orange }}>
                          {workers.find(w => w.id === vId)?.name?.[0] || '?'}
                        </div>
                      ))}
                      {(notif.viewed_by_ids || []).length > 5 && (
                        <div className={`w-5 h-5 rounded-full bg-[var(--surface-dim)] border-2 border-white flex items-center justify-center text-[var(--ink-soft)] ${SCALE.text.meta}`}>
                          +{(notif.viewed_by_ids || []).length - 5}
                        </div>
                      )}
                    </div>
                    <span className={`${SCALE.text.statLabel} text-[var(--slate-dim)]`}>
                      {(notif.viewed_by_ids || []).length} Viu
                    </span>
                    {notif.is_dismissible && (
                      <span className={`${SCALE.text.statLabel} text-[var(--slate-dim)] ml-2`}>
                        • {(notif.dismissed_by_ids || []).length} Fechou
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => toggleStatus(notif)}
                  className={`px-3 py-1.5 rounded-xl ${SCALE.text.badge} transition-all ${notif.is_active ? 'bg-emerald-50 text-emerald-600' : 'bg-[var(--surface-dim)] text-[var(--ink-soft)]'
                    }`}
                >
                  {notif.is_active ? 'Ativo' : 'Pausado'}
                </button>
                <button
                  onClick={() => handleDelete('app_notifications', notif.id)}
                  className="p-2 text-rose-300 hover:text-rose-600 transition-all"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      </>)}

      {/* Modal de Detalhes de Visualização */}
      {showViewDetails && (
        <ModalShell
          isOpen
          onClose={() => setShowViewDetails(null)}
          subtitle="Registo de Interação"
          title="Detalhes do Aviso"
          size="md"
          closeOnOverlay={false}
          footer={
            <div className="p-6">
              <button
                onClick={() => setShowViewDetails(null)}
                className="w-full py-4 border rounded-2xl font-black text-xs uppercase tracking-widest transition-all hover:bg-[var(--surface)]"
                style={{ borderColor: FT.slate, color: 'var(--ink-soft)' }}
              >
                Fechar
              </button>
            </div>
          }
        >
          <div className="p-8">
            <div className="flex items-end gap-1 border-b border-[var(--border-soft)] mb-4">
              <button
                onClick={() => setViewDetailsTab('viewed')}
                className={`flex-1 py-2 -mb-px border-b-2 transition-all ${SCALE.text.statLabel} ${viewDetailsTab === 'viewed' ? 'border-[var(--orange)] text-[var(--navy)]' : 'border-transparent text-[var(--slate-dim)] hover:text-[var(--navy)]'}`}
              >
                Visualizaram ({(appNotifications.find(n => n.id === showViewDetails)?.viewed_by_ids || []).length})
              </button>
              {appNotifications.find(n => n.id === showViewDetails)?.is_dismissible && (
                <button
                  onClick={() => setViewDetailsTab('dismissed')}
                  className={`flex-1 py-2 -mb-px border-b-2 transition-all ${SCALE.text.statLabel} ${viewDetailsTab === 'dismissed' ? 'border-[var(--orange)] text-[var(--navy)]' : 'border-transparent text-[var(--slate-dim)] hover:text-[var(--navy)]'}`}
                >
                  Fecharam ({(appNotifications.find(n => n.id === showViewDetails)?.dismissed_by_ids || []).length})
                </button>
              )}
            </div>

            <div className="space-y-3 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
              {(appNotifications.find(n => n.id === showViewDetails)?.[viewDetailsTab === 'viewed' ? 'viewed_by_ids' : 'dismissed_by_ids'] || []).length > 0 ? (
                (appNotifications.find(n => n.id === showViewDetails)?.[viewDetailsTab === 'viewed' ? 'viewed_by_ids' : 'dismissed_by_ids'] || []).map(vId => {
                  const worker = workers.find(w => String(w.id) === String(vId));
                  const name = resolveName(vId);
                  return (
                    <div key={vId} className="flex items-center gap-3 p-3 bg-[var(--surface)] rounded-2xl border border-[var(--border-soft)]">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center font-black text-xs uppercase" style={{ backgroundColor: FT.navy, color: FT.orange }}>
                        {name?.[0] || '?'}
                      </div>
                      <div>
                        <p className="text-xs font-bold text-[var(--ink)]">{name || 'Desconhecido'}</p>
                        <p className={`${SCALE.text.statLabel} text-[var(--slate-dim)]`}>{worker?.profissao || (vId === 'admin_system' ? 'Admin' : 'Colaborador')}</p>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-8">
                  <p className="text-sm font-bold text-[var(--slate-dim)] italic">Nenhum registo encontrado.</p>
                </div>
              )}
            </div>
          </div>
        </ModalShell>
      )}
    </Card>
  );
};

export default NotificationsAdmin;
