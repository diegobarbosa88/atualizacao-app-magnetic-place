import { useState } from 'react';
import { Search, FileText, CreditCard, TrendingUp, AlertCircle, CheckCircle, Info } from 'lucide-react';
import { authFetch } from '../../../utils/authFetch';
import SubTabBar from '../../../components/common/SubTabBar';
import { FT } from '../../../styles/designTokens';

const CURRENT_YEAR = new Date().getFullYear();

function AmbienteBadge({ ambiente }) {
  if (!ambiente) return null;
  return ambiente === 'producao'
    ? <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">Produção</span>
    : <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-800">Teste</span>;
}

function SemRegistos() {
  return (
    <div className="flex items-center gap-2 text-sm text-gray-500 py-3 px-1">
      <Info size={14} />
      Sem registos encontrados.
    </div>
  );
}

function ErroMsg({ erro }) {
  return (
    <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 rounded p-3 mt-2">
      <AlertCircle size={14} className="mt-0.5 shrink-0" />
      <span>{erro}</span>
    </div>
  );
}

// ── Comprovativos de Pagamento ───────────────────────────────────────────────

function ComprovativosSection() {
  const [ano, setAno] = useState(String(CURRENT_YEAR));
  const [estado, setEstado] = useState(null); // null | { loading } | { dados, ambiente, semRegistos } | { erro }

  async function consultar() {
    setEstado({ loading: true });
    try {
      const r = await authFetch(`/api/seguranca-social?action=comprovativos&ano=${ano}`);
      const json = await r.json();
      if (!r.ok) { setEstado({ erro: json.erro || `HTTP ${r.status}` }); return; }
      setEstado({ dados: json.dados || [], ambiente: json.ambiente, semRegistos: json.semRegistos });
    } catch (e) { setEstado({ erro: e.message }); }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-end gap-3">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Ano</label>
          <input
            type="number"
            value={ano}
            min={2020}
            max={CURRENT_YEAR}
            onChange={e => setAno(e.target.value)}
            className="border border-gray-300 rounded px-2 py-1.5 text-sm w-24 focus:outline-none focus:ring-1 focus:ring-[var(--navy)]"
          />
        </div>
        <button
          onClick={consultar}
          disabled={estado?.loading}
          className="flex items-center gap-1.5 px-3 py-1.5 border rounded text-sm disabled:opacity-50 hover:bg-[var(--surface)] transition-colors"
          style={{ borderColor: FT.slate, color: 'var(--ink-soft)' }}
        >
          <Search size={13} />
          {estado?.loading ? 'A consultar…' : 'Consultar'}
        </button>
        {estado?.ambiente && <AmbienteBadge ambiente={estado.ambiente} />}
      </div>

      {estado?.erro && <ErroMsg erro={estado.erro} />}
      {estado?.semRegistos && <SemRegistos />}

      {estado?.dados?.length > 0 && (
        <div className="overflow-x-auto">
          <table className="min-w-full text-xs border-collapse">
            <thead>
              <tr className="bg-gray-50 text-gray-600">
                {['Nº Documento', 'Data', 'Natureza', 'Valor (€)'].map(h => (
                  <th key={h} className="px-3 py-2 text-left border border-gray-200">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {estado.dados.map((row, i) => (
                <tr key={i} className="odd:bg-white even:bg-gray-50">
                  <td className="px-3 py-1.5 border border-gray-200 font-mono">{row['numero-documento'] ?? row.numeroDocumento ?? '—'}</td>
                  <td className="px-3 py-1.5 border border-gray-200">{row['data-pagamento'] ?? row.dataPagamento ?? '—'}</td>
                  <td className="px-3 py-1.5 border border-gray-200">{row['natureza-pagamento'] ?? row.naturezaPagamento ?? '—'}</td>
                  <td className="px-3 py-1.5 border border-gray-200 text-right">{row.valor != null ? Number(row.valor).toFixed(2) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Documentos de Pagamento ──────────────────────────────────────────────────

function DocumentosPagamentoSection() {
  const [estado, setEstado] = useState(null);

  async function consultar() {
    setEstado({ loading: true });
    try {
      const r = await authFetch('/api/seguranca-social?action=documentos-pagamento');
      const json = await r.json();
      if (!r.ok) { setEstado({ erro: json.erro || `HTTP ${r.status}` }); return; }
      setEstado({ dados: json.dados || [], ambiente: json.ambiente, semRegistos: json.semRegistos });
    } catch (e) { setEstado({ erro: e.message }); }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <button
          onClick={consultar}
          disabled={estado?.loading}
          className="flex items-center gap-1.5 px-3 py-1.5 border rounded text-sm disabled:opacity-50 hover:bg-[var(--surface)] transition-colors"
          style={{ borderColor: FT.slate, color: 'var(--ink-soft)' }}
        >
          <Search size={13} />
          {estado?.loading ? 'A consultar…' : 'Consultar Documentos'}
        </button>
        {estado?.ambiente && <AmbienteBadge ambiente={estado.ambiente} />}
      </div>

      {estado?.erro && <ErroMsg erro={estado.erro} />}
      {estado?.semRegistos && <SemRegistos />}

      {estado?.dados?.length > 0 && (
        <div className="overflow-x-auto">
          <table className="min-w-full text-xs border-collapse">
            <thead>
              <tr className="bg-gray-50 text-gray-600">
                {['Tipo', 'Subtipo', 'Nº Documento', 'Validade', 'Valor (€)', 'Referência'].map(h => (
                  <th key={h} className="px-3 py-2 text-left border border-gray-200">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {estado.dados.map((row, i) => (
                <tr key={i} className="odd:bg-white even:bg-gray-50">
                  <td className="px-3 py-1.5 border border-gray-200">{row.tipo ?? '—'}</td>
                  <td className="px-3 py-1.5 border border-gray-200">{row.subtipo ?? '—'}</td>
                  <td className="px-3 py-1.5 border border-gray-200 font-mono">{row['numero-documento'] ?? row.numeroDocumento ?? '—'}</td>
                  <td className="px-3 py-1.5 border border-gray-200">{row['data-validade'] ?? row.dataValidade ?? '—'}</td>
                  <td className="px-3 py-1.5 border border-gray-200 text-right">{row.valor != null ? Number(row.valor).toFixed(2) : '—'}</td>
                  <td className="px-3 py-1.5 border border-gray-200 font-mono">{row.referencia ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Remunerações Permanentes ─────────────────────────────────────────────────

function RemuneracoesSection() {
  const [form, setForm] = useState({ nissTrabalhadores: '', dataInicio: '', dataFim: '' });
  const [estado, setEstado] = useState(null);

  async function consultar() {
    setEstado({ loading: true });
    const body = {
      action: 'remuneracoes',
      nissTrabalhadores: form.nissTrabalhadores
        ? form.nissTrabalhadores.split(/[\s,;]+/).filter(Boolean)
        : [],
      dataInicio: form.dataInicio || undefined,
      dataFim:    form.dataFim    || undefined,
    };
    try {
      const r = await authFetch('/api/seguranca-social', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await r.json();
      if (!r.ok) { setEstado({ erro: json.erro || `HTTP ${r.status}` }); return; }
      setEstado({ dados: json.dados || [], ambiente: json.ambiente, semRegistos: json.semRegistos });
    } catch (e) { setEstado({ erro: e.message }); }
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="sm:col-span-3">
          <label className="block text-xs text-gray-500 mb-1">NISS dos trabalhadores (opcional — separar por vírgula ou espaço)</label>
          <input
            type="text"
            placeholder="ex: 12345678901, 10987654321"
            value={form.nissTrabalhadores}
            onChange={e => setForm(f => ({ ...f, nissTrabalhadores: e.target.value }))}
            className="border border-gray-300 rounded px-2 py-1.5 text-sm w-full focus:outline-none focus:ring-1 focus:ring-[var(--navy)]"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Data início</label>
          <input type="date" value={form.dataInicio} onChange={e => setForm(f => ({ ...f, dataInicio: e.target.value }))}
            className="border border-gray-300 rounded px-2 py-1.5 text-sm w-full focus:outline-none focus:ring-1 focus:ring-[var(--navy)]" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Data fim</label>
          <input type="date" value={form.dataFim} onChange={e => setForm(f => ({ ...f, dataFim: e.target.value }))}
            className="border border-gray-300 rounded px-2 py-1.5 text-sm w-full focus:outline-none focus:ring-1 focus:ring-[var(--navy)]" />
        </div>
        <div className="flex items-end gap-2">
          <button
            onClick={consultar}
            disabled={estado?.loading}
            className="flex items-center gap-1.5 px-3 py-1.5 border rounded text-sm disabled:opacity-50 hover:bg-[var(--surface)] transition-colors"
          style={{ borderColor: FT.slate, color: 'var(--ink-soft)' }}
          >
            <Search size={13} />
            {estado?.loading ? 'A consultar…' : 'Consultar'}
          </button>
          {estado?.ambiente && <AmbienteBadge ambiente={estado.ambiente} />}
        </div>
      </div>

      {estado?.erro && <ErroMsg erro={estado.erro} />}
      {estado?.semRegistos && <SemRegistos />}

      {estado?.dados?.length > 0 && (
        <div className="overflow-x-auto">
          <table className="min-w-full text-xs border-collapse">
            <thead>
              <tr className="bg-gray-50 text-gray-600">
                {['NISS', 'Nome', 'Data Comunicação', 'Tipo Remuneração', 'Valor (€)'].map(h => (
                  <th key={h} className="px-3 py-2 text-left border border-gray-200">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {estado.dados.map((row, i) => (
                <tr key={i} className="odd:bg-white even:bg-gray-50">
                  <td className="px-3 py-1.5 border border-gray-200 font-mono">{row['niss-trabalhador'] ?? row.nissTrabalhador ?? '—'}</td>
                  <td className="px-3 py-1.5 border border-gray-200">{row['nome-trabalhador'] ?? row.nomeTrabalhador ?? '—'}</td>
                  <td className="px-3 py-1.5 border border-gray-200">{row['data-comunicacao'] ?? row.dataComunicacao ?? '—'}</td>
                  <td className="px-3 py-1.5 border border-gray-200">{row['tipo-remuneracao'] ?? row.tipoRemuneracao ?? '—'}</td>
                  <td className="px-3 py-1.5 border border-gray-200 text-right">{row['valor-remuneracao'] != null ? Number(row['valor-remuneracao']).toFixed(2) : row.valorRemuneracao != null ? Number(row.valorRemuneracao).toFixed(2) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Painel principal ─────────────────────────────────────────────────────────

export default function SSConsultasPanel() {
  const [aba, setAba] = useState('comprovativos');

  const abas = [
    { id: 'comprovativos',       label: 'Comprovativos de Pagamento', icon: CheckCircle },
    { id: 'documentos-pagamento', label: 'Documentos de Pagamento',   icon: FileText    },
    { id: 'remuneracoes',         label: 'Remunerações Permanentes',  icon: TrendingUp  },
  ];

  return (
    <div className="space-y-4">
      <SubTabBar tabs={abas} activeTab={aba} onTabChange={setAba} />

      <div className="pt-1">
        {aba === 'comprovativos'        && <ComprovativosSection />}
        {aba === 'documentos-pagamento' && <DocumentosPagamentoSection />}
        {aba === 'remuneracoes'         && <RemuneracoesSection />}
      </div>
    </div>
  );
}
