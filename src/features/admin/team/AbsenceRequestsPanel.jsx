import React, { useState } from 'react';
import {
  CalendarX, Copy, CheckCircle, ChevronDown, ChevronUp, ThumbsUp, RotateCcw, Archive, Trash2,
  ClockAlert, ListChecks, Users, Palmtree, Thermometer, Stethoscope, Home, User, HelpCircle,
  Clock, Search,
} from 'lucide-react';
import { useApp } from '../../../context/AppContext';
import { deleteAbsenceRequest } from '../../../utils/absenceRequestsApi';
import { notifyEvent, TARGET } from '../../../utils/notifyEvent';
import { FT, SCALE, FONT_TITLE, FONT_MONO } from '../../../styles/designTokens';

// Lista de motivos é editável pelo admin (AdminSettings.jsx, absence_reasons)
// — nunca fechada. HelpCircle cobre qualquer motivo fora deste mapa, não só
// "Outro" literal.
const REASON_ICONS = {
  'Férias': Palmtree,
  'Doença': Thermometer,
  'Consulta médica': Stethoscope,
  'Emergência familiar': Home,
  'Assunto pessoal': User,
  'Outro': HelpCircle,
};
const reasonIcon = (reason) => REASON_ICONS[reason] || HelpCircle;

const getInitials = (name) => {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  return parts.length === 1 ? parts[0][0].toUpperCase() : (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

const diasEntre = (a, b) => Math.max(0, Math.round((b - a) / 86400000));

// Linha de um aviso individual — reutilizada no aviso principal (sempre
// visível), nos "+N avisos" expandidos, e na secção "Sem pendências".
// `destaque` controla só a cor de chips/badge (laranja na secção 1, cinza
// nas outras) — #8a4a00/#FBF0DE, já medido e corrigido nesta sessão, nunca
// FT.orangeDeep/FT.warnBg (falha AA, ver CLAUDE.md). Notificar Cliente,
// Arquivar e Apagar vivem aqui, ao nível do aviso — nunca ao nível do
// trabalhador, por decisão explícita. Definida fora do componente principal
// (não durante o render) para não reiniciar o próprio estado a cada render.
function AvisoRow({ req, destaque, ctx }) {
  const { clients, notifyClient, openIds, toggleOpen, handleApprove, handleArchive, handleDelete, handleRevert, copiedId, handleCopyEmail } = ctx;
  const client = clients?.find(c => c.id === req.client_id);
  const sortedDates = (req.dates || []).slice().sort();
  const isPending = req.status === 'pending';
  const isApproved = req.status === 'approved';
  const open = openIds.has(req.id);
  const chipBg = destaque ? '#FBF0DE' : FT.bg;
  const chipColor = destaque ? '#8a4a00' : FT.ink;
  // Fundo próprio (chipBg/chipColor acima) é autocontido, fica estático. Mas o ícone de
  // motivo e o "solicitado há Nd" assentam directamente no bg-white desta div — que inverte
  // em modo escuro via a regra-ponte de App.css — logo precisam de um token que também
  // inverta, não FT.ink/#8a4a00 estáticos (davam 1,16:1 e 2,13:1 em escuro).
  const metaTextColor = destaque ? 'var(--tone-amber)' : 'var(--ink-mid)';

  return (
    <div className="rounded-xl border border-[var(--border-soft)] overflow-hidden bg-white">
      <div onClick={() => toggleOpen(req.id)} className="px-3 py-2.5 flex items-center gap-2.5 cursor-pointer select-none hover:bg-[var(--surface)] transition-colors">
        {React.createElement(reasonIcon(req.reason), { size: 14, className: 'shrink-0', style: { color: destaque ? metaTextColor : 'var(--slate-dim)' } })}
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-[var(--ink-mid)] truncate">{req.reason}{client ? ` · ${client.name}` : ''}</p>
          <div className="flex flex-wrap items-center gap-1.5 mt-1">
            {sortedDates.slice(0, 4).map(ds => {
              const d = new Date(ds + 'T00:00:00');
              return (
                <span key={ds} className="inline-flex flex-col items-center px-1.5 py-1 rounded-lg text-center leading-none" style={{ background: chipBg, color: chipColor }}>
                  <span className={SCALE.text.statLabel}>{d.toLocaleDateString('pt-PT', { weekday: 'short' }).toUpperCase()}</span>
                  <span className="text-xs font-black">{d.getDate()}</span>
                  <span className={`${SCALE.text.meta} opacity-70`}>{d.toLocaleDateString('pt-PT', { month: 'short' })}</span>
                </span>
              );
            })}
            {sortedDates.length > 4 && <span className={`${SCALE.text.meta} text-[var(--slate-dim)]`}>+{sortedDates.length - 4}</span>}
            {isPending && (
              <span className={SCALE.text.meta} style={{ color: metaTextColor }}>
                solicitado há {diasEntre(new Date(req.created_at), new Date())}d
              </span>
            )}
          </div>
        </div>
        {isPending && (
          <button
            onClick={(e) => { e.stopPropagation(); handleApprove(req); }}
            className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-all ${SCALE.text.badge} ${
              destaque ? 'bg-emerald-600 text-white hover:bg-emerald-700' : 'border border-emerald-600 text-emerald-600 hover:bg-emerald-50'
            }`}
          >
            <ThumbsUp size={11} /> Dar OK
          </button>
        )}
        {open ? <ChevronUp size={13} className="text-[var(--slate)] shrink-0" /> : <ChevronDown size={13} className="text-[var(--slate)] shrink-0" />}
      </div>

      {open && (
        <div className="px-3 pb-3 pt-1 space-y-2 border-t border-[var(--border-soft)]">
          {req.notes && (
            <div>
              <p className={`${SCALE.text.statLabel} text-[var(--slate-dim)] mb-1`}>Notas</p>
              <p className="text-xs text-[var(--ink-soft)]">{req.notes}</p>
            </div>
          )}
          {notifyClient && client?.email && (
            <div className="bg-amber-50 border border-amber-100 rounded-xl p-3">
              <p className={`${SCALE.text.statLabel} text-amber-700 mb-1`}>Notificar Cliente</p>
              <p className={`${SCALE.text.meta} text-[var(--ink-soft)] mb-2`}>{client.email}</p>
              <button
                onClick={() => handleCopyEmail(req)}
                className={`flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 text-white rounded-xl hover:bg-amber-600 transition-all ${SCALE.text.badge}`}
              >
                {copiedId === req.id ? <><CheckCircle size={11} /> Copiado!</> : <><Copy size={11} /> Copiar Mensagem</>}
              </button>
            </div>
          )}
          <div className="flex gap-2 pt-1">
            {isApproved && (
              <button
                onClick={() => handleRevert(req)}
                className={`flex items-center gap-1.5 px-3 py-1.5 bg-[var(--surface-dim)] text-[var(--ink-soft)] rounded-xl hover:bg-orange-100 hover:text-orange-700 transition-all ${SCALE.text.badge}`}
              >
                <RotateCcw size={11} /> Reverter
              </button>
            )}
            <button
              onClick={() => handleArchive(req)}
              className={`flex items-center gap-1.5 px-3 py-1.5 bg-[var(--surface-dim)] text-[var(--ink-soft)] rounded-xl hover:bg-red-50 hover:text-red-500 transition-all ${SCALE.text.badge}`}
            >
              <Archive size={11} /> Arquivar
            </button>
            <button
              onClick={() => handleDelete(req)}
              className={`flex items-center gap-1.5 px-3 py-1.5 bg-[var(--surface-dim)] text-[var(--ink-soft)] rounded-xl hover:bg-red-100 hover:text-red-600 transition-all ${SCALE.text.badge}`}
            >
              <Trash2 size={11} /> Apagar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Cartão de trabalhador com pendente(s) — secções 1 e 2. O aviso mais antigo
// pendente fica sempre visível na linha principal (sem precisar de
// expandir); "+N avisos" revela o resto (outros pendentes + aprovados).
function PendingWorkerCard({ group, destaque, ctx }) {
  const { openWorkers, toggleWorker } = ctx;
  const sortedReqs = [...group.requests].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  const pendingReqs = sortedReqs.filter(r => r.status === 'pending');
  const approvedReqs = sortedReqs.filter(r => r.status === 'approved');
  const primary = pendingReqs[0];
  const extras = [...pendingReqs.slice(1), ...approvedReqs];
  const isOpen = openWorkers.has(group.id);
  // Avatar: iniciais brancas sobre cor sólida nas 3 variantes — navy (secção
  // 1) e slateDim (secção 2, não slate: branco/slate dá 2,89:1 e falha AA;
  // branco/slateDim dá 5,10:1). Cores fixas (FT.*), não var(--...): fundo
  // sólido de avatar não deve inverter, mesmo raciocínio já usado no badge
  // do cartão de colaborador.
  const avatarBg = destaque ? FT.navy : FT.slateDim;

  return (
    <div
      className="rounded-2xl border shadow-sm overflow-hidden"
      style={destaque
        ? { borderColor: 'var(--border-soft)', borderLeftWidth: 6, borderLeftColor: FT.orange, background: '#FDF8F0' }
        : { borderColor: 'var(--border-soft)', background: '#fff' }}
    >
      <div className="px-4 pt-3.5 pb-2.5 flex items-center gap-3">
        <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-white text-xs font-black" style={{ background: avatarBg }}>
          {getInitials(group.name)}
        </div>
        <div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap">
          {/* FT.ink estático, não var(--ink): o cartão usa background inline fixo
              ('#fff'/'#FDF8F0', não a classe bg-white), logo não inverte — var(--ink)
              inverteria sozinho e dava 1,21:1 (quase branco sobre branco) em escuro. */}
          <p className="text-sm font-bold truncate" style={{ fontFamily: FONT_TITLE, color: FT.ink }}>{group.name}</p>
          {extras.length > 0 && (
            <button
              onClick={() => toggleWorker(group.id)}
              className="px-1.5 py-0.5 rounded-full bg-[var(--surface-dim)] text-[var(--ink-soft)] hover:bg-[var(--border)] transition-colors"
              style={{ fontFamily: FONT_MONO, fontSize: 8 }}
            >
              +{extras.length} aviso{extras.length !== 1 ? 's' : ''}
            </button>
          )}
        </div>
      </div>
      <div className="px-4 pb-3.5">
        {primary && <AvisoRow req={primary} destaque={destaque} ctx={ctx} />}
      </div>
      {isOpen && extras.length > 0 && (
        <div className="px-4 pb-4 pl-8 space-y-2 border-t border-[var(--border-soft)] pt-3">
          {extras.map(req => <AvisoRow key={req.id} req={req} destaque={false} ctx={ctx} />)}
        </div>
      )}
    </div>
  );
}

// Cartão de trabalhador sem pendências — secção 3. Avatar ok (branco/ok dá
// 5,05:1; branco/okBg, o par original da spec, dava 1,14:1 e falhava
// catastroficamente — okBg é fundo claro, não par de texto branco).
function DoneWorkerCard({ group, ctx }) {
  const { openWorkers, toggleWorker } = ctx;
  const sortedReqs = [...group.requests].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  const isOpen = openWorkers.has(group.id);
  return (
    <div className="rounded-2xl border border-[var(--border-soft)] shadow-sm overflow-hidden bg-white">
      <div onClick={() => toggleWorker(group.id)} className="px-4 py-3 flex items-center gap-3 cursor-pointer select-none hover:bg-[var(--surface)] transition-colors">
        <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-white text-xs font-black" style={{ background: FT.ok }}>
          {getInitials(group.name)}
        </div>
        <p className="flex-1 min-w-0 text-sm font-bold text-[var(--ink)] truncate" style={{ fontFamily: FONT_TITLE }}>{group.name}</p>
        <span className={`${SCALE.text.meta} text-[var(--slate-dim)]`}>{sortedReqs.length} aviso{sortedReqs.length !== 1 ? 's' : ''}</span>
        {isOpen ? <ChevronUp size={14} className="text-[var(--slate)] shrink-0" /> : <ChevronDown size={14} className="text-[var(--slate)] shrink-0" />}
      </div>
      {isOpen && (
        <div className="px-4 pb-4 space-y-2 border-t border-[var(--border-soft)] pt-3">
          {sortedReqs.map(req => <AvisoRow key={req.id} req={req} destaque={false} ctx={ctx} />)}
        </div>
      )}
    </div>
  );
}

export default function AbsenceRequestsPanel({ requests, systemSettings, clients }) {
  const { supabase, setAbsenceRequests, currentUser } = useApp();
  const [copiedId, setCopiedId] = useState(null);
  const [search, setSearch] = useState('');
  const [openIds, setOpenIds] = useState(new Set());
  const toggleOpen = (id) => setOpenIds(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
  const [openWorkers, setOpenWorkers] = useState(new Set());
  const toggleWorker = (id) => setOpenWorkers(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });

  const notifyClient = systemSettings?.absenceConfig?.absence_notify_client ?? false;

  const handleApprove = async (req) => {
    if (!supabase) return;
    const { error } = await supabase.from('absence_requests').update({ status: 'approved' }).eq('id', req.id);
    if (!error) {
      setAbsenceRequests(prev => prev.map(r =>
        r.id === req.id ? { ...r, status: 'approved' } : r
      ));
      const dateStr = (req.dates || []).slice(0, 3).join(', ') + ((req.dates || []).length > 3 ? '…' : '');
      notifyEvent(supabase, {
        idPrefix: 'notif_absence',
        title: `✅ Ausência aprovada`,
        message: `A tua ausência${dateStr ? ` de ${dateStr}` : ''} foi aprovada.`,
        type: 'success',
        target: TARGET.WORKER,
        targetWorkerIds: [req.worker_id],
        payload: { absenceId: req.id, kind: 'absence' },
        push: { url: '/worker', tag: 'absence-approved' },
      });
    }
  };

  const handleRevert = async (req) => {
    if (!supabase) return;
    const { error } = await supabase.from('absence_requests').update({ status: 'pending' }).eq('id', req.id);
    if (!error) {
      setAbsenceRequests(prev => prev.map(r =>
        r.id === req.id ? { ...r, status: 'pending' } : r
      ));
    }
  };

  const handleArchive = async (req) => {
    if (!supabase) return;
    const { error } = await supabase.from('absence_requests').update({ status: 'archived' }).eq('id', req.id);
    if (!error) {
      setAbsenceRequests(prev => prev.map(r =>
        r.id === req.id ? { ...r, status: 'archived' } : r
      ));
      if (req.worker_id) {
        const dateStr = (req.dates || []).slice(0, 3).join(', ') + ((req.dates || []).length > 3 ? '…' : '');
        notifyEvent(supabase, {
          idPrefix: 'notif_absence_arch',
          title: `🗄️ Pedido de ausência arquivado`,
          message: `O teu pedido de ausência${dateStr ? ` de ${dateStr}` : ''} foi arquivado.`,
          type: 'info',
          target: TARGET.WORKER,
          targetWorkerIds: [req.worker_id],
          payload: { absenceId: req.id, kind: 'absence' },
          push: { url: '/worker', tag: 'absence-archived' },
        });
      }
    }
  };

  const handleDelete = async (req) => {
    if (!supabase) return;
    if (!window.confirm('Apagar este pedido de falta? O registo fica guardado no log de auditoria, mas esta ação não pode ser desfeita.')) return;
    try {
      await deleteAbsenceRequest(supabase, req, {
        actorId: currentUser?.id || 'admin_system',
        actorName: currentUser?.name || 'Admin',
        actorRole: 'admin',
      });
      setAbsenceRequests(prev => prev.filter(r => r.id !== req.id));
    } catch (e) {
      console.error('Falha ao apagar pedido de falta:', e);
    }
  };

  const buildEmailText = (req) => {
    const dateLabels = (req.dates || []).sort().map(ds =>
      new Date(ds + 'T00:00:00').toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' })
    ).join(', ');
    return `Assunto: Aviso de Falta — ${req.worker_name}\n\nBom dia,\n\nVenho por este meio informar que o colaborador ${req.worker_name} avisou que não poderá comparecer ao trabalho nos seguintes dias:\n${dateLabels}\n\nMotivo: ${req.reason}${req.notes ? `\nNotas: ${req.notes}` : ''}\n\nCumprimentos,\nMagnetic Place`;
  };

  const handleCopyEmail = (req) => {
    navigator.clipboard.writeText(buildEmailText(req));
    setCopiedId(req.id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  const visibleRequests = (requests || []).filter(r => r.status !== 'archived');

  if (!visibleRequests.length) {
    return (
      <div className="bg-white rounded-2xl border border-[var(--border-soft)] shadow-sm px-6 py-10 text-center">
        <CalendarX size={28} className="text-[var(--slate)] mx-auto mb-3" />
        <p className="text-xs font-black uppercase text-[var(--slate-dim)] tracking-widest">Sem avisos de falta</p>
        <p className={`${SCALE.text.meta} text-[var(--slate-dim)] mt-1`}>Os avisos dos colaboradores aparecerão aqui.</p>
      </div>
    );
  }

  const workerGroups = Object.values(
    visibleRequests.reduce((acc, req) => {
      if (!acc[req.worker_id]) acc[req.worker_id] = { id: req.worker_id, name: req.worker_name, requests: [] };
      acc[req.worker_id].requests.push(req);
      return acc;
    }, {})
  ).map(group => {
    const pendingDates = group.requests.filter(r => r.status === 'pending').map(r => new Date(r.created_at));
    const oldestPendingAt = pendingDates.length ? new Date(Math.min(...pendingDates)) : null;
    return { ...group, oldestPendingAt };
  }).sort((a, b) => {
    const aPending = a.oldestPendingAt ? 0 : 1;
    const bPending = b.oldestPendingAt ? 0 : 1;
    if (aPending !== bPending) return aPending - bPending;
    if (aPending === 0) return a.oldestPendingAt - b.oldestPendingAt;
    return a.name.localeCompare(b.name);
  });

  // Pesquisa por nome de trabalhador — aplicada depois de agrupar, antes de separar
  // por secção. Os contadores "N pendentes"/"N aprovados" ficam de fora da pesquisa
  // de propósito: mostram o total real, não o total do que está visível no ecrã.
  const searchedGroups = search.trim()
    ? workerGroups.filter(g => g.name.toLowerCase().includes(search.trim().toLowerCase()))
    : workerGroups;

  const pendingGroups = searchedGroups.filter(g => g.oldestPendingAt);
  const doneGroups = searchedGroups.filter(g => !g.oldestPendingAt);
  const maisUrgente = pendingGroups[0] || null;
  const restantesPendentes = pendingGroups.slice(1);

  const pendingTotal = visibleRequests.filter(r => r.status === 'pending').length;
  const approvedTotal = visibleRequests.filter(r => r.status === 'approved').length;

  const ctx = { clients, notifyClient, openIds, toggleOpen, openWorkers, toggleWorker, handleApprove, handleArchive, handleDelete, handleRevert, copiedId, handleCopyEmail };

  return (
    <div className="space-y-4">
      <header className="flex items-center gap-3">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-[var(--tone-amber-bg)] text-[var(--tone-amber)]"><Clock size={16} /></div>
        <h3 className="font-black text-base sm:text-xl text-[var(--ink)] uppercase tracking-tight" style={{ fontFamily: FONT_TITLE }}>Faltas</h3>
      </header>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="relative flex-1 min-w-0 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--slate)] pointer-events-none" />
          <input
            type="text"
            placeholder="Pesquisar colaborador..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-2 text-xs border border-[var(--border)] rounded-xl bg-[var(--surface)] focus:outline-none focus:ring-2 focus:ring-indigo-300"
          />
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {/* text-orange-700 dava 4,56:1, só 0,06 acima do mínimo AA — trocado
              para #8a4a00 (5,99:1, folga real), o mesmo laranja já usado nesta
              página para "solicitado há Nd" e os chips em destaque — um só
              laranja de urgência no componente, não um terceiro tom novo. */}
          <span className={`px-2.5 py-1 rounded-full bg-orange-100 ${SCALE.text.badge}`} style={{ color: '#8a4a00' }}>{pendingTotal} pendente{pendingTotal !== 1 ? 's' : ''}</span>
          <span className={`px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 ${SCALE.text.badge}`}>{approvedTotal} aprovado{approvedTotal !== 1 ? 's' : ''}</span>
        </div>
      </div>

      {search.trim() && searchedGroups.length === 0 && (
        <p className="text-center text-[var(--slate-dim)] text-sm py-8">Nenhum colaborador encontrado para "{search.trim()}".</p>
      )}

      {maisUrgente && (
        <div>
          <p className="mb-2 flex items-center gap-1.5 text-[var(--slate-dim)]" style={{ fontFamily: FONT_MONO, fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            <ClockAlert size={11} style={{ color: '#8a4a00' }} /> Aguardando há mais tempo
          </p>
          <PendingWorkerCard group={maisUrgente} destaque ctx={ctx} />
        </div>
      )}

      {restantesPendentes.length > 0 && (
        <div>
          <p className="mb-2 flex items-center gap-1.5 text-[var(--slate-dim)]" style={{ fontFamily: FONT_MONO, fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            <ListChecks size={11} className="text-[var(--slate-dim)]" /> Restantes pendentes
          </p>
          <div className="space-y-2">
            {restantesPendentes.map(group => <PendingWorkerCard key={group.id} group={group} destaque={false} ctx={ctx} />)}
          </div>
        </div>
      )}

      {doneGroups.length > 0 && (
        <div style={{ opacity: 0.75 }}>
          <p className="mb-2 flex items-center gap-1.5 text-[var(--slate-dim)]" style={{ fontFamily: FONT_MONO, fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            <Users size={11} className="text-[var(--slate-dim)]" /> Sem pendências
          </p>
          <div className="space-y-2">
            {doneGroups.map(group => <DoneWorkerCard key={group.id} group={group} ctx={ctx} />)}
          </div>
        </div>
      )}
    </div>
  );
}
