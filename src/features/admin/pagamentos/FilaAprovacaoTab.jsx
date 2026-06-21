import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Loader2, RefreshCw, Download, Plus, X, ExternalLink, FileText, AlertTriangle, ListChecks } from 'lucide-react';
import ImpostoPdfUploadModal from './ImpostoPdfUploadModal';

function fmt(val) {
  return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(val ?? 0);
}

function maskIban(iban) {
  if (!iban || iban.length < 8) return iban || '—';
  return iban.slice(0, 4) + '••••••••' + iban.slice(-4);
}

function formatDate(d) {
  if (!d) return '—';
  const dt = new Date(d + 'T00:00:00');
  return dt.toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function urgencyClass(dateStr) {
  if (!dateStr) return '';
  const diff = (new Date(dateStr) - new Date()) / (1000 * 60 * 60 * 24);
  if (diff < 0) return 'text-red-600';
  if (diff <= 3) return 'text-orange-500';
  return 'text-slate-500';
}

const TAB_LABELS = { pendente: 'Pendentes', exportado: 'Exportados', rejeitado: 'Rejeitados' };

function RejeitarModal({ item, onConfirm, onClose }) {
  const [motivo, setMotivo] = useState('');
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
        <p className="text-sm font-black text-slate-800 mb-1">Rejeitar item</p>
        <p className="text-xs text-slate-500 mb-4 truncate">{item.label} — {fmt(item.valor)}</p>
        <textarea
          placeholder="Motivo (opcional)"
          value={motivo}
          onChange={e => setMotivo(e.target.value)}
          rows={3}
          className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-red-300 mb-4"
        />
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-xs font-black bg-slate-100 text-slate-600">Cancelar</button>
          <button
            onClick={() => onConfirm(motivo)}
            className="flex-1 py-2.5 rounded-xl text-xs font-black bg-red-600 text-white hover:bg-red-700"
          >
            Rejeitar
          </button>
        </div>
      </div>
    </div>
  );
}

