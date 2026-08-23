import React, { useState, useEffect, useMemo } from 'react';
import { ShieldAlert, Loader2, Eye, ThumbsUp, CheckCircle2, XCircle, AlertOctagon, BadgeCheck } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import ModalShell from '../../components/common/ModalShell';
import SectionHeaderShell from '../../components/common/SectionHeaderShell';
import Card from "../../components/common/Card";
import { FT } from '../../styles/designTokens';

const SEVERIDADE_CFG = {
  alta:  { label: 'Alta',  order: 0, bg: 'bg-rose-50',   text: 'text-rose-600',   dot: 'bg-rose-500' },
  media: { label: 'Média', order: 1, bg: 'bg-amber-50',  text: 'text-amber-600',  dot: 'bg-amber-500' },
  baixa: { label: 'Baixa', order: 2, bg: 'bg-[var(--surface-dim)]', text: 'text-[var(--slate-dim)]',  dot: 'bg-[var(--slate)]' },
};

const STATUS_CFG = {
  pendente:  { label: 'Pendente',  bg: 'bg-amber-50',   text: 'text-amber-600' },
  visto:     { label: 'Visto',     bg: 'bg-blue-50',    text: 'text-blue-600' },
  resolvido: { label: 'Resolvido', bg: 'bg-emerald-50', text: 'text-emerald-600' },
  ignorado:  { label: 'Ignorado',  bg: 'bg-[var(--surface-dim)]',  text: 'text-[var(--slate-dim)]' },
};

const STATUS_FILTERS = ['pendente', 'visto', 'resolvido', 'ignorado', 'todos'];

