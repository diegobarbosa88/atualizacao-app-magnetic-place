import React, { useState, useEffect, useMemo } from 'react';
import { CheckCircle2, Clock, BellOff, ChevronLeft, ChevronRight } from 'lucide-react';
import { useApp } from '../../../context/AppContext';
import { FT, SCALE } from '../../../styles/designTokens';
import { calculateDuration } from '../../../utils/formatUtils';

function shiftMonth(monthStr, delta) {
  const [y, m] = monthStr.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(monthStr) {
  const [y, m] = monthStr.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' });
}

// Mesmas iniciais de empresa usadas em ClientManager.jsx (primeiras 2
// palavras, não a última — que é quase sempre um sufixo legal tipo "S.L.").
function companyInitials(name) {
  if (!name) return '?';
  const clean = name.replace(/[,.&]/g, ' ').trim().split(/\s+/).filter(Boolean);
  if (!clean.length) return '?';
  return (clean[0][0] + (clean[1] ? clean[1][0] : clean[0][1] || '')).toUpperCase();
}

export default function ValidacaoMensalPanel() {
  const { clients, clientApprovals, supabase } = useApp();
  const [month, setMonth] = useState(() => shiftMonth(new Date().toISOString().slice(0, 7), -1));
  const [waivers, setWaivers] = useState([]);
  const [logsDoMes, setLogsDoMes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingId, setLoadingId] = useState(null);

  // Consulta direta ao Supabase, sempre limitada ao mês selecionado — a `logs`
  // partilhada por toda a app (AppContext.jsx) carrega só desde o ano passado
  // e sem paginar, por isso corta silenciosamente ao fim de ~1000 linhas (há
  // 1627 só desde 2025-01-01); um mês mais antigo pode ficar parcialmente de
  // fora dessa cache. Aqui teria dado clientes reais como "sem horas" em vez
  // de "pendente" — confirmado ao vivo com Maio/2026 (2 clientes desaparecidos
  // da lista antes desta correção). A mesma consulta scoped que o cron usa.
  useEffect(() => {
    if (!supabase) return;
    let cancelled = false;
    setLoading(true);
    const inicio = `${month}-01`;
    const [y, m] = month.split('-').map(Number);
    const fimExclusive = new Date(y, m, 1).toISOString().slice(0, 10);
    Promise.all([
      supabase.from('logs').select('clientId, startTime, endTime, breakStart, breakEnd, hours').gte('date', inicio).lt('date', fimExclusive),
      supabase.from('client_month_waivers').select('*').eq('month', month),
    ]).then(([logsRes, waiversRes]) => {
      if (cancelled) return;
      setLogsDoMes(logsRes.data || []);
      setWaivers(waiversRes.data || []);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [month, supabase]);

  const rows = useMemo(() => {
    const horasPorCliente = new Map();
    for (const l of logsDoMes) {
      const h = l.hours ?? calculateDuration(l.startTime, l.endTime, l.breakStart, l.breakEnd);
      if (h <= 0) continue;
      const id = String(l.clientId);
      horasPorCliente.set(id, (horasPorCliente.get(id) || 0) + h);
    }

    const aprovadosPorCliente = new Map(
      (clientApprovals || []).filter(a => a.month === month).map(a => [String(a.client_id), a])
    );
    const dispensadosPorCliente = new Map(
      waivers.map(w => [String(w.client_id), w])
    );

    return [...horasPorCliente.entries()]
      .map(([clientId, totalHoras]) => {
        const client = clients.find(c => String(c.id) === clientId);
        const aprovacao = aprovadosPorCliente.get(clientId);
        const dispensa = dispensadosPorCliente.get(clientId);
        const status = aprovacao ? 'aprovado' : dispensa ? 'dispensado' : 'pendente';
        return { clientId, clientName: client?.name || 'Cliente removido', totalHoras, status, aprovacao, dispensa };
      })
      .sort((a, b) => {
        const ordem = { pendente: 0, dispensado: 1, aprovado: 2 };
        return ordem[a.status] - ordem[b.status] || a.clientName.localeCompare(b.clientName);
      });
  }, [logsDoMes, clients, clientApprovals, waivers, month]);

  const pendentes = rows.filter(r => r.status === 'pendente').length;

  const handleDispensar = async (row) => {
    setLoadingId(row.clientId);
    try {
      const id = `waiver_${row.clientId}_${month}`;
      const { error } = await supabase.from('client_month_waivers').insert({
        id, client_id: row.clientId, month, waived_by: 'admin', note: null,
      });
      if (error) throw error;
      setWaivers(prev => [...prev, { id, client_id: row.clientId, month, waived_by: 'admin' }]);
    } catch (err) {
      alert('Erro ao dispensar: ' + err.message);
    } finally {
      setLoadingId(null);
    }
  };

  const handleRemoverDispensa = async (row) => {
    setLoadingId(row.clientId);
    try {
      const { error } = await supabase.from('client_month_waivers').delete().eq('id', row.dispensa.id);
      if (error) throw error;
      setWaivers(prev => prev.filter(w => w.id !== row.dispensa.id));
    } catch (err) {
      alert('Erro ao remover dispensa: ' + err.message);
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 bg-[var(--panel)] border border-[var(--border)] rounded-2xl px-4 py-3">
        <div className="flex items-center gap-2">
          <button onClick={() => setMonth(m => shiftMonth(m, -1))} className="p-1.5 rounded-lg hover:bg-[var(--surface)] text-[var(--slate)] transition-all">
            <ChevronLeft size={16} />
          </button>
          <span className="text-sm font-black text-[var(--ink)] uppercase tracking-tight min-w-[160px] text-center">{monthLabel(month)}</span>
          <button onClick={() => setMonth(m => shiftMonth(m, 1))} className="p-1.5 rounded-lg hover:bg-[var(--surface)] text-[var(--slate)] transition-all">
            <ChevronRight size={16} />
          </button>
        </div>
        <p className={`${SCALE.text.statLabel} text-[var(--slate-dim)]`}>
          {pendentes > 0 ? `${pendentes} por validar` : 'Tudo aprovado ou dispensado'}
        </p>
      </div>

      <div className="bg-[var(--panel)] border border-[var(--border)] rounded-2xl overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-[var(--slate)] text-sm font-bold">A carregar…</div>
        ) : rows.length === 0 ? (
          <div className="p-10 text-center text-[var(--slate)] text-sm font-bold">Sem horas registadas neste mês.</div>
        ) : (
          <div className="divide-y divide-[var(--border-soft)]">
            {rows.map(row => (
              <div key={row.clientId} className="flex items-center gap-3 px-4 py-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-[10px] font-black" style={{ backgroundColor: FT.navy, color: FT.orange }}>
                  {companyInitials(row.clientName)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-black text-[var(--ink)] truncate">{row.clientName}</p>
                  <p className={`${SCALE.text.statLabel} text-[var(--slate-dim)]`}>{row.totalHoras.toFixed(1)}h registadas</p>
                </div>

                {row.status === 'aprovado' && (
                  <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[var(--ok-bg)] text-[var(--ok)] ${SCALE.text.badge}`}>
                    <CheckCircle2 size={13} /> Aprovado pelo cliente
                  </span>
                )}
                {row.status === 'dispensado' && (
                  <>
                    <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[var(--surface-dim)] text-[var(--ink-soft)] ${SCALE.text.badge}`}>
                      <BellOff size={13} /> Dispensado
                    </span>
                    <button
                      onClick={() => handleRemoverDispensa(row)}
                      disabled={loadingId === row.clientId}
                      className={`px-3 py-1.5 rounded-lg border border-[var(--border)] text-[var(--slate-dim)] hover:bg-[var(--surface)] transition-all disabled:opacity-50 ${SCALE.text.badge}`}
                    >
                      Remover
                    </button>
                  </>
                )}
                {row.status === 'pendente' && (
                  <>
                    <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[var(--tone-amber-bg)] text-[var(--tone-amber)] ${SCALE.text.badge}`}>
                      <Clock size={13} /> Pendente
                    </span>
                    <button
                      onClick={() => handleDispensar(row)}
                      disabled={loadingId === row.clientId}
                      title="O cliente não vai ser lembrado deste mês — não substitui a assinatura dele, só evita o lembrete automático."
                      className={`px-3 py-1.5 rounded-lg bg-[var(--navy)] text-white hover:opacity-90 transition-all disabled:opacity-50 ${SCALE.text.badge}`}
                    >
                      {loadingId === row.clientId ? '…' : 'Dispensar'}
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <p className={`${SCALE.text.meta} text-[var(--slate)] px-1`}>
        "Dispensar" só evita o lembrete automático de validação para este mês — não é uma assinatura do cliente, nem substitui a aprovação real dele no portal.
      </p>
    </div>
  );
}
