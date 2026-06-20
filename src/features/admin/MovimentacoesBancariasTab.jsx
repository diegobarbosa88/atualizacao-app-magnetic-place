import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { Loader2, RefreshCw, ExternalLink, Landmark, Filter, ChevronDown, ChevronUp } from 'lucide-react';

const MESES_PT = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

function formatDatePT(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatValor(valor) {
  if (valor == null) return '—';
  return Number(valor).toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}

function monthKey(dateStr) {
  if (!dateStr) return 'sem-data';
  return dateStr.substring(0, 7);
}

function monthLabel(key) {
  if (key === 'sem-data') return 'Sem data';
  const [y, m] = key.split('-');
  return `${MESES_PT[parseInt(m, 10) - 1]} ${y}`;
}

export default function MovimentacoesBancariasTab() {
  const { supabase } = useApp();
  const [movs, setMovs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState(null);
  const [importando, setImportando] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [filtroMes, setFiltroMes] = useState('');
  const [collapsedMonths, setCollapsedMonths] = useState(new Set());

  const carregarMovs = async () => {
    if (!supabase) return;
    setLoading(true);
    setErro(null);
    try {
      const { data, error } = await supabase
        .from('faturas_centro_documentos')
        .select('*')
        .order('data_documento', { ascending: false });
      if (error) throw error;
      setMovs(data || []);
    } catch (e) {
      setErro(e.message || 'Erro ao carregar movimentações.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { carregarMovs(); }, [supabase]);

  const handleImportar = async () => {
    setImportando(true);
    setImportResult(null);
    try {
      const res = await fetch('/api/gmail/import-faturas', {
        method: 'POST',
        headers: {
          'x-import-secret': import.meta.env.VITE_GMAIL_IMPORT_SECRET || '',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ mode: 'comprovativos' }),
      });
      const data = await res.json();
      setImportResult(data);
      if (!data.error) await carregarMovs();
    } catch (e) {
      setImportResult({ error: e.message });
    } finally {
      setImportando(false);
    }
  };

  const mesesDisponiveis = useMemo(() => {
    const set = new Set(movs.map(m => monthKey(m.data_documento)));
    return [...set].sort().reverse();
  }, [movs]);

  const movsFiltered = useMemo(() => {
    if (!filtroMes) return movs;
    return movs.filter(m => monthKey(m.data_documento) === filtroMes);
  }, [movs, filtroMes]);

  const groupedByMonth = useMemo(() => {
    const groups = {};
    movsFiltered.forEach(m => {
      const key = monthKey(m.data_documento);
      if (!groups[key]) groups[key] = [];
      groups[key].push(m);
    });
    return Object.entries(groups).sort(([a], [b]) => b.localeCompare(a));
  }, [movsFiltered]);

  const totalGeral = useMemo(() => movsFiltered.reduce((acc, m) => acc + Number(m.valor || 0), 0), [movsFiltered]);

  const toggleMonth = (key) => {
    setCollapsedMonths(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <div className="space-y-5">
      {/* Header / actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h4 className="text-sm font-black text-slate-800 uppercase tracking-tight">Movimentações Bancárias</h4>
          <p className="text-[10px] font-semibold text-slate-400 mt-0.5">Comprovativos importados do NovoBanco via email</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Filter size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <select
              value={filtroMes}
              onChange={e => setFiltroMes(e.target.value)}
              className="pl-8 pr-3 py-2 text-[11px] font-bold border border-slate-200 rounded-xl bg-white text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-300"
            >
              <option value="">Todos os meses</option>
              {mesesDisponiveis.map(m => (
                <option key={m} value={m}>{monthLabel(m)}</option>
              ))}
            </select>
          </div>

          <button
            onClick={carregarMovs}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-black bg-slate-100 text-slate-600 hover:bg-slate-200 transition-all disabled:opacity-60"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Atualizar
          </button>

          <button
            onClick={handleImportar}
            disabled={importando}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[11px] font-black bg-indigo-600 text-white hover:bg-indigo-700 transition-all shadow-sm disabled:opacity-60"
          >
            <Landmark size={13} className={importando ? 'animate-pulse' : ''} />
            {importando ? 'Importando...' : 'Importar do Gmail'}
          </button>
        </div>
      </div>

      {/* Import result */}
      {importResult && (
        <div className={`px-4 py-3 rounded-xl text-[11px] font-bold border ${importResult.error ? 'bg-red-50 border-red-200 text-red-700' : 'bg-emerald-50 border-emerald-200 text-emerald-700'}`}>
          {importResult.error
            ? `Erro: ${importResult.error}`
            : `${importResult.importados ?? 0} comprovativo(s) importado(s).${importResult.skipped > 0 ? ` ${importResult.skipped} já existia(m).` : ''}`
          }
        </div>
      )}

      {/* Error */}
      {erro && (
        <div className="px-4 py-3 rounded-xl text-[11px] font-bold bg-red-50 border border-red-200 text-red-700">{erro}</div>
      )}

      {/* Summary */}
      {movsFiltered.length > 0 && (
        <div className="flex items-center gap-6 px-5 py-3 bg-slate-50 rounded-2xl border border-slate-100">
          <div>
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Total movimentos</p>
            <p className="text-lg font-black text-slate-800">{movsFiltered.length}</p>
          </div>
          <div className="w-px h-8 bg-slate-200" />
          <div>
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Total saídas</p>
            <p className="text-lg font-black text-rose-600">{formatValor(totalGeral)}</p>
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={24} className="animate-spin text-slate-400" />
        </div>
      )}

      {/* Empty */}
      {!loading && movsFiltered.length === 0 && (
        <div className="text-center py-12">
          <Landmark size={32} className="text-slate-200 mx-auto mb-3" />
          <p className="text-sm font-black text-slate-400">Nenhuma movimentação encontrada</p>
          <p className="text-[11px] text-slate-300 mt-1">Importe comprovativos do Gmail para começar.</p>
        </div>
      )}

      {/* Grouped list */}
      {!loading && groupedByMonth.map(([key, items]) => {
        const isCollapsed = collapsedMonths.has(key);
        const total = items.reduce((acc, m) => acc + Number(m.valor || 0), 0);
        return (
          <div key={key} className="border border-slate-100 rounded-2xl overflow-hidden">
            <button
              onClick={() => toggleMonth(key)}
              className="w-full flex items-center justify-between px-5 py-3 bg-slate-50 hover:bg-slate-100 transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="text-xs font-black text-slate-700 uppercase tracking-wide">{monthLabel(key)}</span>
                <span className="text-[10px] font-bold text-slate-400">{items.length} mov.</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-black text-rose-600">{formatValor(total)}</span>
                {isCollapsed ? <ChevronDown size={14} className="text-slate-400" /> : <ChevronUp size={14} className="text-slate-400" />}
              </div>
            </button>

            {!isCollapsed && (
              <div className="divide-y divide-slate-50">
                {items.map(mov => (
                  <div key={mov.id} className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50/50 transition-colors">
                    <div className="w-20 shrink-0">
                      <p className="text-[10px] font-black text-slate-500">{formatDatePT(mov.data_documento)}</p>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-black text-slate-800 truncate">{mov.fornecedor || '—'}</p>
                      {(mov.referencia || mov.descricao) && (
                        <p className="text-[10px] text-slate-400 truncate">{mov.referencia || mov.descricao}</p>
                      )}
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-sm font-black text-rose-600">{formatValor(mov.valor)}</p>
                      <p className="text-[9px] text-slate-400 uppercase">{mov.moeda || 'EUR'}</p>
                    </div>
                    {mov.url && (
                      <a
                        href={mov.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 rounded-xl text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors shrink-0"
                        title="Ver comprovativo"
                      >
                        <ExternalLink size={13} />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
