import React, { useState, useEffect, useMemo } from 'react';
import { X, Loader2, ChevronRight, CheckCircle, AlertCircle, FileText } from 'lucide-react';
import { useApp } from '../../../context/AppContext';

const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

function periodoLabel(mes) {
  if (!mes) return '';
  const [y, m] = mes.split('-');
  return `${MESES[parseInt(m, 10) - 1]} ${y}`;
}

function periodoDefault() {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export default function FaturarClienteModal({ onClose, onFaturado }) {
  const { clients, logs, supabase } = useApp();

  const [passo, setPasso] = useState(1); // 1=seleção, 2=revisão, 3=resultado
  const [clienteId, setClienteId] = useState('');
  const [periodo, setPeriodo] = useState(periodoDefault);
  const [ajudas, setAjudas] = useState(null);
  const [carregandoAjudas, setCarregandoAjudas] = useState(false);
  const [taxaIva, setTaxaIva] = useState(23);
  const [taxaIvaAjudas, setTaxaIvaAjudas] = useState(0);
  const [descricaoServico, setDescricaoServico] = useState('');
  const [emitindo, setEmitindo] = useState(false);
  const [resultado, setResultado] = useState(null);

  const cliente = useMemo(() => clients?.find(c => c.id === clienteId), [clients, clienteId]);

  // Calcular horas do período para este cliente
  const totalHoras = useMemo(() => {
    if (!clienteId || !periodo || !logs) return 0;
    return (logs || [])
      .filter(l => l.clientId === clienteId && (l.date || '').startsWith(periodo))
      .reduce((sum, l) => sum + (Number(l.hours) || 0), 0);
  }, [clienteId, periodo, logs]);

  const valorHora = Number(cliente?.valorHora ?? 0);
  const subtotalServicos = totalHoras * valorHora;
  const valorAjudas = ajudas?.valor_ajudas ?? 0;
  const baseIvaServicos = subtotalServicos;
  const baseIvaAjudas = valorAjudas;
  const ivaServicos = baseIvaServicos * taxaIva / 100;
  const ivaAjudas = baseIvaAjudas * taxaIvaAjudas / 100;
  const totalFatura = subtotalServicos + valorAjudas + ivaServicos + ivaAjudas;

  // Carregar ajudas faturadas ao selecionar cliente/período
  useEffect(() => {
    if (!clienteId || !periodo || !supabase) { setAjudas(null); return; }
    setCarregandoAjudas(true);
    supabase
      .from('ajudas_faturadas_clientes')
      .select('valor_ajudas, confirmado')
      .eq('client_id', clienteId)
      .eq('mes', periodo)
      .maybeSingle()
      .then(({ data }) => setAjudas(data))
      .catch(() => setAjudas(null))
      .finally(() => setCarregandoAjudas(false));
  }, [clienteId, periodo, supabase]);

  // Pré-preencher descrição quando cliente/período mudam
  useEffect(() => {
    if (cliente && periodo) {
      setDescricaoServico(`Serviços de gestão de pessoal — ${periodoLabel(periodo)}`);
    }
  }, [cliente, periodo]);

  const podeContinuar = clienteId && periodo && (totalHoras > 0 || valorAjudas > 0);

  const handleEmitir = async () => {
    setEmitindo(true);
    try {
      const linhas = [];

      if (totalHoras > 0) {
        linhas.push({
          descricao: descricaoServico || `Serviços — ${periodoLabel(periodo)}`,
          quantidade: Number(totalHoras.toFixed(2)),
          preco_unitario: Number(valorHora),
          taxa_iva: taxaIva,
        });
      }

      if (valorAjudas > 0) {
        linhas.push({
          descricao: `Ajudas de custo — ${periodoLabel(periodo)}`,
          quantidade: 1,
          preco_unitario: Number(valorAjudas),
          taxa_iva: taxaIvaAjudas,
        });
      }

      const res = await fetch('/api/toconline/create-fatura', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo_documento: 'FT',
          data: new Date().toISOString().slice(0, 10),
          cliente: { nome: cliente.name, nif: cliente.nif || undefined },
          linhas,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao emitir fatura');

      setResultado({ sucesso: true, doc_id: data.doc_id, documento: data.documento });
      setPasso(3);
      onFaturado?.();
    } catch (e) {
      setResultado({ sucesso: false, erro: e.message });
      setPasso(3);
    } finally {
      setEmitindo(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg p-6 space-y-5">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-black uppercase tracking-widest text-slate-700">Faturar Cliente</h2>
            <p className="text-[10px] text-slate-400 mt-0.5">
              {passo === 1 ? 'Passo 1 — Selecionar cliente e período' :
               passo === 2 ? 'Passo 2 — Rever e confirmar' :
               'Concluído'}
            </p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all">
            <X size={16} />
          </button>
        </div>

        {/* Passo 1 — Seleção */}
        {passo === 1 && (
          <div className="space-y-4">
            <div className="space-y-1">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Cliente *</p>
              <select value={clienteId} onChange={e => setClienteId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-300">
                <option value="">Selecionar cliente...</option>
                {(clients || []).filter(c => c.valorHora > 0).map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Período *</p>
              <input type="month" value={periodo} onChange={e => setPeriodo(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>

            {clienteId && periodo && (
              <div className="bg-slate-50 rounded-2xl p-4 space-y-2 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>Horas registadas no período</span>
                  <span className="font-black text-slate-800">{totalHoras.toFixed(2)} h</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Tarifa horária</span>
                  <span className="font-black text-slate-800">{Number(valorHora).toFixed(2)} €/h</span>
                </div>
                {carregandoAjudas ? (
                  <div className="flex items-center gap-2 text-slate-400"><Loader2 size={12} className="animate-spin" /> A carregar ajudas...</div>
                ) : valorAjudas > 0 && (
                  <div className="flex justify-between text-slate-600">
                    <span>Ajudas de custo faturadas</span>
                    <span className="font-black text-slate-800">{valorAjudas.toFixed(2)} €</span>
                  </div>
                )}
                {!podeContinuar && clienteId && periodo && !carregandoAjudas && (
                  <p className="text-amber-600 flex items-center gap-1">
                    <AlertCircle size={12} /> Sem horas nem ajudas registadas neste período
                  </p>
                )}
              </div>
            )}

            <button onClick={() => setPasso(2)} disabled={!podeContinuar}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-blue-700 transition-all disabled:opacity-50 shadow-md shadow-blue-100">
              Continuar <ChevronRight size={14} />
            </button>
          </div>
        )}

        {/* Passo 2 — Revisão */}
        {passo === 2 && (
          <div className="space-y-4">
            <div className="space-y-1">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Descrição do serviço</p>
              <input type="text" value={descricaoServico} onChange={e => setDescricaoServico(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>

            {/* Linhas da fatura */}
            <div className="rounded-2xl border border-slate-100 overflow-hidden">
              <div className="bg-slate-50 px-4 py-2 grid grid-cols-[1fr_60px_70px_50px_70px] gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
                <span>Descrição</span><span className="text-center">Qtd</span><span className="text-right">Unit.</span><span className="text-center">IVA</span><span className="text-right">Total</span>
              </div>

              {totalHoras > 0 && (
                <div className="px-4 py-3 grid grid-cols-[1fr_60px_70px_50px_70px] gap-2 text-xs items-center border-t border-slate-50">
                  <span className="text-slate-700 font-semibold truncate">{descricaoServico || 'Serviços'}</span>
                  <span className="text-center text-slate-500">{totalHoras.toFixed(2)}h</span>
                  <span className="text-right text-slate-500">{valorHora.toFixed(2)} €</span>
                  <div className="flex justify-center">
                    <select value={taxaIva} onChange={e => setTaxaIva(Number(e.target.value))}
                      className="w-full px-1 py-1 rounded-lg border border-slate-200 text-[10px] text-center focus:outline-none focus:ring-1 focus:ring-blue-300">
                      {[0, 6, 13, 23].map(v => <option key={v} value={v}>{v}%</option>)}
                    </select>
                  </div>
                  <span className="text-right font-semibold text-slate-800">{(subtotalServicos * (1 + taxaIva / 100)).toFixed(2)} €</span>
                </div>
              )}

              {valorAjudas > 0 && (
                <div className="px-4 py-3 grid grid-cols-[1fr_60px_70px_50px_70px] gap-2 text-xs items-center border-t border-slate-50">
                  <span className="text-slate-700 font-semibold truncate">Ajudas de custo</span>
                  <span className="text-center text-slate-500">1</span>
                  <span className="text-right text-slate-500">{valorAjudas.toFixed(2)} €</span>
                  <div className="flex justify-center">
                    <select value={taxaIvaAjudas} onChange={e => setTaxaIvaAjudas(Number(e.target.value))}
                      className="w-full px-1 py-1 rounded-lg border border-slate-200 text-[10px] text-center focus:outline-none focus:ring-1 focus:ring-blue-300">
                      {[0, 6, 13, 23].map(v => <option key={v} value={v}>{v}%</option>)}
                    </select>
                  </div>
                  <span className="text-right font-semibold text-slate-800">{(valorAjudas * (1 + taxaIvaAjudas / 100)).toFixed(2)} €</span>
                </div>
              )}

              <div className="px-4 py-3 border-t border-slate-200 flex justify-between items-center bg-slate-50">
                <span className="text-xs font-black uppercase tracking-widest text-slate-500">Total c/ IVA</span>
                <span className="text-base font-black text-slate-900">{totalFatura.toFixed(2)} €</span>
              </div>
            </div>

            <div className="bg-blue-50 rounded-2xl px-4 py-3 text-xs text-blue-700 space-y-0.5">
              <p className="font-black">Cliente: {cliente?.name}</p>
              {cliente?.nif && <p className="text-blue-600">NIF: {cliente.nif}</p>}
              <p className="text-blue-600">Período: {periodoLabel(periodo)}</p>
            </div>

            <div className="flex gap-2">
              <button onClick={() => setPasso(1)}
                className="flex-1 px-4 py-2.5 text-xs font-black uppercase tracking-widest text-slate-500 hover:bg-slate-100 rounded-xl transition-all">
                Voltar
              </button>
              <button onClick={handleEmitir} disabled={emitindo}
                className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 bg-blue-600 text-white text-xs font-black uppercase tracking-widest rounded-xl hover:bg-blue-700 transition-all disabled:opacity-60 shadow-md shadow-blue-100">
                {emitindo ? <Loader2 size={13} className="animate-spin" /> : <FileText size={13} />}
                Emitir Fatura
              </button>
            </div>
          </div>
        )}

        {/* Passo 3 — Resultado */}
        {passo === 3 && resultado && (
          <div className="space-y-4 py-2">
            {resultado.sucesso ? (
              <div className="text-center space-y-3">
                <CheckCircle size={40} className="mx-auto text-emerald-500" />
                <div>
                  <p className="text-sm font-black text-slate-800">Fatura emitida com sucesso</p>
                  {resultado.documento?.attributes?.document_number && (
                    <p className="text-xs text-slate-500 mt-1">
                      Nº {resultado.documento.attributes.document_number}
                    </p>
                  )}
                  <p className="text-xs text-slate-400 mt-0.5">
                    Cliente: {cliente?.name} · {periodoLabel(periodo)}
                  </p>
                  <p className="text-sm font-black text-emerald-700 mt-2">{totalFatura.toFixed(2)} €</p>
                </div>
              </div>
            ) : (
              <div className="text-center space-y-3">
                <AlertCircle size={40} className="mx-auto text-red-400" />
                <div>
                  <p className="text-sm font-black text-slate-800">Erro ao emitir fatura</p>
                  <p className="text-xs text-red-600 mt-1">{resultado.erro}</p>
                </div>
                <button onClick={() => { setPasso(2); setResultado(null); }}
                  className="px-4 py-2 text-xs font-black uppercase tracking-widest text-blue-600 hover:bg-blue-50 rounded-xl transition-all">
                  Tentar novamente
                </button>
              </div>
            )}
            <button onClick={onClose}
              className="w-full px-4 py-2.5 text-xs font-black uppercase tracking-widest text-slate-500 hover:bg-slate-100 rounded-xl transition-all">
              Fechar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
