import React, { useState, useMemo } from 'react';
import {
  BarChart2, Loader2, Search, X, ChevronDown, ChevronUp,
  Eye, Download, ArrowUpDown, ArrowUp, ArrowDown,
} from 'lucide-react';

const MESES = [
  { val: '01', label: 'Janeiro' }, { val: '02', label: 'Fevereiro' },
  { val: '03', label: 'Março' }, { val: '04', label: 'Abril' },
  { val: '05', label: 'Maio' }, { val: '06', label: 'Junho' },
  { val: '07', label: 'Julho' }, { val: '08', label: 'Agosto' },
  { val: '09', label: 'Setembro' }, { val: '10', label: 'Outubro' },
  { val: '11', label: 'Novembro' }, { val: '12', label: 'Dezembro' },
];

const FIELD_LABELS = {
  document_number: 'Nº Documento', document_no: 'Nº Documento',
  date: 'Data', due_date: 'Data Vencimento',
  customer_name: 'Cliente', customer_business_name: 'Empresa Cliente',
  customer_tax_number: 'NIF Cliente',
  supplier_name: 'Fornecedor', supplier_business_name: 'Empresa Fornecedor',
  supplier_tax_number: 'NIF Fornecedor',
  total_amount: 'Total (€)', gross_total: 'Total Bruto (€)',
  total_tax_amount: 'IVA (€)', total_value: 'Total (€)',
  net_amount: 'Líquido (€)', received_value: 'Valor Recebido (€)',
  document_type_name: 'Tipo', status: 'Estado',
  notes: 'Notas', series: 'Série',
  payment_method: 'Forma de Pagamento', payment_status: 'Estado Pagamento',
  currency: 'Moeda', description: 'Descrição',
  discount: 'Desconto', tax_country_region: 'Região Fiscal',
};

const VALOR_KEYS = ['total_amount', 'gross_total', 'total_tax_amount', 'net_amount', 'received_value', 'total_value'];

// Normaliza cada item para attrs planos (JSON:API ou flat)
function getAttrs(item) {
  return item.attributes || item;
}

function getNomeEntidade(attrs, tipo) {
  if (tipo === 'compras') {
    return attrs.supplier_business_name || attrs.supplier_name || '';
  }
  return attrs.customer_business_name || attrs.customer_name || '';
}

function getValorTotal(attrs) {
  return attrs.gross_total ?? attrs.total_amount ?? attrs.received_value ?? attrs.total_value ?? null;
}

function getIva(attrs) {
  return attrs.total_tax_amount ?? null;
}

function getObservacao(attrs) {
  return attrs.notes || attrs.observations || attrs.observation || attrs.remarks || attrs.memo || attrs.description || null;
}

function getDocNum(item, attrs) {
  return attrs.document_number || attrs.document_no || (item.id ? `#${item.id}` : '—');
}

function formatVal(k, v) {
  if (VALOR_KEYS.includes(k)) {
    const n = parseFloat(v);
    return isNaN(n) ? String(v) : n.toFixed(2) + ' €';
  }
  return String(v);
}

