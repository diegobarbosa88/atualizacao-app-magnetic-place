import React, { useState, useEffect, useCallback } from 'react';
import { ArrowRightLeft, Plus, Loader2, RefreshCw, Download, CheckCircle, Trash2 } from 'lucide-react';
import NovoPagamentoModal from './NovoPagamentoModal';

const STATUS_BADGE = {
  pendente:                   'bg-amber-50 text-amber-700 border-amber-100',
  exportado:                  'bg-blue-50 text-blue-700 border-blue-100',
  enviado:                    'bg-indigo-50 text-indigo-700 border-indigo-100',
  iniciado_saltedge:          'bg-violet-50 text-violet-700 border-violet-100 animate-pulse',
  falhado_saltedge:           'bg-rose-50 text-rose-700 border-rose-100',
  confirmado:                 'bg-emerald-50 text-emerald-700 border-emerald-100',
  // Powens PIS
  iniciado_powens:            'bg-violet-50 text-violet-700 border-violet-100 animate-pulse',
  processando:                'bg-sky-50 text-sky-700 border-sky-100 animate-pulse',
  concluido:                  'bg-emerald-50 text-emerald-700 border-emerald-100',
  cancelado_pelo_utilizador:  'bg-slate-100 text-slate-500 border-slate-200',
  erro_banco:                 'bg-rose-50 text-rose-700 border-rose-100',
};

