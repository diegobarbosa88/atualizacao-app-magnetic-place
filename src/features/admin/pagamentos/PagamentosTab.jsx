import React, { useState, useEffect, useCallback } from 'react';
import { ArrowRightLeft, Plus, Loader2, RefreshCw, Download, CheckCircle, Trash2 } from 'lucide-react';
import NovoPagamentoModal from './NovoPagamentoModal';
import { authFetch } from '../../../utils/authFetch';
import { FT } from '../../../styles/designTokens';

const STATUS_BADGE = {
  pendente:           'bg-amber-50 text-amber-700 border-amber-100',
  exportado:          'bg-[var(--surface-dim)] text-[var(--ink-soft)] border-[var(--border)]',
  enviado:            'bg-teal-50 text-teal-700 border-teal-100',
  iniciado_saltedge:  'bg-amber-50 text-amber-700 border-amber-200 animate-pulse',
  falhado_saltedge:   'bg-rose-50 text-rose-700 border-rose-100',
  confirmado:         'bg-emerald-50 text-emerald-700 border-emerald-100',
};

const STATUS_LABEL = {
  pendente:           'Pendente',
  exportado:          'Exportado',
  enviado:            'Enviado',
  iniciado_saltedge:  'Iniciado (Salt Edge)',
  falhado_saltedge:   'Falhado (Salt Edge)',
  confirmado:         'Confirmado',
};

function fmt(val) {
  return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(val);
}

