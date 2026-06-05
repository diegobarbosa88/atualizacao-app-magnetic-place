import React, { useMemo, useState } from 'react';
import { ChevronLeft, MessageCircle, FileText, Plus, Trash2 } from 'lucide-react';
import { useApp } from '../../../context/AppContext';
import { markUnderReview, setItemResolution, applyCorrection, rejectCorrection, applyAdminDraftToQuick, markResolved, applyCreationRequest } from '../../../utils/correctionsApi';
import { StepPrecision } from '../../client-report/ClientReportFlow';
import ItemRow from './ItemRow';
import { STATUS_LABEL, TYPE_LABEL, detectKind, itemDelta, fmtDelta } from './correctionsUtils';

export default function CorrectionDetail({ correction, items, onBack }) {
  const { supabase, clients, workers, logs, currentUser, setCorrections, setCorrectionItems } = useApp();
  const client = clients.find((c) => String(c.id) === String(correction.client_id));
  const clientName = client?.name || 'Cliente';
  const clientEmail = client?.email || null;
  const [busy, setBusy] = useState(false);

  const clientWorkers = useMemo(() => {
    const ids = new Set(
      (logs || [])
        .filter((l) => String(l.clientId) === String(correction.client_id) && (l.date || '').startsWith(correction.month))
        .map((l) => String(l.workerId))
    );
    return (workers || []).filter((w) => ids.has(String(w.id)));
  }, [workers, logs, correction.client_id, correction.month]);

  React.useEffect(() => {
    const isWorkerType = correction.type === 'creation_request' || correction.type === 'deletion_request';
    if (correction.status === 'submitted' && supabase && !isWorkerType) {
      markUnderReview(supabase, correction.id, currentUser?.id)
        .then(() => setCorrections((prev) => prev.map((c) => (c.id === correction.id ? { ...c, status: 'under_review' } : c))))
        .catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [correction.id]);

  const resolved = items.filter((it) => it.item_status !== 'pending').length;
  const total = items.length;
  const canApply = total === 0 ? false : resolved === total && correction.status !== 'applied' && correction.status !== 'rejected';
  const isClosed = correction.status === 'applied' || correction.status === 'rejected';

  const kindCounts = useMemo(() => {
    const c = { new: 0, remove: 0, edit: 0 };
    items.forEach((it) => { c[detectKind(it)] += 1; });
    return c;
  }, [items]);

  const monthDelta = useMemo(() => Number(items.reduce((acc, it) => acc + itemDelta(it), 0).toFixed(2)), [items]);

  const precisionInitialEntries = useMemo(() => {
    if (correction.type !== 'precision') return {};
    const result = {};
    items.forEach((item) => {
      const kind = detectKind(item);
      if (!result[item.worker_id]) result[item.worker_id] = {};
      if (kind === 'new')         result[item.worker_id][item.date] = { kind: 'new', values: item.proposed };
      else if (kind === 'remove') result[item.worker_id][item.date] = { kind: 'remove' };
      else                        result[item.worker_id][item.date] = { kind: 'edit', changes: item.proposed };
    });
    return result;
  }, [correction.type, items]);

  const onApply = async () => {
    if (!canApply) return;
    if (!confirm(`Aplicar ${resolved} alteração(ões) ao relatório de ${clientName}?`)) return;
    setBusy(true);
    try {
      await applyCorrection(supabase, { correction, items, logs, reviewer: currentUser?.id, clientName, clientEmail, portalBase: window.location.origin, shareToken: client?.share_token });
      setCorrections((prev) => prev.map((c) => c.id === correction.id ? { ...c, status: 'applied', reviewed_at: new Date().toISOString(), reviewed_by: currentUser?.id || null } : c));
      alert('Correção aplicada com sucesso.');
      onBack();
    } catch (e) { alert('Erro ao aplicar: ' + e.message); }
    finally { setBusy(false); }
  };

  const onQuickApplyDraft = async ({ items: draftItems }) => {
    if (!draftItems || draftItems.length === 0) { alert('Não foram feitas alterações. Use "Marcar como Resolvido" se considera o pedido tratado.'); return; }
    if (!confirm(`Aplicar ${draftItems.length} alteração(ões) ao relatório de ${clientName}?`)) return;
    setBusy(true);
    try {
      await applyAdminDraftToQuick(supabase, { correction, draftItems, logs, reviewer: currentUser?.id, clientName, clientEmail });
      setCorrections((prev) => prev.map((c) => c.id === correction.id ? { ...c, status: 'applied', reviewed_at: new Date().toISOString(), reviewed_by: currentUser?.id || null } : c));
      alert('Alterações aplicadas. Cliente notificado.');
      onBack();
    } catch (e) { alert('Erro ao aplicar: ' + e.message); }
    finally { setBusy(false); }
  };

  const onMarkResolved = async () => {
    const note = prompt('Nota opcional para o cliente (Enter para deixar vazio):') || '';
    if (!confirm('Marcar como resolvido sem alterar horários?')) return;
    setBusy(true);
    try {
      await markResolved(supabase, { correctionId: correction.id, clientId: correction.client_id, month: correction.month, note, reviewer: currentUser?.id, clientName, clientEmail, portalBase: window.location.origin, shareToken: client?.share_token });
      setCorrections((prev) => prev.map((c) => c.id === correction.id ? { ...c, status: 'applied', reviewed_at: new Date().toISOString(), reviewed_by: currentUser?.id || null } : c));
      alert('Correção marcada como resolvida.');
      onBack();
    } catch (e) { alert('Erro: ' + e.message); }
    finally { setBusy(false); }
  };

  const onApproveCreationRequest = async () => {
    if (!confirm('Aprovar este pedido de registo? Os horários serão atualizados/criados no relatório.')) return;
    setBusy(true);
    try {
      await applyCreationRequest(supabase, { correction, items, logs, clientName, clientEmail, portalBase: window.location.origin });
      setCorrections((prev) => prev.map((c) => c.id === correction.id ? { ...c, status: 'applied', reviewed_at: new Date().toISOString(), reviewed_by: currentUser?.id || null } : c));
      alert('Pedido aprovado. Relatório atualizado.');
      onBack();
    } catch (e) { alert('Erro ao aprovar: ' + e.message); }
    finally { setBusy(false); }
  };

  const onReject = async () => {
    const reason = prompt('Motivo da rejeição (será enviado ao cliente):');
    if (reason === null) return;
    setBusy(true);
    try {
      await rejectCorrection(supabase, { correctionId: correction.id, clientId: correction.client_id, month: correction.month, reason, reviewer: currentUser?.id, clientName, clientEmail, portalBase: window.location.origin, shareToken: client?.share_token });
      setCorrections((prev) => prev.map((c) => c.id === correction.id ? { ...c, status: 'rejected', reviewed_at: new Date().toISOString(), justification: reason } : c));
      alert('Correção rejeitada. Cliente notificado.');
      onBack();
    } catch (e) { alert('Erro: ' + e.message); }
    finally { setBusy(false); }
  };

  const editorButtons = (
    <div className="flex gap-2">
      <button onClick={onMarkResolved} disabled={busy} className="px-4 py-2.5 bg-slate-700 hover:bg-slate-800 text-white rounded-xl text-[10px] font-black uppercase tracking-widest disabled:opacity-50">Marcar como Resolvido</button>
      <button onClick={onReject} disabled={busy} className="px-4 py-2.5 bg-rose-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest disabled:opacity-50">Rejeitar</button>
    </div>
  );

  return (
    <div className="space-y-6">
      <button onClick={onBack} className="flex items-center gap-2 text-slate-500 hover:text-slate-800 font-black text-[10px] uppercase tracking-widest">
        <ChevronLeft size={16} /> Voltar à inbox
      </button>

      <header className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tight">{clientName}</h2>
            <p className="text-sm text-slate-500 font-medium mt-1">Mês {correction.month} • Tipo {TYPE_LABEL[correction.type]?.label || correction.type}</p>
            <span className={`mt-2 inline-block text-[10px] font-black px-2 py-1 rounded-md ${STATUS_LABEL[correction.status]?.cls}`}>{STATUS_LABEL[correction.status]?.label}</span>
          </div>
          <div className="text-right flex gap-6">
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Resolução</p>
              <p className="text-3xl font-black text-slate-800">{resolved}/{total}</p>
              <div className="flex gap-2 mt-2 justify-end text-[10px] font-black flex-wrap">
                {kindCounts.edit   > 0 && <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700">{kindCounts.edit} ajuste(s)</span>}
                {kindCounts.new    > 0 && <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700">{kindCounts.new} novo(s)</span>}
                {kindCounts.remove > 0 && <span className="px-2 py-0.5 rounded-md bg-rose-50 text-rose-700">{kindCounts.remove} remover</span>}
              </div>
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Diferença mês</p>
              <p className={`text-3xl font-black ${monthDelta > 0 ? 'text-emerald-600' : monthDelta < 0 ? 'text-rose-600' : 'text-slate-400'}`}>{fmtDelta(monthDelta)}</p>
            </div>
          </div>
        </div>
        {correction.justification && (
          <p className="mt-4 text-sm text-slate-600 italic border-l-4 border-slate-200 pl-3">"{correction.justification}"</p>
        )}
      </header>

      {/* Quick correction — editor */}
      {correction.type === 'quick' && !isClosed && (
        <>
          <div className="bg-white rounded-3xl border-2 border-amber-200 p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-amber-100 text-amber-600 rounded-xl flex items-center justify-center"><MessageCircle size={20} /></div>
              <div>
                <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest">Mensagem do cliente</p>
                <p className="text-xs text-slate-500">{clientName} • {correction.submitted_at?.slice(0, 16).replace('T', ' ')}</p>
              </div>
            </div>
            <p className="text-sm text-slate-700 font-medium whitespace-pre-wrap">{correction.justification || '(sem texto)'}</p>
          </div>
          <div className="bg-white rounded-3xl border border-slate-100 p-4">
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Editor</p>
                <p className="text-sm text-slate-600">Faça as alterações que considera correctas e aplique ao relatório.</p>
              </div>
              {editorButtons}
            </div>
            <StepPrecision workers={clientWorkers} logs={logs} month={correction.month} busy={busy} showBack={false} showJustification={false} submitLabel="Aplicar Alterações ao Relatório" onSubmit={onQuickApplyDraft} />
          </div>
        </>
      )}

      {/* Precision correction — editor */}
      {correction.type === 'precision' && !isClosed && (
        <div className="bg-white rounded-3xl border border-slate-100 p-4">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Editor</p>
              <p className="text-sm text-slate-600">As alterações do cliente estão pré-carregadas. Pode modificar antes de aplicar.</p>
            </div>
            {editorButtons}
          </div>
          <StepPrecision workers={clientWorkers} logs={logs} month={correction.month} busy={busy} showBack={false} showJustification={false} submitLabel="Aplicar Alterações ao Relatório" initialEntries={precisionInitialEntries} onSubmit={onQuickApplyDraft} />
        </div>
      )}

      {/* Closed corrections — show items read-only */}
      {isClosed && (
        <div className="space-y-3">
          {items.length === 0 && (
            <div className="bg-white rounded-2xl border border-slate-100 p-6 text-sm text-slate-500">
              {correction.type === 'quick' ? 'Correção rápida sem alterações aplicadas (apenas mensagem do cliente).'
                : correction.type === 'creation_request' ? 'Pedido de criação de registo.'
                : 'Sem items detalhados.'}
            </div>
          )}
          {items.map((it) => <ItemRow key={it.id} item={it} supabase={supabase} disabled={true} setCorrectionItems={setCorrectionItems} />)}
        </div>
      )}

      {/* Creation request with items */}
      {correction.type === 'creation_request' && !isClosed && items.length > 0 && (
        <div className="bg-amber-50 rounded-3xl border-2 border-amber-200 p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-amber-100 text-amber-600 rounded-xl flex items-center justify-center"><FileText size={20} /></div>
            <div>
              <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest">Pedido de Registo</p>
              <p className="text-xs text-slate-500">{clientName} • {correction.submitted_at?.slice(0, 16).replace('T', ' ')}</p>
            </div>
          </div>
          {items.map(it => (
            <div key={it.id} className="bg-white rounded-xl p-4 mb-3 border border-amber-100">
              <p className="text-[10px] font-black text-slate-400 uppercase mb-2">{it.worker_name} • {it.date}</p>
              {it.before && <div className="mb-2"><p className="text-[9px] font-black text-rose-500 uppercase mb-1">Original:</p><div className="flex gap-4 text-xs font-bold text-slate-600"><span>Entrada: {it.before.startTime || '--:--'}</span><span>Saída: {it.before.endTime || '--:--'}</span>{it.before.breakStart && <span>Pausa: {it.before.breakStart} - {it.before.breakEnd}</span>}</div></div>}
              {it.proposed && <div><p className="text-[9px] font-black text-emerald-600 uppercase mb-1">Proposto:</p><div className="flex gap-4 text-xs font-bold text-slate-800"><span>Entrada: {it.proposed.startTime || '--:--'}</span><span>Saída: {it.proposed.endTime || '--:--'}</span>{it.proposed.breakStart && <span>Pausa: {it.proposed.breakStart} - {it.proposed.breakEnd}</span>}</div></div>}
            </div>
          ))}
          {correction.justification && <p className="text-sm text-slate-600 italic border-l-4 border-amber-200 pl-3 mt-3">"{correction.justification}"</p>}
          <div className="flex gap-2 mt-4 pt-4 border-t border-amber-200">
            <button onClick={onApproveCreationRequest} disabled={busy} className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest disabled:opacity-50">Aprovar</button>
            <button onClick={onReject} disabled={busy} className="px-4 py-2.5 bg-rose-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest disabled:opacity-50">Rejeitar</button>
          </div>
        </div>
      )}

      {/* Creation request without items */}
      {correction.type === 'creation_request' && !isClosed && items.length === 0 && (
        <div className="bg-amber-50 rounded-3xl border-2 border-amber-200 p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-amber-100 text-amber-600 rounded-xl flex items-center justify-center"><Plus size={20} /></div>
            <div>
              <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest">Pedido de Criação</p>
              <p className="text-xs text-slate-500">{clientName} • {correction.submitted_at?.slice(0, 16).replace('T', ' ')}</p>
            </div>
          </div>
          <p className="text-sm text-slate-700 font-medium whitespace-pre-wrap">{correction.justification || '(sem descrição)'}</p>
          <div className="flex gap-2 mt-4 pt-4 border-t border-amber-200">
            <button onClick={onMarkResolved} disabled={busy} className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest disabled:opacity-50">Aprovar Criação</button>
            <button onClick={onReject} disabled={busy} className="px-4 py-2.5 bg-rose-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest disabled:opacity-50">Rejeitar</button>
          </div>
        </div>
      )}

      {/* Deletion request with items */}
      {correction.type === 'deletion_request' && !isClosed && items.length > 0 && (
        <div className="bg-rose-50 rounded-3xl border-2 border-rose-200 p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-rose-100 text-rose-600 rounded-xl flex items-center justify-center"><Trash2 size={20} /></div>
            <div>
              <p className="text-[10px] font-black text-rose-600 uppercase tracking-widest">Pedido de Eliminação</p>
              <p className="text-xs text-slate-500">{clientName} • {correction.submitted_at?.slice(0, 16).replace('T', ' ')}</p>
            </div>
          </div>
          {items.map(it => (
            <div key={it.id} className="bg-white rounded-xl p-4 mb-3 border border-rose-100">
              <p className="text-[10px] font-black text-slate-400 uppercase mb-2">{it.worker_name} • {it.date}</p>
              {it.before && <div className="mb-2"><p className="text-[9px] font-black text-rose-500 uppercase mb-1">A eliminar:</p><div className="flex gap-4 text-xs font-bold text-slate-800"><span>Entrada: {it.before.startTime || '--:--'}</span><span>Saída: {it.before.endTime || '--:--'}</span>{it.before.breakStart && <span>Pausa: {it.before.breakStart} - {it.before.breakEnd}</span>}</div></div>}
            </div>
          ))}
          {correction.justification && <p className="text-sm text-slate-600 italic border-l-4 border-rose-200 pl-3 mt-3">"{correction.justification}"</p>}
          <div className="flex gap-2 mt-4 pt-4 border-t border-rose-200">
            <button onClick={onApproveCreationRequest} disabled={busy} className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest disabled:opacity-50">Confirmar Eliminação</button>
            <button onClick={onReject} disabled={busy} className="px-4 py-2.5 bg-slate-200 text-slate-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-300 transition-colors disabled:opacity-50">Cancelar</button>
          </div>
        </div>
      )}

      {/* Deletion request without items */}
      {correction.type === 'deletion_request' && !isClosed && items.length === 0 && (
        <div className="bg-rose-50 rounded-3xl border-2 border-rose-200 p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-rose-100 text-rose-600 rounded-xl flex items-center justify-center"><Trash2 size={20} /></div>
            <div>
              <p className="text-[10px] font-black text-rose-600 uppercase tracking-widest">Pedido de Eliminação</p>
              <p className="text-xs text-slate-500">{clientName} • {correction.submitted_at?.slice(0, 16).replace('T', ' ')}</p>
            </div>
          </div>
          <p className="text-sm text-slate-700 font-medium whitespace-pre-wrap">{correction.justification || '(sem descrição)'}</p>
          <div className="flex gap-2 mt-4 pt-4 border-t border-rose-200">
            <button onClick={onMarkResolved} disabled={busy} className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest disabled:opacity-50">Confirmar Eliminação</button>
            <button onClick={onReject} disabled={busy} className="px-4 py-2.5 bg-slate-200 text-slate-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-300 transition-colors disabled:opacity-50">Cancelar</button>
          </div>
        </div>
      )}
    </div>
  );
}