export default function FilaAprovacaoTab() {
  const [fornecedores, setFornecedores] = useState([]);
  const [impostos, setImpostos] = useState([]);
  const [faturasGmail, setFaturasGmail] = useState([]);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');
  const [tab, setTab] = useState('pendente');
  const [selecionados, setSelecionados] = useState(new Set());
  const [exportando, setExportando] = useState(false);
  const [exportResult, setExportResult] = useState(null);
  const [rejeitarItem, setRejeitarItem] = useState(null);
  const [mostrarModalImposto, setMostrarModalImposto] = useState(false);
  const [ibanModal, setIbanModal] = useState(null);
  const [ibanInputVal, setIbanInputVal] = useState('');

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro('');
    try {
      const [rPag, rImp, rFat] = await Promise.all([
        fetch('/api/pagamentos?action=listar'),
        fetch('/api/pagamentos?action=listar-impostos'),
        fetch('/api/pagamentos?action=listar-faturas-fila'),
      ]);
      const [dPag, dImp, dFat] = await Promise.all([rPag.json(), rImp.json(), rFat.json()]);
      if (!rPag.ok) throw new Error(dPag.error || 'Erro fornecedores');
      if (!rImp.ok) throw new Error(dImp.error || 'Erro impostos');
      setFornecedores(dPag.data || []);
      setImpostos(dImp.data || []);
      setFaturasGmail(dFat.data || []);
      setSelecionados(new Set());
    } catch (e) {
      setErro(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  // Unified list for current tab
  const listaUnificada = useMemo(() => {
    const fItems = fornecedores
      .filter(p => {
        if (tab === 'pendente') return p.status === 'pendente';
        if (tab === 'exportado') return p.status === 'exportado' || p.status === 'enviado';
        return false; // fornecedores não têm "rejeitado"
      })
      .map(p => ({
        key: `f-${p.id}`,
        id: p.id,
        fonte: 'fornecedor',
        label: p.fornecedor_nome,
        subtipo: null,
        valor: p.valor,
        data_vencimento: p.data_pagamento,
        iban: p.fornecedor_iban,
        referencia: p.referencia,
        url: null,
        status: p.status,
      }));

    const iItems = impostos
      .filter(imp => imp.status === tab || (tab === 'exportado' && imp.status === 'exportado'))
      .map(imp => ({
        key: `i-${imp.id}`,
        id: imp.id,
        fonte: 'imposto',
        label: imp.tipo + (imp.periodo ? ` ${imp.periodo}` : ''),
        subtipo: imp.tipo,
        valor: imp.valor,
        data_vencimento: imp.data_vencimento,
        iban: imp.iban_destino,
        referencia: imp.referencia,
        url: imp.url,
        status: imp.status,
      }));

    const gItems = faturasGmail
      .filter(f => tab === 'pendente' ? f.status === 'PENDENTE' : f.status === 'PAGO')
      .map(f => ({
        key: `g-${f.id}`,
        id: f.id,
        fonte: 'fatura-gmail',
        label: f.dados?.fornecedor || f.filename || '—',
        subtipo: null,
        valor: f.dados?.valor_total,
        data_vencimento: f.dados?.prazo_pagamento || null,
        iban: f.dados?.iban,
        nif: f.dados?.nif_fornecedor || null,
        referencia: f.dados?.numero_fatura || null,
        url: f.url,
        status: f.status === 'PENDENTE' ? 'pendente' : 'exportado',
      }));

    return [...fItems, ...iItems, ...gItems].sort((a, b) => {
      if (!a.data_vencimento && !b.data_vencimento) return 0;
      if (!a.data_vencimento) return 1;
      if (!b.data_vencimento) return -1;
      return new Date(a.data_vencimento) - new Date(b.data_vencimento);
    });
  }, [fornecedores, impostos, faturasGmail, tab]);

  const pendenteCount = useMemo(() => {
    return fornecedores.filter(p => p.status === 'pendente').length +
           impostos.filter(i => i.status === 'pendente').length +
           faturasGmail.filter(f => f.status === 'PENDENTE').length;
  }, [fornecedores, impostos, faturasGmail]);

  const toggleItem = (key) => {
    setSelecionados(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleAll = () => {
    const pendentes = listaUnificada.filter(i => i.status === 'pendente');
    if (selecionados.size === pendentes.length) {
      setSelecionados(new Set());
    } else {
      setSelecionados(new Set(pendentes.map(i => i.key)));
    }
  };

  const totalSelecionado = useMemo(() => {
    return listaUnificada
      .filter(i => selecionados.has(i.key))
      .reduce((acc, i) => acc + Number(i.valor), 0);
  }, [listaUnificada, selecionados]);

  const handleExportar = async () => {
    const itens = listaUnificada.filter(i => selecionados.has(i.key));
    const pagamentos_ids = itens.filter(i => i.fonte === 'fornecedor').map(i => i.id);
    const impostos_ids = itens.filter(i => i.fonte === 'imposto').map(i => i.id);
    const faturas_gmail_ids = itens.filter(i => i.fonte === 'fatura-gmail').map(i => i.id);

    if (pagamentos_ids.length === 0 && impostos_ids.length === 0 && faturas_gmail_ids.length === 0) return;

    const semIban = itens.filter(i => i.fonte === 'fatura-gmail' && !i.iban);
    if (semIban.length > 0) {
      setExportResult({ erro: `${semIban.length} fatura(s) sem IBAN — adiciona o IBAN em Faturas antes de exportar.` });
      return;
    }

    setExportando(true);
    setExportResult(null);
    try {
      const res = await fetch('/api/pagamentos?action=gerar-sepa-lote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pagamentos_ids, impostos_ids, faturas_gmail_ids }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Erro ao gerar XML');
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `pagamentos_lote_${Date.now()}.xml`;
      a.click();
      URL.revokeObjectURL(url);

      setExportResult({ ok: true, count: itens.length, total: totalSelecionado });
      await carregar();
    } catch (e) {
      setExportResult({ erro: e.message });
    } finally {
      setExportando(false);
    }
  };

  const handleRejeitar = async (motivo) => {
    const item = rejeitarItem;
    setRejeitarItem(null);
    if (item.fonte === 'imposto') {
      await fetch('/api/pagamentos?action=rejeitar-imposto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: item.id, motivo }),
      });
    } else {
      // For fornecedor: keep as pendente (only impostos can be rejected in DB)
      // Remove from selection instead
      setSelecionados(prev => { const n = new Set(prev); n.delete(item.key); return n; });
      return;
    }
    await carregar();
  };

  const guardarIbanInline = async () => {
    if (!ibanModal || !ibanInputVal.trim()) return;
    const iban = ibanInputVal.replace(/\s/g, '').toUpperCase();
    const res = await fetch('/api/pagamentos?action=guardar-iban-fornecedor', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nif: ibanModal.nif, nome: ibanModal.nome, iban }),
    });
    if (!res.ok) { const d = await res.json(); alert(`Erro: ${d.error}`); return; }
    setIbanModal(null);
    carregar();
  };

  const handleImpostoSaved = (record) => {
    setImpostos(prev => [record, ...prev]);
    setMostrarModalImposto(false);
  };

  const pendentes = listaUnificada.filter(i => i.status === 'pendente');

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h4 className="text-sm font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
            <ListChecks size={16} className="text-violet-600" />
            Fila de Pagamentos
          </h4>
          <p className="text-[10px] font-semibold text-slate-400 mt-0.5">
            Faturas de fornecedores + impostos pendentes de pagamento
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setMostrarModalImposto(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[11px] font-black bg-orange-50 text-orange-700 hover:bg-orange-100 border border-orange-200 transition-all"
          >
            <Plus size={13} /> Importar Imposto
          </button>
          <button
            onClick={carregar}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-black bg-slate-100 text-slate-600 hover:bg-slate-200 transition-all disabled:opacity-60"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Atualizar
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-2xl w-fit">
        {Object.entries(TAB_LABELS).map(([key, label]) => {
          const count = key === 'pendente' ? pendenteCount
            : key === 'exportado' ? fornecedores.filter(p => p.status === 'exportado' || p.status === 'enviado').length + impostos.filter(i => i.status === 'exportado').length
            : impostos.filter(i => i.status === 'rejeitado').length;
          return (
            <button
              key={key}
              onClick={() => { setTab(key); setSelecionados(new Set()); }}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                tab === key ? 'bg-white text-violet-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              {label}
              {count > 0 && (
                <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full ${tab === key ? 'bg-violet-100 text-violet-700' : 'bg-slate-200 text-slate-500'}`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Export result */}
      {exportResult && (
        <div className={`px-4 py-3 rounded-xl text-[11px] font-bold border ${exportResult.erro ? 'bg-red-50 border-red-200 text-red-700' : 'bg-emerald-50 border-emerald-200 text-emerald-700'}`}>
          {exportResult.erro
            ? `Erro: ${exportResult.erro}`
            : `SEPA XML gerado com ${exportResult.count} pagamento${exportResult.count !== 1 ? 's' : ''} — Total: ${fmt(exportResult.total)}. Faça upload no portal NovoBanco.`
          }
        </div>
      )}

      {/* Erro */}
      {erro && (
        <div className="px-4 py-3 rounded-xl text-[11px] font-bold bg-red-50 border border-red-200 text-red-700">{erro}</div>
      )}

      {/* Action bar (only when pendentes selected) */}
      {tab === 'pendente' && pendentes.length > 0 && (
        <div className="flex items-center justify-between px-4 py-3 bg-slate-50 rounded-2xl border border-slate-100">
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={selecionados.size === pendentes.length && pendentes.length > 0}
              onChange={toggleAll}
              className="w-4 h-4 accent-violet-600 cursor-pointer"
            />
            <span className="text-[11px] font-black text-slate-600">
              {selecionados.size > 0
                ? `${selecionados.size} selecionado${selecionados.size !== 1 ? 's' : ''} — ${fmt(totalSelecionado)}`
                : `Selecionar todos (${pendentes.length})`
              }
            </span>
          </div>
          <button
            onClick={handleExportar}
            disabled={exportando || selecionados.size === 0}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[11px] font-black bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-40 transition-all shadow-sm"
          >
            {exportando ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
            {exportando ? 'A gerar...' : 'Gerar SEPA XML'}
          </button>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={24} className="animate-spin text-slate-300" />
        </div>
      )}

      {/* Empty */}
      {!loading && listaUnificada.length === 0 && (
        <div className="text-center py-12">
          <ListChecks size={32} className="text-slate-200 mx-auto mb-3" />
          <p className="text-sm font-black text-slate-400">
            {tab === 'pendente' ? 'Nenhum pagamento pendente' : tab === 'exportado' ? 'Nenhum exportado ainda' : 'Nenhum rejeitado'}
          </p>
          {tab === 'pendente' && (
            <p className="text-[11px] text-slate-300 mt-1">Faturas pendentes e impostos importados aparecem aqui.</p>
          )}
        </div>
      )}

      {/* List */}
      {!loading && listaUnificada.length > 0 && (
        <div className="border border-slate-100 rounded-2xl overflow-hidden divide-y divide-slate-50">
          {listaUnificada.map(item => {
            const isPendente = item.status === 'pendente';
            const isSel = selecionados.has(item.key);
            const dc = urgencyClass(item.data_vencimento);
            return (
              <div
                key={item.key}
                className={`flex items-center gap-3 px-4 py-3.5 transition-colors ${
                  isSel ? 'bg-violet-50/60' : 'hover:bg-slate-50/50'
                }`}
              >
                {/* Checkbox (pendente only) */}
                {isPendente ? (
                  <input
                    type="checkbox"
                    checked={isSel}
                    onChange={() => toggleItem(item.key)}
                    className="w-4 h-4 accent-violet-600 cursor-pointer shrink-0"
                  />
                ) : (
                  <div className="w-4 shrink-0" />
                )}

                {/* Type badge */}
                <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest shrink-0 ${
                  item.fonte === 'imposto'
                    ? 'bg-orange-100 text-orange-700'
                    : item.fonte === 'fatura-gmail'
                    ? 'bg-indigo-100 text-indigo-700'
                    : 'bg-blue-100 text-blue-700'
                }`}>
                  {item.fonte === 'imposto' ? (item.subtipo || 'Imp.') : item.fonte === 'fatura-gmail' ? 'Gmail' : 'Forn.'}
                </span>

                {/* Main info */}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-black text-slate-800 truncate">{item.label}</p>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    {item.referencia && (
                      <span className="text-[10px] text-slate-400 truncate">{item.referencia}</span>
                    )}
                    {item.iban
                      ? <span className="text-[10px] text-slate-300">{maskIban(item.iban)}</span>
                      : item.fonte === 'fatura-gmail' && item.nif
                        ? <button
                            onClick={() => { setIbanModal({ nif: item.nif, nome: item.label }); setIbanInputVal(''); }}
                            className="flex items-center gap-1 text-[10px] text-orange-400 font-bold hover:text-orange-600 underline underline-offset-2"
                          >
                            <AlertTriangle size={10} /> Sem IBAN — Definir
                          </button>
                        : <span className="flex items-center gap-1 text-[10px] text-orange-400 font-bold"><AlertTriangle size={10} /> Sem IBAN</span>
                    }
                  </div>
                </div>

                {/* Date */}
                <div className="shrink-0 text-right">
                  <span className={`text-[10px] font-bold ${dc}`}>{formatDate(item.data_vencimento)}</span>
                </div>

                {/* Amount */}
                <div className="shrink-0 text-right w-24">
                  <p className="text-sm font-black text-slate-800">{fmt(item.valor)}</p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0">
                  {item.url && (
                    <a href={item.url} target="_blank" rel="noopener noreferrer"
                      className="p-1.5 rounded-lg text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                      title="Ver PDF">
                      <FileText size={13} />
                    </a>
                  )}
                  {isPendente && (
                    <button
                      onClick={() => setRejeitarItem(item)}
                      className="p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                      title="Rejeitar"
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {rejeitarItem && (
        <RejeitarModal
          item={rejeitarItem}
          onConfirm={handleRejeitar}
          onClose={() => setRejeitarItem(null)}
        />
      )}

      {mostrarModalImposto && (
        <ImpostoPdfUploadModal
          onClose={() => setMostrarModalImposto(false)}
          onSaved={handleImpostoSaved}
        />
      )}

      {ibanModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" onClick={() => setIbanModal(null)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">IBAN do Fornecedor</p>
            <p className="text-sm font-bold text-slate-700 mb-4">{ibanModal.nome}</p>
            <input
              type="text"
              placeholder="PT50..."
              value={ibanInputVal}
              onChange={e => setIbanInputVal(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && guardarIbanInline()}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-300"
              autoFocus
            />
            {ibanModal.nif && (
              <p className="text-[10px] text-slate-400 mt-1">Aplicado a todas as faturas deste fornecedor (NIF: {ibanModal.nif})</p>
            )}
            <div className="flex gap-2 mt-4">
              <button
                onClick={guardarIbanInline}
                className="flex-1 py-2 text-xs font-black bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 uppercase tracking-widest"
              >
                Guardar
              </button>
              <button
                onClick={() => setIbanModal(null)}
                className="px-4 py-2 text-xs font-black bg-slate-100 text-slate-500 rounded-xl hover:bg-slate-200 uppercase tracking-widest"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