export default function PagamentosTab() {
  const [pagamentos, setPagamentos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState(null);
  const [filtroStatus, setFiltroStatus] = useState('');
  const [selecionados, setSelecionados] = useState(new Set());
  const [mostrarModal, setMostrarModal] = useState(false);
  const [exportando, setExportando] = useState(false);
  const [marcando, setMarcando] = useState(false);
  const [iniciandoSaltedge, setIniciandoSaltedge] = useState(false);

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro(null);
    try {
      const params = new URLSearchParams();
      if (filtroStatus) params.set('status', filtroStatus);
      const res = await authFetch(`/api/pagamentos?action=listar&${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Erro ${res.status}`);
      setPagamentos(data.data || []);
    } catch (e) {
      setErro(e.message);
    } finally {
      setLoading(false);
    }
  }, [filtroStatus]);

  useEffect(() => { carregar(); }, [carregar]);

  // Tratar callback Salt Edge (PIS e AIS)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('saltedge') !== 'callback') return;

    const paymentId = params.get('payment_id');
    const connectionId = params.get('connection_id');

    window.history.replaceState({}, document.title, window.location.pathname);
    setLoading(true);

    if (paymentId) {
      fetch(`/api/pagamentos?action=saltedge-verificar&paymentId=${paymentId}`)
        .then(r => r.json())
        .then(d => {
          if (d.ok) alert(d.message || `Pagamento verificado! Estado: ${d.status}`);
          else alert(`Erro ao verificar pagamento: ${d.error}`);
          carregar();
        })
        .catch(err => { alert(err.message); carregar(); })
        .finally(() => setLoading(false));
    } else if (connectionId) {
      fetch('/api/pagamentos?action=saltedge-save-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connection_id: connectionId }),
      })
        .then(r => r.json())
        .then(d => {
          if (d.ok) alert(d.message || 'Conta bancária Salt Edge ligada com sucesso!');
          else alert(`Erro ao ligar conta: ${d.error}`);
          carregar();
        })
        .catch(err => { alert(err.message); carregar(); })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [carregar]);

  const toggleSelecionado = (id) => {
    setSelecionados(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleTodos = () => {
    const pendentes = pagamentos.filter(p => p.status === 'pendente').map(p => p.id);
    if (pendentes.every(id => selecionados.has(id))) {
      setSelecionados(prev => { const n = new Set(prev); pendentes.forEach(id => n.delete(id)); return n; });
    } else {
      setSelecionados(prev => { const n = new Set(prev); pendentes.forEach(id => n.add(id)); return n; });
    }
  };

  const handleExportarSEPA = async () => {
    const ids = [...selecionados];
    if (ids.length === 0) return;
    setExportando(true);
    try {
      const res = await authFetch('/api/pagamentos?action=exportar-sepa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Erro ao exportar');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'pagamentos_fornecedores.xml';
      a.click();
      URL.revokeObjectURL(url);
      setSelecionados(new Set());
      await carregar();
    } catch (e) {
      alert(e.message);
    } finally {
      setExportando(false);
    }
  };

  const handleIniciarSaltedge = async () => {
    const ids = [...selecionados];
    if (ids.length === 0) return;
    setIniciandoSaltedge(true);
    try {
      const res = await fetch('/api/pagamentos?action=saltedge-iniciar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Erro ao iniciar pagamento com Salt Edge');
      setSelecionados(new Set());
      if (d.redirectUrl) {
        window.location.href = d.redirectUrl;
      } else {
        await carregar();
      }
    } catch (e) {
      alert(e.message);
    } finally {
      setIniciandoSaltedge(false);
    }
  };

  const handleMarcarEnviado = async () => {
    const ids = [...selecionados];
    if (ids.length === 0) return;
    setMarcando(true);
    try {
      const res = await authFetch('/api/pagamentos?action=marcar-enviado', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Erro');
      setSelecionados(new Set());
      await carregar();
    } catch (e) {
      alert(e.message);
    } finally {
      setMarcando(false);
    }
  };

  const handleApagar = async (id) => {
    if (!confirm('Apagar este pagamento pendente?')) return;
    try {
      const res = await authFetch(`/api/pagamentos?action=apagar&id=${id}`, { method: 'DELETE' });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Erro ao apagar');
      setPagamentos(prev => prev.filter(p => p.id !== id));
      setSelecionados(prev => { const n = new Set(prev); n.delete(id); return n; });
    } catch (e) {
      alert(e.message);
    }
  };

  const pendentesIds = pagamentos.filter(p => p.status === 'pendente').map(p => p.id);
  const todosSelecionados = pendentesIds.length > 0 && pendentesIds.every(id => selecionados.has(id));
  const totalSelecionado = pagamentos
    .filter(p => selecionados.has(p.id))
    .reduce((acc, p) => acc + Number(p.valor), 0);

  return (
    <div className="bg-white rounded-2xl border border-[var(--border)] shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-[var(--border-soft)] flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl" style={{ backgroundColor: 'rgba(134,154,175,0.15)' }}>
            <ArrowRightLeft size={16} style={{ color: FT.slate }} />
          </div>
          <span className="text-sm font-black text-[var(--ink)]">Pagamentos a Fornecedores</span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)}
            className="px-3 py-2 rounded-xl border border-[var(--border)] text-xs text-[var(--ink-soft)] focus:outline-none focus:ring-2 focus:ring-[#1B3A57]/30">
            <option value="">Todos os estados</option>
            <option value="pendente">Pendente</option>
            <option value="exportado">Exportado</option>
            <option value="enviado">Enviado</option>
            <option value="iniciado_saltedge">Iniciado (Salt Edge)</option>
            <option value="falhado_saltedge">Falhado (Salt Edge)</option>
            <option value="confirmado">Confirmado</option>
          </select>
          <button onClick={carregar}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-black uppercase tracking-widest text-[var(--ink-soft)] hover:bg-[var(--surface-dim)] rounded-xl transition-all">
            <RefreshCw size={13} /> Atualizar
          </button>
          <button onClick={() => setMostrarModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-sm hover:opacity-90"
            style={{ backgroundColor: FT.orange, color: FT.navy }}>
            <Plus size={13} /> Novo Pagamento
          </button>
        </div>
      </div>

      {/* Barra de ações em lote */}
      {selecionados.size > 0 && (
        <div className="px-5 py-3 bg-[var(--surface)] border-b border-[var(--border)] flex items-center justify-between gap-3 flex-wrap">
          <span className="text-xs font-bold" style={{ color: 'var(--navy)' }}>
            {selecionados.size} selecionado{selecionados.size > 1 ? 's' : ''} — {fmt(totalSelecionado)}
          </span>
          <div className="flex items-center gap-2">
            <button onClick={handleIniciarSaltedge} disabled={iniciandoSaltedge}
              className="flex items-center gap-1.5 px-3 py-2 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all disabled:opacity-60 shadow-sm hover:opacity-90"
              style={{ backgroundColor: FT.navy }}>
              {iniciandoSaltedge ? <Loader2 size={12} className="animate-spin" /> : <ArrowRightLeft size={12} />}
              Pagar Banco (Salt Edge)
            </button>
            <button onClick={handleExportarSEPA} disabled={exportando}
              className="flex items-center gap-1.5 px-3 py-2 border rounded-xl text-xs font-black uppercase tracking-widest transition-all disabled:opacity-60 hover:bg-[var(--surface-dim)]"
              style={{ borderColor: FT.slate, color: 'var(--ink-soft)' }}>
              {exportando ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
              Exportar SEPA XML
            </button>
            <button onClick={handleMarcarEnviado} disabled={marcando}
              className="flex items-center gap-1.5 px-3 py-2 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all disabled:opacity-60 hover:opacity-90"
              style={{ backgroundColor: FT.navy }}>
              {marcando ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle size={12} />}
              Marcar Enviado
            </button>
          </div>
        </div>
      )}

      {erro && (
        <div className="mx-5 my-3 bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-xs text-red-600 font-semibold">{erro}</div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12 text-[var(--slate-dim)]">
          <Loader2 size={20} className="animate-spin" />
        </div>
      ) : pagamentos.length === 0 ? (
        <div className="px-5 py-12 text-center text-[var(--slate-dim)] text-xs font-semibold">
          Sem pagamentos — crie um novo para começar
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-[var(--surface)] border-b border-[var(--border-soft)]">
                <th className="px-4 py-3 w-8">
                  <input type="checkbox" checked={todosSelecionados} onChange={toggleTodos}
                    className="rounded accent-[var(--navy)]" />
                </th>
                {['Fornecedor', 'IBAN', 'Valor', 'Data', 'Referência', 'Estado', ''].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-[var(--slate-dim)] last:w-10">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-soft)]">
              {pagamentos.map(p => (
                <tr key={p.id} className="hover:bg-[var(--surface)] transition-colors" style={selecionados.has(p.id) ? { backgroundColor: 'rgba(235,141,0,0.08)' } : {}}>
                  <td className="px-4 py-3">
                    {p.status === 'pendente' && (
                      <input type="checkbox" checked={selecionados.has(p.id)} onChange={() => toggleSelecionado(p.id)}
                        className="rounded accent-[var(--navy)]" />
                    )}
                  </td>
                  <td className="px-4 py-3 font-semibold text-[var(--ink)]">
                    <div>
                      <p>{p.fornecedor_nome}</p>
                      {p.fornecedor_nif && <p className="text-[10px] text-[var(--slate-dim)] font-normal">NIF {p.fornecedor_nif}</p>}
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono text-[var(--slate-dim)] text-[10px]">{p.fornecedor_iban}</td>
                  <td className="px-4 py-3 font-bold text-[var(--ink)]">{fmt(p.valor)}</td>
                  <td className="px-4 py-3 text-[var(--slate-dim)]">
                    {new Date(p.data_pagamento).toLocaleDateString('pt-PT')}
                  </td>
                  <td className="px-4 py-3 text-[var(--slate-dim)] max-w-[140px] truncate">{p.referencia || '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase border ${STATUS_BADGE[p.status] || ''}`}>
                      {STATUS_LABEL[p.status] || p.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {p.status === 'pendente' && (
                      <button onClick={() => handleApagar(p.id)}
                        className="p-1.5 text-[var(--slate)] hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all">
                        <Trash2 size={13} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {mostrarModal && (
        <NovoPagamentoModal
          onClose={() => setMostrarModal(false)}
          onCriado={novo => { setPagamentos(prev => [novo, ...prev]); }}
        />
      )}
    </div>
  );
}
