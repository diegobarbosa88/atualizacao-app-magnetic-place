import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { Loader2, RefreshCw, ExternalLink, Landmark, Filter, ChevronDown, ChevronUp, Trash2, Settings, X, Save, Eye } from 'lucide-react';

const MESES_PT = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

const LS_KEY = 'gmail_comprovativo_config';
const DEFAULT_CONFIG = {
  remetentes: 'alertas@novobanco.pt,comprovativos@novobanco.pt,info@novobanco.pt',
  palavras: 'comprovativo,"operação submetida","operacao submetida","pagamento executado","transferência executada","transferencia executada"',
  apenasNaoLidos: true,
};

function buildGmailQuery({ remetentes, palavras, apenasNaoLidos }) {
  const froms = remetentes.split(',').map(s => s.trim()).filter(Boolean);
  const kws = palavras.split(',').map(s => s.trim()).filter(Boolean);
  const parts = [];
  if (apenasNaoLidos) parts.push('is:unread');
  if (froms.length > 0) {
    parts.push(froms.length === 1 ? `from:${froms[0]}` : `from:(${froms.join(' OR ')})`);
  }
  if (kws.length > 0) {
    parts.push(kws.length === 1 ? kws[0] : `(${kws.join(' OR ')})`);
  }
  return parts.join(' ');
}

function loadConfig() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
  } catch (_) {}
  return { ...DEFAULT_CONFIG };
}

