import { useState, useRef, useEffect } from 'react';
import { Search, FileText, TrendingUp, AlertCircle, CheckCircle, Info, ShieldCheck, Bell, FileSignature, Users, Ban, Send } from 'lucide-react';
import { authFetch } from '../../../utils/authFetch';
import SubTabBar from '../../../components/common/SubTabBar';
import { FT } from '../../../styles/designTokens';
import EmitirDocumentoPagamentoModal from './EmitirDocumentoPagamentoModal';
import { formatReferencia } from './ssDocumentoPagamentoUtils';

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
                  <td className="px-3 py-1.5 border border-gray-200 font-mono">{row.numeroDocumentoPagamento ?? '—'}</td>
                  <td className="px-3 py-1.5 border border-gray-200">{row.dataPagamento ?? '—'}</td>
                  <td className="px-3 py-1.5 border border-gray-200">{row.mensagemNaturezaPagamento ?? '—'}</td>
                  <td className="px-3 py-1.5 border border-gray-200 text-right">{row.valorPago != null ? Number(row.valorPago).toFixed(2) : '—'}</td>
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

function DocumentosPagamentoSection({ ssAmbiente }) {
  const [estado, setEstado] = useState(null);
  const [cancelandoId, setCancelandoId] = useState(null);
  const [emitirAberto, setEmitirAberto] = useState(false);

  async function consultar() {
    setEstado({ loading: true });
    try {
      const r = await authFetch('/api/seguranca-social?action=documentos-pagamento');
      const json = await r.json();
      if (!r.ok) { setEstado({ erro: json.erro || `HTTP ${r.status}` }); return; }
      setEstado({ dados: json.dados || [], ambiente: json.ambiente, semRegistos: json.semRegistos });
    } catch (e) { setEstado({ erro: e.message }); }
  }

  // Não há operação de consulta prévia de "isCancelavel" documentada — a
  // única forma de saber se é cancelável é tentar e ler o resultado (ver
  // api/seguranca-social/index.js, action "cancelar-documento-pagamento").
  // Sem garantia de reversão — por isso o confirm() é explícito sobre isso e
  // distingue visualmente ambiente real de teste, mesma lógica do banner
  // vermelho/laranja dos modais de escrita.
  async function cancelar(row) {
    const id = row.numeroDocumentoPagamento;
    if (!id) return;
    const msg = ssAmbiente === 'producao'
      ? `⚠️ AMBIENTE REAL — Esta ação cancela o documento de pagamento nº ${id} junto da Segurança Social. NÃO HÁ GARANTIA DE REVERSÃO. Confirma?`
      : `(MODO DE TESTE) Cancelar o documento de pagamento nº ${id}? Não afeta produção.`;
    if (!window.confirm(msg)) return;

    setCancelandoId(id);
    try {
      const r = await authFetch('/api/seguranca-social', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cancelar-documento-pagamento', identificadorDocumento: id }),
      });
      const json = await r.json();
      if (!json.sucesso) { alert(json.erro || 'Erro ao cancelar documento.'); return; }
      alert('Documento cancelado com sucesso.');
      consultar();
    } catch (e) {
      alert(`Erro de ligação: ${e.message}`);
    } finally {
      setCancelandoId(null);
    }
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
        <button
          onClick={() => setEmitirAberto(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 border rounded text-sm hover:bg-[var(--surface)] transition-colors"
          style={{ borderColor: FT.slate, color: 'var(--ink-soft)' }}
        >
          <Send size={13} />
          Emitir Documento de Pagamento
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
                {['Tipo', 'Subtipo', 'Nº Documento', 'Validade', 'Valor (€)', 'Referência', 'Ações'].map(h => (
                  <th key={h} className="px-3 py-2 text-left border border-gray-200">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {estado.dados.map((row, i) => (
                <tr key={i} className="odd:bg-white even:bg-gray-50">
                  <td className="px-3 py-1.5 border border-gray-200">{row.tipo ?? '—'}</td>
                  <td className="px-3 py-1.5 border border-gray-200">{row.subtipo ?? '—'}</td>
                  <td className="px-3 py-1.5 border border-gray-200 font-mono">{row.numeroDocumentoPagamento ?? '—'}</td>
                  <td className="px-3 py-1.5 border border-gray-200">{row.dataValidade ?? '—'}</td>
                  <td className="px-3 py-1.5 border border-gray-200 text-right">{row.valor != null ? Number(row.valor).toFixed(2) : '—'}</td>
                  <td className="px-3 py-1.5 border border-gray-200 font-mono">{formatReferencia(row.referenciaDocumentoPagamento)}</td>
                  <td className="px-3 py-1.5 border border-gray-200">
                    {row.numeroDocumentoPagamento && (
                      <button
                        onClick={() => cancelar(row)}
                        disabled={cancelandoId === row.numeroDocumentoPagamento}
                        className="flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold disabled:opacity-50 transition-colors"
                        style={{ color: 'var(--bad)', borderWidth: 1, borderStyle: 'solid', borderColor: 'var(--bad)' }}
                        title="Cancelar documento de pagamento — sem garantia de reversão"
                      >
                        <Ban size={11} />
                        {cancelandoId === row.numeroDocumentoPagamento ? 'A cancelar…' : 'Cancelar'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {emitirAberto && (
        <EmitirDocumentoPagamentoModal
          ambiente={ssAmbiente}
          onClose={() => setEmitirAberto(false)}
        />
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

// ── Situação Contributiva ────────────────────────────────────────────────────

function SituacaoContributivaSection() {
  const [nissSolicitado, setNissSolicitado] = useState('');
  const [estado, setEstado] = useState(null); // null | { loading } | { caminho, regularizada, ambiente } | { erro }
  const [aAbrirPdf, setAAbrirPdf] = useState(false);

  // O `caminho` devolvido pela SS exige o mesmo Bearer da API — um <a href>
  // direto do browser não consegue autenticar-se lá (daí o PDF "vazio" antes
  // desta correção). Descarrega-se o binário através da própria app (que já
  // sabe autenticar-se aos dois lados) e abre-se como blob local.
  async function abrirDeclaracao() {
    if (!estado?.caminho) return;
    setAAbrirPdf(true);
    try {
      const r = await authFetch(`/api/seguranca-social?action=situacao-contributiva-pdf&caminho=${encodeURIComponent(estado.caminho)}`);
      if (!r.ok) {
        const json = await r.json().catch(() => ({}));
        alert(json.erro || `Erro ao obter o documento (HTTP ${r.status}).`);
        return;
      }
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (e) {
      alert(`Erro de ligação: ${e.message}`);
    } finally {
      setAAbrirPdf(false);
    }
  }

  async function consultar() {
    setEstado({ loading: true });
    try {
      const r = await authFetch('/api/seguranca-social', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'situacao-contributiva',
          ...(nissSolicitado ? { nissSolicitado } : {}),
        }),
      });
      const json = await r.json();
      if (!r.ok) { setEstado({ erro: json.erro || `HTTP ${r.status}` }); return; }
      setEstado({ caminho: json.caminho, regularizada: json.situacaoContributivaRegularizada, ambiente: json.ambiente });
    } catch (e) { setEstado({ erro: e.message }); }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-end gap-3">
        <div>
          <label className="block text-xs text-gray-500 mb-1">NISS a consultar (opcional — por omissão, o da própria empresa)</label>
          <input
            type="text"
            placeholder="ex: 12345678901"
            value={nissSolicitado}
            onChange={e => setNissSolicitado(e.target.value)}
            className="border border-gray-300 rounded px-2 py-1.5 text-sm w-52 focus:outline-none focus:ring-1 focus:ring-[var(--navy)]"
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

      {estado && !estado.loading && !estado.erro && (
        <div className="flex items-center gap-3 pt-1">
          <span
            className="inline-flex items-center px-3 py-1 rounded text-sm font-semibold"
            style={estado.regularizada
              ? { background: 'var(--ok-bg)', color: 'var(--ok)' }
              : { background: 'var(--bad-bg)', color: 'var(--bad)' }}
          >
            {estado.regularizada ? 'Regularizada' : 'Não regularizada'}
          </span>
          {estado.caminho && (
            <button
              onClick={abrirDeclaracao}
              disabled={aAbrirPdf}
              className="text-sm underline disabled:opacity-50"
              style={{ color: 'var(--navy)' }}
            >
              {aAbrirPdf ? 'A abrir…' : 'Ver declaração (PDF)'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Avisos (EEAOC) ───────────────────────────────────────────────────────────
// A sigla EEAOC nunca é definida no PDF original da PSI — não inventar o
// significado, tratar só como "Avisos" na UI.

function AvisosSection() {
  const [estado, setEstado] = useState(null);

  async function consultar() {
    setEstado({ loading: true });
    try {
      const r = await authFetch('/api/seguranca-social?action=avisos');
      const json = await r.json();
      if (!r.ok) { setEstado({ erro: json.erro || `HTTP ${r.status}` }); return; }
      setEstado({ avisos: json.avisos || [], ambiente: json.ambiente, semAvisos: json.semAvisos });
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
          {estado?.loading ? 'A consultar…' : 'Consultar Avisos'}
        </button>
        {estado?.ambiente && <AmbienteBadge ambiente={estado.ambiente} />}
      </div>

      {estado?.erro && <ErroMsg erro={estado.erro} />}
      {estado?.semAvisos && (
        <div className="flex items-center gap-2 text-sm text-gray-500 py-3 px-1">
          <Info size={14} />
          Sem avisos ativos.
        </div>
      )}

      {estado?.avisos?.length > 0 && (
        <div className="space-y-2">
          {estado.avisos.map((av, i) => (
            <div key={i} className="border border-gray-200 rounded p-3">
              <div className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>{av.resumoAviso ?? '—'}</div>
              {av.descricaoAviso && <div className="text-sm text-gray-600 mt-1">{av.descricaoAviso}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Contratos (SOAP, dois passos, polling) ──────────────────────────────────

function ContratosSection() {
  const [form, setForm] = useState({ dataInicio: '', dataFim: '', niss: '' });
  const [estado, setEstado] = useState(null); // null | { loading, msg? } | { dados: [...], ambiente } | { erro }
  const pollRef = useRef(null);

  useEffect(() => () => clearTimeout(pollRef.current), []);

  async function pollConsultar(chave, tentativa = 1) {
    try {
      const r = await authFetch('/api/seguranca-social', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'consultar-contratos', chave }),
      });
      const json = await r.json();
      // O backend só devolve HTTP não-200 para "erro"/"expirado" — "processando" vem sempre com 200.
      if (!r.ok) { setEstado({ erro: json.erro || `HTTP ${r.status}` }); return; }
      if (json.estado === 'processando') {
        if (tentativa >= 8) { setEstado({ erro: 'Ainda em processamento, tente consultar novamente.' }); return; }
        pollRef.current = setTimeout(() => pollConsultar(chave, tentativa + 1), 2000);
        setEstado({ loading: true, msg: 'A processar…' });
        return;
      }
      setEstado({ dados: json.contratos || [], semRegistos: json.estado === 'sem_resultados' });
    } catch (e) { setEstado({ erro: e.message }); }
  }

  async function consultar() {
    if (!form.dataInicio || !form.dataFim) { setEstado({ erro: 'Datas de início e fim são obrigatórias.' }); return; }
    setEstado({ loading: true, msg: 'A pesquisar…' });
    try {
      const r = await authFetch('/api/seguranca-social', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'pesquisar-contratos',
          dataInicio: form.dataInicio,
          dataFim: form.dataFim,
          nissTrabalhadores: form.niss ? [form.niss.trim()] : [],
        }),
      });
      const json = await r.json();
      if (!r.ok) { setEstado({ erro: json.erro || `HTTP ${r.status}` }); return; }
      pollConsultar(json.chave);
    } catch (e) { setEstado({ erro: e.message }); }
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
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
        <div>
          <label className="block text-xs text-gray-500 mb-1">NISS trabalhador (opcional)</label>
          <input type="text" placeholder="ex: 12345678901" value={form.niss} onChange={e => setForm(f => ({ ...f, niss: e.target.value }))}
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
            {estado?.loading ? (estado.msg || 'A consultar…') : 'Consultar'}
          </button>
        </div>
      </div>

      {estado?.erro && <ErroMsg erro={estado.erro} />}
      {estado?.semRegistos && <SemRegistos />}

      {estado?.dados?.length > 0 && (
        <div className="overflow-x-auto">
          <table className="min-w-full text-xs border-collapse">
            <thead>
              <tr className="bg-gray-50 text-gray-600">
                {['NISS', 'Nome', 'Modalidade', 'Início', 'Fim', 'Remuneração Base (€)', 'Motivo'].map(h => (
                  <th key={h} className="px-3 py-2 text-left border border-gray-200">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {estado.dados.map((c, i) => (
                <tr key={i} className="odd:bg-white even:bg-gray-50">
                  <td className="px-3 py-1.5 border border-gray-200 font-mono">{c.nissTrabalhador ?? '—'}</td>
                  <td className="px-3 py-1.5 border border-gray-200">{c.nomeTrabalhador ?? '—'}</td>
                  <td className="px-3 py-1.5 border border-gray-200">{c.modalidadeContrato ?? '—'}</td>
                  <td className="px-3 py-1.5 border border-gray-200">{c.inicioContrato ?? '—'}</td>
                  <td className="px-3 py-1.5 border border-gray-200">{c.fimContrato ?? '—'}</td>
                  <td className="px-3 py-1.5 border border-gray-200 text-right">{c.remuneracaoBase ?? '—'}</td>
                  <td className="px-3 py-1.5 border border-gray-200">{c.motivoContrato ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Trabalhadores (SOAP, dois passos, polling — menor confiança, ver _soapUtils.js) ──

function TrabalhadoresSection() {
  const [form, setForm] = useState({ dataInicio: '', dataFim: '', niss: '' });
  const [estado, setEstado] = useState(null);
  const pollRef = useRef(null);

  useEffect(() => () => clearTimeout(pollRef.current), []);

  const dias = form.dataInicio && form.dataFim
    ? (new Date(form.dataFim) - new Date(form.dataInicio)) / 86400000
    : null;
  const intervaloInvalido = dias != null && (dias < 0 || dias > 90);

  async function pollConsultar(chave, tentativa = 1) {
    try {
      const r = await authFetch('/api/seguranca-social', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'consultar-trabalhadores-ss', chave }),
      });
      const json = await r.json();
      // O backend só devolve HTTP não-200 para "erro"/"expirado" — "processando" vem sempre com 200.
      if (!r.ok) { setEstado({ erro: json.erro || `HTTP ${r.status}` }); return; }
      if (json.estado === 'processando') {
        if (tentativa >= 8) { setEstado({ erro: 'Ainda em processamento, tente consultar novamente.' }); return; }
        pollRef.current = setTimeout(() => pollConsultar(chave, tentativa + 1), 2000);
        setEstado({ loading: true, msg: 'A processar…' });
        return;
      }
      setEstado({ dados: json.trabalhadores || [], semRegistos: json.estado === 'sem_resultados' });
    } catch (e) { setEstado({ erro: e.message }); }
  }

  async function consultar() {
    if (!form.dataInicio || !form.dataFim) { setEstado({ erro: 'Datas de início e fim são obrigatórias.' }); return; }
    if (intervaloInvalido) { setEstado({ erro: 'O intervalo entre data início e data fim não pode exceder 90 dias.' }); return; }
    setEstado({ loading: true, msg: 'A pesquisar…' });
    try {
      const r = await authFetch('/api/seguranca-social', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'pesquisar-trabalhadores-ss',
          dataInicio: form.dataInicio,
          dataFim: form.dataFim,
          niss: form.niss ? form.niss.trim() : undefined,
        }),
      });
      const json = await r.json();
      if (!r.ok) { setEstado({ erro: json.erro || `HTTP ${r.status}` }); return; }
      pollConsultar(json.chave);
    } catch (e) { setEstado({ erro: e.message }); }
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Data início</label>
          <input type="date" value={form.dataInicio} onChange={e => setForm(f => ({ ...f, dataInicio: e.target.value }))}
            className="border border-gray-300 rounded px-2 py-1.5 text-sm w-full focus:outline-none focus:ring-1 focus:ring-[var(--navy)]" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Data fim (máx. 90 dias)</label>
          <input type="date" value={form.dataFim} onChange={e => setForm(f => ({ ...f, dataFim: e.target.value }))}
            className="border border-gray-300 rounded px-2 py-1.5 text-sm w-full focus:outline-none focus:ring-1 focus:ring-[var(--navy)]" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">NISS trabalhador (opcional)</label>
          <input type="text" placeholder="ex: 12345678901" value={form.niss} onChange={e => setForm(f => ({ ...f, niss: e.target.value }))}
            className="border border-gray-300 rounded px-2 py-1.5 text-sm w-full focus:outline-none focus:ring-1 focus:ring-[var(--navy)]" />
        </div>
        <div className="flex items-end gap-2">
          <button
            onClick={consultar}
            disabled={estado?.loading || intervaloInvalido}
            className="flex items-center gap-1.5 px-3 py-1.5 border rounded text-sm disabled:opacity-50 hover:bg-[var(--surface)] transition-colors"
            style={{ borderColor: FT.slate, color: 'var(--ink-soft)' }}
          >
            <Search size={13} />
            {estado?.loading ? (estado.msg || 'A consultar…') : 'Consultar'}
          </button>
        </div>
      </div>

      {intervaloInvalido && dias > 90 && (
        <div className="text-xs" style={{ color: 'var(--bad)' }}>O intervalo entre as duas datas não pode exceder 90 dias.</div>
      )}

      {estado?.erro && <ErroMsg erro={estado.erro} />}
      {estado?.semRegistos && <SemRegistos />}

      {estado?.dados?.length > 0 && (
        <div className="overflow-x-auto">
          <table className="min-w-full text-xs border-collapse">
            <thead>
              <tr className="bg-gray-50 text-gray-600">
                {['NISS', 'Nome', 'Tipo', 'Início Vínculo', 'Fim Vínculo', 'Estabelecimento(s)'].map(h => (
                  <th key={h} className="px-3 py-2 text-left border border-gray-200">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {estado.dados.map((t, i) => (
                <tr key={i} className="odd:bg-white even:bg-gray-50">
                  <td className="px-3 py-1.5 border border-gray-200 font-mono">{t.nissPS ?? '—'}</td>
                  <td className="px-3 py-1.5 border border-gray-200">{t.nomePS ?? '—'}</td>
                  <td className="px-3 py-1.5 border border-gray-200">{t.tipoQlf ?? '—'}</td>
                  <td className="px-3 py-1.5 border border-gray-200">{t.dataInicioQlf ?? '—'}</td>
                  <td className="px-3 py-1.5 border border-gray-200">{t.dataFimQlf ?? '—'}</td>
                  <td className="px-3 py-1.5 border border-gray-200">
                    {t.estabelecimentos?.length
                      ? t.estabelecimentos.map(e => e.designacaoDistrito || e.codigoEstabelecimento).filter(Boolean).join(', ')
                      : '—'}
                  </td>
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
  const [ssAmbiente, setSsAmbiente] = useState('teste');

  useEffect(() => {
    authFetch('/api/seguranca-social?action=status')
      .then(r => r.json())
      .then(d => { if (d.ambiente) setSsAmbiente(d.ambiente); })
      .catch(() => {});
  }, []);

  const abas = [
    { id: 'comprovativos',        label: 'Comprovativos de Pagamento',   icon: CheckCircle    },
    { id: 'documentos-pagamento', label: 'Documentos de Pagamento',      icon: FileText       },
    { id: 'remuneracoes',         label: 'Remunerações Permanentes',     icon: TrendingUp     },
    { id: 'situacao-contributiva', label: 'Situação Contributiva',       icon: ShieldCheck    },
    { id: 'avisos',                label: 'Avisos',                     icon: Bell           },
    { id: 'contratos',             label: 'Contratos',                  icon: FileSignature  },
    { id: 'trabalhadores',         label: 'Trabalhadores',              icon: Users          },
  ];

  return (
    <div className="space-y-4">
      <SubTabBar tabs={abas} activeTab={aba} onTabChange={setAba} />

      <div className="pt-1">
        {aba === 'comprovativos'         && <ComprovativosSection />}
        {aba === 'documentos-pagamento'  && <DocumentosPagamentoSection ssAmbiente={ssAmbiente} />}
        {aba === 'remuneracoes'          && <RemuneracoesSection />}
        {aba === 'situacao-contributiva' && <SituacaoContributivaSection />}
        {aba === 'avisos'                && <AvisosSection />}
        {aba === 'contratos'             && <ContratosSection />}
        {aba === 'trabalhadores'         && <TrabalhadoresSection />}
      </div>
    </div>
  );
}