const STATUS_LABEL = {
  pendente:                   'Pendente',
  exportado:                  'Exportado',
  enviado:                    'Enviado',
  iniciado_saltedge:          'Iniciado (Salt Edge)',
  falhado_saltedge:           'Falhado (Salt Edge)',
  confirmado:                 'Confirmado',
  iniciado_powens:            'Iniciado (Powens)',
  processando:                'A processar',
  concluido:                  'Concluído',
  cancelado_pelo_utilizador:  'Cancelado',
  erro_banco:                 'Erro banco',
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
  const [iniciandoPowens, setIniciandoPowens] = useState(false);
  const [toastPowens, setToastPowens] = useState(null); // { tipo: 'sucesso'|'cancelado'|'erro', msg }

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro(null);
    try {
      const params = new URLSearchParams();
      if (filtroStatus) params.set('status', filtroStatus);
      const res = await fetch(`/api/pagamentos?action=listar&${params}`);
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

  // Tratar callback Powens (?powens=sucesso|cancelado|erro_banco|erro)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const powensParam = params.get('powens');
    if (!powensParam) return;
    window.history.replaceState({}, document.title, window.location.pathname);
    if (powensParam === 'sucesso') {
      setToastPowens({ tipo: 'sucesso', msg: 'Pagamento aprovado pelo banco. A aguardar liquidação.' });
      carregar();
    } else if (powensParam === 'cancelado') {
      setToastPowens({ tipo: 'cancelado', msg: 'Pagamento cancelado pelo utilizador.' });
    } else if (powensParam === 'erro_banco') {
      setToastPowens({ tipo: 'erro', msg: 'Erro técnico reportado pelo banco. Tente novamente.' });
    } else {
      setToastPowens({ tipo: 'erro', msg: `Resultado desconhecido: ${powensParam}` });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
      const res = await fetch('/api/pagamentos?action=exportar-sepa', {
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

  const handleIniciarPowens = async () => {
    const ids = [...selecionados];
    if (ids.length === 0) return;
    setIniciandoPowens(true);
    try {
      const res = await fetch('/api/powens/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ faturas_ids: ids }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Erro ao iniciar pagamento Powens');
      setSelecionados(new Set());
      if (d.redirect_url) {
        window.location.href = d.redirect_url;
      } else {
        await carregar();
      }
    } catch (e) {
      alert(e.message);
    } finally {
      setIniciandoPowens(false);
    }
  };

  const handleMarcarEnviado = async () => {
    const ids = [...selecionados];
    if (ids.length === 0) return;
    setMarcando(true);
    try {
      const res = await fetch('/api/pagamentos?action=marcar-enviado', {
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
      const res = await fetch(`/api/pagamentos?action=apagar&id=${id}`, { method: 'DELETE' });
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
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-violet-50 rounded-xl">
            <ArrowRightLeft size={16} className="text-violet-600" />
          </div>
          <span className="text-sm font-black text-slate-800">Pagamentos a Fornecedores</span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-600 focus:outline-none focus:ring-2 focus:ring-violet-300">
            <option value="">Todos os estados</option>
            <option value="pendente">Pendente</option>
            <option value="exportado">Exportado</option>
            <option value="enviado">Enviado</option>
            <option value="iniciado_saltedge">Iniciado (Salt Edge)</option>
            <option value="falhado_saltedge">Falhado (Salt Edge)</option>
            <option value="confirmado">Confirmado</option>
            <option value="iniciado_powens">Iniciado (Powens)</option>
            <option value="processando">A processar (Powens)</option>
            <option value="concluido">Concluído (Powens)</option>
            <option value="cancelado_pelo_utilizador">Cancelado</option>
            <option value="erro_banco">Erro banco</option>
          </select>
          <button onClick={carregar}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-black uppercase tracking-widest text-slate-500 hover:bg-slate-100 rounded-xl transition-all">
            <RefreshCw size={13} /> Atualizar
          </button>
          <button onClick={() => setMostrarModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-violet-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-violet-700 transition-all shadow-sm">
            <Plus size={13} /> Novo Pagamento
          </button>
        </div>
      </div>

      {/* Barra de ações em lote */}
      {selecionados.size > 0 && (
        <div className="px-5 py-3 bg-violet-50 border-b border-violet-100 flex items-center justify-between gap-3 flex-wrap">
          <span className="text-xs font-bold text-violet-700">
            {selecionados.size} selecionado{selecionados.size > 1 ? 's' : ''} — {fmt(totalSelecionado)}
          </span>
          <div className="flex items-center gap-2">
            <button onClick={handleIniciarPowens} disabled={iniciandoPowens}
              className="flex items-center gap-1.5 px-3 py-2 bg-gradient-to-r from-sky-600 to-indigo-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:from-sky-700 hover:to-indigo-700 transition-all disabled:opacity-60 shadow-sm">
              {iniciandoPowens ? <Loader2 size={12} className="animate-spin" /> : <ArrowRightLeft size={12} />}
              Pagar via Powens
            </button>
            <button onClick={handleIniciarSaltedge} disabled={iniciandoSaltedge}
              className="flex items-center gap-1.5 px-3 py-2 bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:from-violet-700 hover:to-indigo-700 transition-all disabled:opacity-60 shadow-sm">
              {iniciandoSaltedge ? <Loader2 size={12} className="animate-spin" /> : <ArrowRightLeft size={12} />}
              Pagar Banco (Salt Edge)
            </button>
            <button onClick={handleExportarSEPA} disabled={exportando}
              className="flex items-center gap-1.5 px-3 py-2 bg-violet-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-violet-700 transition-all disabled:opacity-60">
              {exportando ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
              Exportar SEPA XML
            </button>
            <button onClick={handleMarcarEnviado} disabled={marcando}
              className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-indigo-700 transition-all disabled:opacity-60">
              {marcando ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle size={12} />}
              Marcar Enviado
            </button>
          </div>
        </div>
      )}

      {toastPowens && (
        <div className={`mx-5 my-3 flex items-center justify-between gap-3 px-4 py-3 rounded-xl border text-xs font-semibold ${
          toastPowens.tipo === 'sucesso'   ? 'bg-emerald-50 border-emerald-100 text-emerald-700' :
          toastPowens.tipo === 'cancelado' ? 'bg-slate-50 border-slate-200 text-slate-500' :
                                             'bg-rose-50 border-rose-100 text-rose-600'
        }`}>
          <span>{toastPowens.msg}</span>
          <button onClick={() => setToastPowens(null)} className="shrink-0 opacity-60 hover:opacity-100 text-xs">✕</button>
        </div>
      )}

      {erro && (
        <div className="mx-5 my-3 bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-xs text-red-600 font-semibold">{erro}</div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12 text-slate-400">
          <Loader2 size={20} className="animate-spin" />
        </div>
      ) : pagamentos.length === 0 ? (
        <div className="px-5 py-12 text-center text-slate-400 text-xs font-semibold">
          Sem pagamentos — crie um novo para começar
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="px-4 py-3 w-8">
                  <input type="checkbox" checked={todosSelecionados} onChange={toggleTodos}
                    className="rounded accent-violet-600" />
                </th>
                {['Fornecedor', 'IBAN', 'Valor', 'Data', 'Referência', 'Estado', ''].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-slate-400 last:w-10">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {pagamentos.map(p => (
                <tr key={p.id} className={`hover:bg-slate-50 transition-colors ${selecionados.has(p.id) ? 'bg-violet-50/50' : ''}`}>
                  <td className="px-4 py-3">
                    {p.status === 'pendente' && (
                      <input type="checkbox" checked={selecionados.has(p.id)} onChange={() => toggleSelecionado(p.id)}
                        className="rounded accent-violet-600" />
                    )}
                  </td>
                  <td className="px-4 py-3 font-semibold text-slate-800">
                    <div>
                      <p>{p.fornecedor_nome}</p>
                      {p.fornecedor_nif && <p className="text-[10px] text-slate-400 font-normal">NIF {p.fornecedor_nif}</p>}
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono text-slate-500 text-[10px]">{p.fornecedor_iban}</td>
                  <td className="px-4 py-3 font-bold text-slate-800">{fmt(p.valor)}</td>
                  <td className="px-4 py-3 text-slate-500">
                    {new Date(p.data_pagamento).toLocaleDateString('pt-PT')}
                  </td>
                  <td className="px-4 py-3 text-slate-500 max-w-[140px] truncate">{p.referencia || '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase border ${STATUS_BADGE[p.status] || ''}`}>
                      {STATUS_LABEL[p.status] || p.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {p.status === 'pendente' && (
                      <button onClick={() => handleApagar(p.id)}
                        className="p-1.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all">
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