function formatDatePT(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatValor(valor) {
  if (valor == null) return '—';
  return Number(valor).toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}

function formatConta(conta) {
  if (!conta) return '—';
  // Mostra só os últimos 4 dígitos para IBANs longos, ou o valor completo se curto
  const clean = conta.replace(/\s/g, '');
  if (clean.length > 10) return `···${clean.slice(-4)}`;
  return clean;
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
  const [filtroConta, setFiltroConta] = useState('');
  const [collapsedMonths, setCollapsedMonths] = useState(new Set());
  const [apagandoId, setApagandoId] = useState(null);

  // Config panel
  const [configOpen, setConfigOpen] = useState(false);
  const [config, setConfig] = useState(loadConfig);
  const [draftConfig, setDraftConfig] = useState(loadConfig);
  const [showQueryPreview, setShowQueryPreview] = useState(false);

  const queryPreview = useMemo(() => buildGmailQuery(draftConfig), [draftConfig]);
  const activeQuery = useMemo(() => buildGmailQuery(config), [config]);

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

  const handleSaveConfig = () => {
    setConfig({ ...draftConfig });
    try { localStorage.setItem(LS_KEY, JSON.stringify(draftConfig)); } catch (_) {}
    setConfigOpen(false);
    setImportResult(null);
  };

  const handleResetConfig = () => {
    setDraftConfig({ ...DEFAULT_CONFIG });
  };

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
        body: JSON.stringify({ mode: 'comprovativos', query: activeQuery }),
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

  const contasDisponiveis = useMemo(() => {
    const set = new Set(movs.map(m => m.conta_origem).filter(Boolean));
    return [...set].sort();
  }, [movs]);

  const movsFiltered = useMemo(() => {
    return movs.filter(m => {
      if (filtroMes && monthKey(m.data_documento) !== filtroMes) return false;
      if (filtroConta && m.conta_origem !== filtroConta) return false;
      return true;
    });
  }, [movs, filtroMes, filtroConta]);

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

  const handleApagar = async (mov) => {
    if (!window.confirm(`Apagar movimentação de ${formatValor(mov.valor)} — ${mov.fornecedor}?`)) return;
    setApagandoId(mov.id);
    try {
      if (mov.storage_path) {
        await supabase.storage.from('faturas').remove([mov.storage_path]);
      }
      const { error } = await supabase.from('faturas_centro_documentos').delete().eq('id', mov.id);
      if (error) throw error;
      setMovs(prev => prev.filter(m => m.id !== mov.id));
    } catch (e) {
      alert(`Erro ao apagar: ${e.message}`);
    } finally {
      setApagandoId(null);
    }
  };

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
          {contasDisponiveis.length > 1 && (
            <div className="relative">
              <Filter size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <select
                value={filtroConta}
                onChange={e => setFiltroConta(e.target.value)}
                className="pl-8 pr-3 py-2 text-[11px] font-bold border border-slate-200 rounded-xl bg-white text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-300"
              >
                <option value="">Todas as contas</option>
                {contasDisponiveis.map(c => (
                  <option key={c} value={c}>{formatConta(c)}</option>
                ))}
              </select>
            </div>
          )}

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
            onClick={() => { setDraftConfig({ ...config }); setConfigOpen(v => !v); setShowQueryPreview(false); }}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-black transition-all ${configOpen ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            title="Configurar pesquisa Gmail"
          >
            <Settings size={13} /> Configurar
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

      {/* Config panel */}
      {configOpen && (
        <div className="border border-indigo-100 rounded-2xl bg-indigo-50/40 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h5 className="text-xs font-black text-indigo-800 uppercase tracking-wide">Configuração da pesquisa Gmail</h5>
            <button onClick={() => setConfigOpen(false)} className="p-1 rounded-lg text-slate-400 hover:text-slate-600">
              <X size={14} />
            </button>
          </div>

          {/* Remetentes */}
          <div className="space-y-1.5">
            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500">
              Remetentes <span className="text-slate-400 normal-case font-semibold">(separados por vírgula)</span>
            </label>
            <input
              type="text"
              value={draftConfig.remetentes}
              onChange={e => setDraftConfig(p => ({ ...p, remetentes: e.target.value }))}
              placeholder="ex: alertas@novobanco.pt,info@novobanco.pt"
              className="w-full px-3 py-2 text-[11px] font-mono border border-slate-200 rounded-xl bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-300 placeholder:text-slate-300"
            />
            <p className="text-[10px] text-slate-400">Endereços de email do banco a monitorizar. Deixar vazio para pesquisar todos os remetentes.</p>
          </div>

          {/* Palavras-chave */}
          <div className="space-y-1.5">
            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500">
              Palavras-chave <span className="text-slate-400 normal-case font-semibold">(separadas por vírgula, use aspas para frases)</span>
            </label>
            <input
              type="text"
              value={draftConfig.palavras}
              onChange={e => setDraftConfig(p => ({ ...p, palavras: e.target.value }))}
              placeholder='ex: comprovativo,"pagamento executado"'
              className="w-full px-3 py-2 text-[11px] font-mono border border-slate-200 rounded-xl bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-300 placeholder:text-slate-300"
            />
            <p className="text-[10px] text-slate-400">O Gmail procura estas palavras no assunto e corpo do email. Pelo menos uma tem de estar presente.</p>
          </div>

          {/* Apenas não lidos */}
          <div className="flex items-start gap-3">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={draftConfig.apenasNaoLidos}
                onChange={e => setDraftConfig(p => ({ ...p, apenasNaoLidos: e.target.checked }))}
                className="w-4 h-4 rounded accent-indigo-600"
              />
              <div>
                <span className="text-[11px] font-black text-slate-700">Apenas emails não lidos</span>
                <p className="text-[10px] text-slate-400 mt-0.5">Desativar para incluir emails já abertos anteriormente (útil para recuperar comprovativos perdidos).</p>
              </div>
            </label>
          </div>

          {/* Query preview */}
          <div className="space-y-1.5">
            <button
              onClick={() => setShowQueryPreview(v => !v)}
              className="flex items-center gap-1.5 text-[10px] font-black text-indigo-600 hover:text-indigo-800 transition-colors"
            >
              <Eye size={12} /> {showQueryPreview ? 'Ocultar' : 'Ver'} query Gmail gerada
            </button>
            {showQueryPreview && (
              <div className="px-3 py-2.5 bg-slate-800 rounded-xl">
                <p className="text-[11px] font-mono text-emerald-400 break-all">{queryPreview || <span className="text-slate-500 italic">query vazia</span>}</p>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={handleSaveConfig}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[11px] font-black bg-indigo-600 text-white hover:bg-indigo-700 transition-all shadow-sm"
            >
              <Save size={12} /> Guardar configuração
            </button>
            <button
              onClick={handleResetConfig}
              className="px-3 py-2 rounded-xl text-[11px] font-bold text-slate-500 hover:bg-slate-100 transition-all"
            >
              Repor padrões
            </button>
          </div>
        </div>
      )}

      {/* Import result */}
      {importResult && (
        <div className={`px-4 py-3 rounded-xl text-[11px] font-bold border ${importResult.error ? 'bg-red-50 border-red-200 text-red-700' : 'bg-emerald-50 border-emerald-200 text-emerald-700'}`}>
          {importResult.error
            ? `Erro: ${importResult.error}`
            : `${importResult.importados ?? 0} comprovativo(s) importado(s).${importResult.skipped > 0 ? ` ${importResult.skipped} já existia(m).` : ''}`
          }
          {importResult.erros?.length > 0 && (
            <details className="mt-2">
              <summary className="cursor-pointer text-amber-700 font-black">{importResult.erros.length} aviso(s)</summary>
              <ul className="mt-1 space-y-1">
                {importResult.erros.map((e, i) => (
                  <li key={i} className="text-amber-600 font-mono text-[10px]">
                    {e.aviso || e.error || JSON.stringify(e)}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}

      {/* Error */}
      {erro && (
        <div className="px-4 py-3 rounded-xl text-[11px] font-bold bg-red-50 border border-red-200 text-red-700">{erro}</div>
      )}

      {/* Summary */}
      {movsFiltered.length > 0 && (
        <div className="flex flex-wrap items-center gap-6 px-5 py-3 bg-slate-50 rounded-2xl border border-slate-100">
          <div>
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Total movimentos</p>
            <p className="text-lg font-black text-slate-800">{movsFiltered.length}</p>
          </div>
          <div className="w-px h-8 bg-slate-200" />
          <div>
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Total saídas</p>
            <p className="text-lg font-black text-rose-600">{formatValor(totalGeral)}</p>
          </div>
          {contasDisponiveis.length > 1 && !filtroConta && (
            <>
              <div className="w-px h-8 bg-slate-200" />
              <div className="flex flex-wrap gap-3">
                {contasDisponiveis.map(conta => {
                  const total = movsFiltered.filter(m => m.conta_origem === conta).reduce((s, m) => s + Number(m.valor || 0), 0);
                  const count = movsFiltered.filter(m => m.conta_origem === conta).length;
                  return (
                    <div key={conta}>
                      <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Conta ···{conta.replace(/\s/g, '').slice(-4)}</p>
                      <p className="text-sm font-black text-rose-500">{formatValor(total)} <span className="text-slate-400 text-[10px] font-bold">({count})</span></p>
                    </div>
                  );
                })}
                {movsFiltered.some(m => !m.conta_origem) && (
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Conta desconhecida</p>
                    <p className="text-sm font-black text-slate-500">
                      {formatValor(movsFiltered.filter(m => !m.conta_origem).reduce((s, m) => s + Number(m.valor || 0), 0))}
                      <span className="text-slate-400 text-[10px] font-bold"> ({movsFiltered.filter(m => !m.conta_origem).length})</span>
                    </p>
                  </div>
                )}
              </div>
            </>
          )}
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
                      <div className="flex items-center gap-1.5 min-w-0">
                        <p className="text-xs font-black text-slate-800 truncate">{mov.fornecedor || '—'}</p>
                        {mov.conta_origem && contasDisponiveis.length > 1 && (
                          <span className="shrink-0 px-1.5 py-0.5 rounded-md text-[9px] font-black bg-indigo-50 text-indigo-500 border border-indigo-100">
                            ···{mov.conta_origem.replace(/\s/g, '').slice(-4)}
                          </span>
                        )}
                      </div>
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
                    <button
                      onClick={() => handleApagar(mov)}
                      disabled={apagandoId === mov.id}
                      className="p-2 rounded-xl text-slate-300 hover:text-rose-500 hover:bg-rose-50 transition-colors shrink-0 disabled:opacity-40"
                      title="Apagar movimentação"
                    >
                      {apagandoId === mov.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                    </button>
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