function ModalDoc({ item, tipo, onClose }) {
  const [pdfUrl, setPdfUrl] = useState(null);
  const [carregandoPdf, setCarregandoPdf] = useState(false);

  if (!item) return null;
  const attrs = getAttrs(item);

  const campos = Object.entries(attrs)
    .filter(([, v]) => v != null && v !== '' && typeof v !== 'object')
    .sort(([a], [b]) => {
      const order = ['document_number', 'document_no', 'date', 'customer_name', 'customer_business_name', 'supplier_name', 'supplier_business_name', 'gross_total', 'total_amount', 'total_tax_amount'];
      const ia = order.indexOf(a), ib = order.indexOf(b);
      if (ia >= 0 && ib >= 0) return ia - ib;
      if (ia >= 0) return -1;
      if (ib >= 0) return 1;
      return a.localeCompare(b);
    });

  const handleBaixarPdf = async () => {
    if (pdfUrl) { window.open(pdfUrl, '_blank'); return; }
    setCarregandoPdf(true);
    try {
      const tipoDoc = tipo === 'compras' ? 'compra' : tipo === 'recibos' ? 'recibo' : 'venda';
      const id = item.id ?? attrs.id;
      const res = await fetch(`/api/toconline/documento?id=${id}&tipo=${tipoDoc}`);
      const data = await res.json();
      if (data.pdf_url) {
        setPdfUrl(data.pdf_url);
        window.open(data.pdf_url, '_blank');
      } else {
        alert('PDF não disponível para este documento.');
      }
    } catch (e) {
      alert('Erro ao obter PDF: ' + e.message);
    } finally {
      setCarregandoPdf(false);
    }
  };

  const entidade = getNomeEntidade(attrs, tipo);
  const docNum = getDocNum(item, attrs);
  const tipoLabel = tipo === 'compras' ? 'Documento de Compra' : tipo === 'recibos' ? 'Recibo' : 'Documento de Venda';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between px-6 pt-6 pb-4 border-b border-slate-100">
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">{tipoLabel}</p>
            <p className="text-sm font-bold text-slate-700">{docNum}</p>
            {entidade && <p className="text-xs text-slate-500 mt-0.5">{entidade}</p>}
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors ml-3">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {campos.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-8">Sem dados disponíveis.</p>
          ) : (
            <div className="space-y-3">
              {campos.map(([k, v]) => (
                <div key={k} className="flex gap-3">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 w-36 shrink-0 pt-0.5">
                    {FIELD_LABELS[k] || k.replace(/_/g, ' ')}
                  </span>
                  <span className="text-sm text-slate-700 font-semibold flex-1 break-words">
                    {formatVal(k, v)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="px-6 pb-6 pt-4 border-t border-slate-100">
          <button
            onClick={handleBaixarPdf}
            disabled={carregandoPdf}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-2xl text-sm font-black uppercase tracking-widest hover:bg-blue-700 transition-all shadow-sm disabled:opacity-60"
          >
            {carregandoPdf ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
            {pdfUrl ? 'Abrir PDF' : 'Baixar PDF Original'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function TOConlineRelatorios({ onDesligado }) {
  const [tipo, setTipo] = useState('vendas');
  const [dataDe, setDataDe] = useState(() => `${new Date().getFullYear()}-01-01`);
  const [dataAte, setDataAte] = useState(() => new Date().toISOString().slice(0, 10));
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState(null);
  const [temMais, setTemMais] = useState(false);

  // Filtros client-side
  const [pesquisa, setPesquisa] = useState('');
  const [filtroMes, setFiltroMes] = useState('');
  const [filtroAno, setFiltroAno] = useState('');
  const [filtroEntidade, setFiltroEntidade] = useState('');
  const [mostrarFiltros, setMostrarFiltros] = useState(false);
  const [ordem, setOrdem] = useState({ campo: 'date', dir: 'desc' });
  const [itemDetalhe, setItemDetalhe] = useState(null);

  const handleGerar = async () => {
    setLoading(true);
    setErro(null);
    setDocs([]);
    setTemMais(false);
    setPesquisa('');
    setFiltroMes('');
    setFiltroAno('');
    setFiltroEntidade('');
    try {
      const params = new URLSearchParams({ tipo, page: '1' });
      if (dataDe) params.set('data_de', dataDe);
      if (dataAte) params.set('data_ate', dataAte);
      const res = await fetch(`/api/toconline/relatorio?${params}`);
      const data = await res.json();
      if (res.status === 401) { onDesligado?.(); return; }
      if (!res.ok) throw new Error(data.error || 'Erro ao carregar dados');
      const lista = data.data || [];
      setDocs(lista);
      setTemMais(lista.length === 50);
    } catch (e) {
      setErro(e.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleOrdem = (campo) => setOrdem(prev =>
    prev.campo === campo ? { campo, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { campo, dir: 'asc' }
  );

  // Opções derivadas
  const anosDisponiveis = useMemo(() => {
    const anos = new Set(docs.map(d => (getAttrs(d).date || '').slice(0, 4)).filter(a => a && a.length === 4));
    return [...anos].sort().reverse();
  }, [docs]);

  const entidadesDisponiveis = useMemo(() => {
    return [...new Set(docs.map(d => getNomeEntidade(getAttrs(d), tipo)).filter(Boolean))].sort();
  }, [docs, tipo]);

  const docsFiltrados = useMemo(() => {
    let lista = [...docs];
    const q = pesquisa.toLowerCase().trim();
    if (q) lista = lista.filter(d => {
      const a = getAttrs(d);
      const ent = getNomeEntidade(a, tipo).toLowerCase();
      const num = getDocNum(d, a).toLowerCase();
      return ent.includes(q) || num.includes(q);
    });
    if (filtroAno) lista = lista.filter(d => (getAttrs(d).date || '').slice(0, 4) === filtroAno);
    if (filtroMes) lista = lista.filter(d => (getAttrs(d).date || '').slice(5, 7) === filtroMes);
    if (filtroEntidade) lista = lista.filter(d => getNomeEntidade(getAttrs(d), tipo) === filtroEntidade);

    lista.sort((a, b) => {
      const aa = getAttrs(a), ba = getAttrs(b);
      let va, vb;
      if (ordem.campo === 'entidade') { va = getNomeEntidade(aa, tipo); vb = getNomeEntidade(ba, tipo); }
      else if (ordem.campo === 'total') { va = getValorTotal(aa) ?? -1; vb = getValorTotal(ba) ?? -1; }
      else { va = aa.date || ''; vb = ba.date || ''; }
      if (va < vb) return ordem.dir === 'asc' ? -1 : 1;
      if (va > vb) return ordem.dir === 'asc' ? 1 : -1;
      return 0;
    });
    return lista;
  }, [docs, pesquisa, filtroAno, filtroMes, filtroEntidade, ordem, tipo]);

  const filtrosAtivos = pesquisa || filtroMes || filtroAno || filtroEntidade;
  const limparFiltros = () => { setPesquisa(''); setFiltroMes(''); setFiltroAno(''); setFiltroEntidade(''); };

  const totalValor = docsFiltrados.reduce((sum, d) => sum + (getValorTotal(getAttrs(d)) ?? 0), 0);
  const totalIva = docsFiltrados.reduce((sum, d) => sum + (getIva(getAttrs(d)) ?? 0), 0);

  const selectClass = "w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white";

  const ThSort = ({ campo, label }) => (
    <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400 cursor-pointer select-none hover:text-slate-600 transition-colors"
      onClick={() => toggleOrdem(campo)}>
      <span className="flex items-center gap-1">
        {label}
        {ordem.campo !== campo
          ? <ArrowUpDown size={11} className="text-slate-300" />
          : ordem.dir === 'asc' ? <ArrowUp size={11} className="text-blue-500" /> : <ArrowDown size={11} className="text-blue-500" />
        }
      </span>
    </th>
  );

  return (
    <div className="space-y-5">
      {/* Controlos principais */}
      <div className="bg-white rounded-2xl border border-slate-100 p-5 space-y-4">
        <p className="text-xs font-black uppercase tracking-widest text-slate-400">Filtrar documentos</p>
        <div className="flex flex-wrap gap-3 items-end">
          <div className="space-y-1">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Tipo</p>
            <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
              {[
                { key: 'vendas', label: 'Vendas' },
                { key: 'compras', label: 'Compras' },
                { key: 'recibos', label: 'Recibos' },
              ].map(({ key, label }) => (
                <button key={key} onClick={() => { setTipo(key); setDocs([]); }}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${tipo === key ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Data de</p>
            <input type="date" value={dataDe} onChange={e => setDataDe(e.target.value)}
              className="px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-300" />
          </div>

          <div className="space-y-1">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Data até</p>
            <input type="date" value={dataAte} onChange={e => setDataAte(e.target.value)}
              className="px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-300" />
          </div>

          <button onClick={handleGerar} disabled={loading}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-blue-700 transition-all disabled:opacity-60 shadow-sm shadow-blue-100">
            {loading ? <Loader2 size={13} className="animate-spin" /> : <BarChart2 size={13} />}
            Carregar
          </button>
        </div>
      </div>

      {erro && (
        <div className="bg-red-50 border border-red-100 rounded-2xl p-4 text-xs text-red-600 font-semibold">{erro}</div>
      )}

      {docs.length > 0 && (
        <>
          {/* Totais */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div className="bg-white rounded-2xl border border-slate-100 p-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Documentos</p>
              <p className="text-2xl font-black text-slate-800">
                {docsFiltrados.length}
                {docsFiltrados.length !== docs.length && <span className="text-sm text-slate-400 font-semibold ml-1">/ {docs.length}</span>}
              </p>
            </div>
            <div className="bg-white rounded-2xl border border-slate-100 p-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Total</p>
              <p className="text-2xl font-black text-slate-800">{totalValor.toFixed(2)} €</p>
            </div>
            {totalIva > 0 && (
              <div className="bg-white rounded-2xl border border-slate-100 p-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">IVA</p>
                <p className="text-2xl font-black text-slate-800">{totalIva.toFixed(2)} €</p>
              </div>
            )}
          </div>

          {/* Pesquisa + filtros */}
          <div className="space-y-3">
            <div className="flex gap-2 items-center">
              <div className="relative flex-1">
                <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input value={pesquisa} onChange={e => setPesquisa(e.target.value)}
                  placeholder={`Pesquisar por ${tipo === 'compras' ? 'fornecedor' : 'cliente'} ou nº documento...`}
                  className="w-full pl-9 pr-4 py-2.5 rounded-2xl border border-slate-200 text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-300" />
                {pesquisa && (
                  <button onClick={() => setPesquisa('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    <X size={13} />
                  </button>
                )}
              </div>
              <button onClick={() => setMostrarFiltros(v => !v)}
                className={`flex items-center gap-1.5 px-4 py-2.5 rounded-2xl border text-xs font-black uppercase tracking-widest transition-all ${mostrarFiltros || filtrosAtivos ? 'bg-blue-50 border-blue-200 text-blue-600' : 'bg-white border-slate-200 text-slate-500 hover:text-blue-600 hover:border-blue-200'}`}>
                {mostrarFiltros ? <ChevronUp size={13} /> : <ChevronDown size={13} />} Filtros
                {filtrosAtivos && <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />}
              </button>
              {filtrosAtivos && (
                <button onClick={limparFiltros} className="flex items-center gap-1 px-3 py-2.5 text-xs font-black uppercase tracking-widest text-slate-400 hover:text-red-500 transition-colors">
                  <X size={12} /> Limpar
                </button>
              )}
            </div>

            {mostrarFiltros && (
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Ano</label>
                  <select value={filtroAno} onChange={e => setFiltroAno(e.target.value)} className={selectClass}>
                    <option value="">Todos</option>
                    {anosDisponiveis.map(a => <option key={a} value={a}>{a}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Mês</label>
                  <select value={filtroMes} onChange={e => setFiltroMes(e.target.value)} className={selectClass}>
                    <option value="">Todos</option>
                    {MESES.map(m => <option key={m.val} value={m.val}>{m.label}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    {tipo === 'compras' ? 'Fornecedor' : 'Cliente'}
                  </label>
                  <select value={filtroEntidade} onChange={e => setFiltroEntidade(e.target.value)} className={selectClass}>
                    <option value="">Todos</option>
                    {entidadesDisponiveis.map(e => <option key={e} value={e}>{e}</option>)}
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* Tabela */}
          {docsFiltrados.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-sm font-semibold">
              Nenhum documento corresponde aos filtros.
              <button onClick={limparFiltros} className="ml-2 text-blue-500 hover:underline">Limpar filtros</button>
            </div>
          ) : (
            <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50">
                      <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Nº Doc.</th>
                      <ThSort campo="entidade" label={tipo === 'compras' ? 'Fornecedor' : 'Cliente'} />
                      <ThSort campo="date" label="Data" />
                      <ThSort campo="total" label="Total" />
                      <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">IVA</th>
                      <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Observação</th>
                      <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {docsFiltrados.map((item, i) => {
                      const a = getAttrs(item);
                      const entidade = getNomeEntidade(a, tipo);
                      const total = getValorTotal(a);
                      const iva = getIva(a);
                      const docNum = getDocNum(item, a);
                      const obs = getObservacao(a);
                      return (
                        <tr key={item.id ?? i}
                          className={`border-b border-slate-50 transition-colors cursor-pointer ${i % 2 === 0 ? 'hover:bg-slate-50' : 'bg-slate-50/40 hover:bg-slate-100/60'}`}
                          onClick={() => setItemDetalhe(item)}>
                          <td className="px-4 py-3 text-xs font-mono text-slate-600 whitespace-nowrap">{docNum}</td>
                          <td className="px-4 py-3 text-xs font-semibold text-slate-700 max-w-[180px] truncate">{entidade || '—'}</td>
                          <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">{a.date || '—'}</td>
                          <td className="px-4 py-3 text-xs font-semibold text-slate-700 whitespace-nowrap">
                            {total != null ? Number(total).toFixed(2) + ' €' : '—'}
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">
                            {iva != null ? Number(iva).toFixed(2) + ' €' : '—'}
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-500 max-w-[200px]">
                            {obs
                              ? <span className="truncate block" title={obs}>{obs}</span>
                              : <span className="text-slate-300">—</span>}
                          </td>
                          <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                            <button onClick={() => setItemDetalhe(item)}
                              className="p-1.5 text-slate-400 hover:text-blue-600 transition-colors" title="Ver detalhes e descarregar PDF">
                              <Eye size={14} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="px-4 py-3 text-xs text-slate-400 font-semibold border-t border-slate-50 flex items-center justify-between gap-2">
                <span>
                  {docsFiltrados.length !== docs.length
                    ? `${docsFiltrados.length} de ${docs.length} documento(s)`
                    : `${docs.length} documento(s)`}
                </span>
                {temMais && (
                  <span className="text-[10px] text-amber-500">Mostrando primeiros 50 resultados — afine as datas para ver mais.</span>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {!loading && docs.length === 0 && !erro && (
        <div className="text-center py-16 text-slate-400 text-sm font-semibold">
          Selecione o tipo e o período, depois clique em <span className="text-blue-500">Carregar</span>.
        </div>
      )}

      <ModalDoc item={itemDetalhe} tipo={tipo} onClose={() => setItemDetalhe(null)} />
    </div>
  );
}