export default function AlertasAdmin() {
  const { supabase } = useApp();
  const [alertas, setAlertas] = useState([]);
  const [acoesAprovadas, setAcoesAprovadas] = useState(() => new Set());
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('pendente');
  const [busyId, setBusyId] = useState(null);
  const [confirmIgnorar, setConfirmIgnorar] = useState(null);
  const [toast, setToast] = useState(null);

  const showToast = (type, text) => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchAlertas = async () => {
    if (!supabase) return;
    setLoading(true);
    const [{ data, error }, { data: acoes, error: acoesError }] = await Promise.all([
      supabase.from('gestao_alertas').select('*').order('created_at', { ascending: false }),
      supabase.from('gestao_acoes_propostas').select('alerta_id'),
    ]);
    if (error) console.error('Erro ao carregar alertas:', error);
    if (acoesError) console.error('Erro ao carregar ações propostas:', acoesError);
    setAlertas(data || []);
    setAcoesAprovadas(new Set((acoes || []).map(a => a.alerta_id)));
    setLoading(false);
  };

  useEffect(() => { fetchAlertas(); }, [supabase]);

  const alertasOrdenados = useMemo(() => {
    const filtrados = statusFilter === 'todos' ? alertas : alertas.filter(a => a.status === statusFilter);
    return [...filtrados].sort((a, b) => {
      const ordA = SEVERIDADE_CFG[a.severidade]?.order ?? 99;
      const ordB = SEVERIDADE_CFG[b.severidade]?.order ?? 99;
      if (ordA !== ordB) return ordA - ordB;
      return new Date(b.created_at) - new Date(a.created_at);
    });
  }, [alertas, statusFilter]);

  const pendentesCount = alertas.filter(a => a.status === 'pendente').length;

  const updateStatus = async (alerta, status) => {
    setBusyId(alerta.id);
    const { error } = await supabase
      .from('gestao_alertas')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', alerta.id);
    if (error) {
      console.error('Erro ao atualizar alerta:', error);
      showToast('error', 'Erro ao atualizar alerta: ' + error.message);
    } else {
      setAlertas(prev => prev.map(a => a.id === alerta.id ? { ...a, status } : a));
      showToast('success', 'Alerta atualizado.');
    }
    setBusyId(null);
  };

  const aprovarAcao = async (alerta) => {
    if (!alerta.acao_sugerida || busyId === alerta.id || acoesAprovadas.has(alerta.id)) return;
    setBusyId(alerta.id);
    const { error } = await supabase.from('gestao_acoes_propostas').insert({
      alerta_id: alerta.id,
      descricao: alerta.acao_sugerida,
      status: 'aprovada',
    });
    if (error) {
      console.error('Erro ao aprovar ação:', error);
      if (error.code === '23505') {
        // já existe uma ação aprovada para este alerta (constraint UNIQUE) — sincroniza o estado local
        setAcoesAprovadas(prev => new Set(prev).add(alerta.id));
        showToast('error', 'Este alerta já tem uma ação aprovada.');
      } else {
        showToast('error', 'Erro ao aprovar ação: ' + error.message);
      }
    } else {
      setAcoesAprovadas(prev => new Set(prev).add(alerta.id));
      showToast('success', 'Ação aprovada e registada.');
    }
    setBusyId(null);
  };

  const confirmarIgnorar = async () => {
    if (!confirmIgnorar) return;
    await updateStatus(confirmIgnorar, 'ignorado');
    setConfirmIgnorar(null);
  };

  return (
    <Card className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <SectionHeaderShell
        icon={<ShieldAlert size={18} />}
        title="Gestão de Alertas"
        subtitle="Compliance, segurança e administração"
        rightSlot={pendentesCount > 0 && (
          <span className="text-[10px] font-black px-2.5 py-1 rounded-full bg-red-500 text-white shrink-0">
            {pendentesCount} pendente{pendentesCount > 1 ? 's' : ''}
          </span>
        )}
      />

      <div className="flex flex-wrap gap-2 mb-5">
        {STATUS_FILTERS.map(s => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${
              statusFilter === s ? 'text-white' : 'bg-[var(--surface-dim)] text-[var(--ink-soft)] hover:bg-[var(--border)]'
            }`}
            style={statusFilter === s ? { backgroundColor: FT.navy } : {}}
          >
            {s === 'todos' ? 'Todos' : STATUS_CFG[s].label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-[var(--slate-dim)]">
          <Loader2 className="animate-spin" size={24} />
        </div>
      ) : alertasOrdenados.length === 0 ? (
        <p className="text-center py-10 text-[var(--slate-dim)] text-xs font-bold">Nenhum alerta {statusFilter !== 'todos' ? `com estado "${STATUS_CFG[statusFilter]?.label}"` : ''}.</p>
      ) : (
        <div className="space-y-3">
          {alertasOrdenados.map(alerta => {
            const sevCfg = SEVERIDADE_CFG[alerta.severidade] || SEVERIDADE_CFG.baixa;
            const statCfg = STATUS_CFG[alerta.status] || STATUS_CFG.pendente;
            const isBusy = busyId === alerta.id;
            return (
              <div key={alerta.id} className="p-4 rounded-[1.5rem] border border-[var(--border-soft)] bg-white shadow-sm hover:shadow-md transition-all">
                <div className="flex items-start gap-3">
                  <div className={`p-3 rounded-2xl ${sevCfg.bg} ${sevCfg.text} shrink-0`}>
                    <AlertOctagon size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest ${sevCfg.bg} ${sevCfg.text}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${sevCfg.dot}`} /> {sevCfg.label}
                      </span>
                      <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest bg-[var(--surface-dim)] text-[var(--ink-soft)]">
                        {alerta.tipo}
                      </span>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest ${statCfg.bg} ${statCfg.text}`}>
                        {statCfg.label}
                      </span>
                    </div>
                    <p className="text-sm font-black text-[var(--ink)]">{alerta.titulo}</p>
                    {alerta.descricao && (
                      <p className="text-xs text-[var(--slate-dim)] mt-1 leading-relaxed">{alerta.descricao}</p>
                    )}
                    {alerta.acao_sugerida && (
                      <div className="mt-3 p-3 rounded-2xl bg-[var(--surface)] border border-[var(--border-soft)]">
                        <p className="text-[9px] font-black uppercase text-[var(--slate-dim)] tracking-widest mb-1">Ação Sugerida</p>
                        <p className="text-xs text-[var(--ink-soft)] leading-relaxed">{alerta.acao_sugerida}</p>
                      </div>
                    )}

                    <div className="flex flex-wrap gap-2 mt-3">
                      {alerta.status === 'pendente' && (
                        <button
                          onClick={() => updateStatus(alerta, 'visto')}
                          disabled={isBusy}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-wider bg-blue-50 text-blue-600 hover:bg-blue-100 transition-all disabled:opacity-50"
                        >
                          <Eye size={12} /> Marcar como visto
                        </button>
                      )}
                      {alerta.acao_sugerida && (
                        acoesAprovadas.has(alerta.id) ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-wider bg-indigo-50 text-indigo-400">
                            <BadgeCheck size={12} /> Ação aprovada
                          </span>
                        ) : (
                          <button
                            onClick={() => aprovarAcao(alerta)}
                            disabled={isBusy}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-wider bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-all disabled:opacity-50"
                          >
                            {isBusy ? <Loader2 size={12} className="animate-spin" /> : <ThumbsUp size={12} />} Aprovar ação sugerida
                          </button>
                        )
                      )}
                      {alerta.status !== 'resolvido' && (
                        <button
                          onClick={() => updateStatus(alerta, 'resolvido')}
                          disabled={isBusy}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-all disabled:opacity-50"
                        >
                          <CheckCircle2 size={12} /> Marcar como resolvido
                        </button>
                      )}
                      {alerta.status !== 'ignorado' && (
                        <button
                          onClick={() => setConfirmIgnorar(alerta)}
                          disabled={isBusy}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-wider bg-[var(--surface-dim)] text-[var(--ink-soft)] hover:bg-[var(--border)] transition-all disabled:opacity-50"
                        >
                          <XCircle size={12} /> Ignorar
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ModalShell
        isOpen={!!confirmIgnorar}
        onClose={() => setConfirmIgnorar(null)}
        title="Ignorar alerta"
        subtitle={confirmIgnorar?.titulo}
        icon={<XCircle size={16} />}
        accent="danger"
        size="sm"
        footer={
          <div className="flex gap-2 p-4 border-t border-[var(--border-soft)]">
            <button
              onClick={() => setConfirmIgnorar(null)}
              className="flex-1 py-3 border border-[var(--border)] rounded-2xl font-black text-xs uppercase tracking-widest text-[var(--slate-dim)] hover:bg-[var(--surface)] transition-all"
            >
              Cancelar
            </button>
            <button
              onClick={confirmarIgnorar}
              className="flex-1 py-3 rounded-2xl font-black text-xs uppercase tracking-widest text-white bg-rose-500 hover:bg-rose-600 transition-all"
            >
              Ignorar
            </button>
          </div>
        }
      >
        <p className="p-4 text-xs text-[var(--slate-dim)] leading-relaxed">
          Este alerta deixará de aparecer na lista de pendentes. Podes voltar a vê-lo filtrando por "Ignorado".
        </p>
      </ModalShell>

      {toast && (
        <div className="fixed bottom-6 right-6 z-[9999] animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className={`px-6 py-4 rounded-2xl shadow-xl flex items-center gap-3 font-bold text-sm text-white ${
            toast.type === 'success' ? 'bg-emerald-600' : 'bg-rose-600'
          }`}>
            {toast.type === 'success' ? <CheckCircle2 size={20} className="shrink-0" /> : <XCircle size={20} className="shrink-0" />}
            {toast.text}
          </div>
        </div>
      )}
    </Card>
  );
}
