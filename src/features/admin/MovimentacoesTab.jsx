import React, { useState, useEffect, useRef } from 'react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  CheckCircle, AlertCircle, ChevronDown, ChevronUp,
  X, Loader2, Download, FileText, FileArchive, MessageSquare, Undo2,
  ArrowLeftRight, Link, Tag, Trash2, Zap, Plus, Receipt,
  TrendingUp, TrendingDown, UserCheck, FileMinus, Percent,
  RefreshCw, Upload,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';

// ── Constantes ────────────────────────────────────────────────────────────────

const MESES = { '01': 'Jan', '02': 'Fev', '03': 'Mar', '04': 'Abr', '05': 'Mai', '06': 'Jun', '07': 'Jul', '08': 'Ago', '09': 'Set', '10': 'Out', '11': 'Nov', '12': 'Dez' };

const INTERNO_KEYWORDS = [
  'TRF INTERNA', 'TRANSF INTERNA', 'TRANSFERENCIA INTERNA',
  'TRF ENTRE CONTAS', 'TRANSFERENCIA ENTRE CONTAS',
  'CONTA PROPRIA', 'PROPRIA CONTA',
  'MAGNETIC PLACE'
];

const IMPOSTO_KEYWORDS = ['PAGTO AO ESTADO', 'PGT TSU'];

const BANCO_KEYWORDS = [
  'COMISSÃO DE MANUTENÇÃO', 'MANUTENÇÃO DE CONTA',
  'IMPOSTO SELO', 'DEB IMPOSTO SELO',
  'COMISSÃO', 'TARIFA', 'TAXE', 'COMMISSION',
  'COMISSAO', 'COMISSÃO DE', 'DEB COMISSÃO',
];

// Status internos (não mudam com tipo da tx)
const STATUS_KEYS = {
  COM_CLIENTE:  'Com Cliente',
  COM_RECIBO:   'Com Recibo',
  COM_FATURA:   'Com Fatura',
  NOTA_CREDITO: 'Nota Crédito',
  INTERNO:      'Interno',
  IMPOSTO:      'Imposto',
  JUSTIFICADO:  'Justificado',
  SEM_CLIENTE:  'Sem Cliente',
};

const STATUS_CFG = {
  'Com Cliente':  { bg: 'bg-emerald-100', text: 'text-emerald-700', icon: CheckCircle },
  'Com Recibo':   { bg: 'bg-teal-100',    text: 'text-teal-700',    icon: UserCheck },
  'Com Fatura':   { bg: 'bg-orange-100',  text: 'text-orange-700',  icon: FileMinus },
  'Nota Crédito': { bg: 'bg-blue-100',    text: 'text-blue-700',    icon: Link },
  'Com NC':       { bg: 'bg-indigo-100',  text: 'text-indigo-700',  icon: FileText },
  'Interno':      { bg: 'bg-purple-100',  text: 'text-purple-700',  icon: ArrowLeftRight },
  'Imposto':      { bg: 'bg-amber-100',   text: 'text-amber-700',   icon: AlertCircle },
  'Justificado':  { bg: 'bg-violet-100',  text: 'text-violet-700',  icon: MessageSquare },
  'Sem Cliente':  { bg: 'bg-amber-100',   text: 'text-amber-700',   icon: AlertCircle },
};

function isTaxaBancaria(desc) {
  if (!desc) return false;
  const descUpper = String(desc).toUpperCase();
  return BANCO_KEYWORDS.some(k => descUpper.includes(k));
}

// Labels visuais dependentes do tipo da transacção
function labelStatus(status, tipo, ncEntry, faturasData, descricao) {
  if (status === 'Interno' && descricao && isTaxaBancaria(descricao)) return 'Taxa Bancária';
  if (tipo === 'debito') {
    if (status === 'Com Cliente')  return 'Com Fatura';
    if (status === 'Nota Crédito') return 'Fatura';
    if (status === 'Sem Cliente')  return 'Sem Fatura';
  }
  if (status === 'Nota Crédito') {
    if (ncEntry && faturasData) {
      const isFornecedorNc = faturasData.some(f => f.id === ncEntry.client_id && f.dados?.numero_fatura?.startsWith('NC'));
      return isFornecedorNc ? 'Com NC' : 'Cliente';
    }
    return 'Cliente';
  }
  if (status === 'Sem Cliente')  return 'Sem Entrada';
  return status;
}

// ── Utilitários ───────────────────────────────────────────────────────────────

function fmtEur(v) {
  return (parseFloat(v) || 0).toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}

function fmtMes(yyyymm) {
  if (!yyyymm) return '—';
  const [ano, mm] = yyyymm.split('-');
  return `${MESES[mm] || mm} ${ano}`;
}

function txKey(tx) {
  return `${tx.data}|${tx.descricao}|${tx.valor}`;
}

function extractMonthYearName(transactionsJson) {
  if (!transactionsJson || transactionsJson.length === 0) return null;
  const firstDate = transactionsJson[0]?.data;
  if (!firstDate) return null;
  try {
    const date = new Date(firstDate + 'T00:00:00');
    return date.toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' });
  } catch {
    return null;
  }
}

function previousMonth(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  d.setMonth(d.getMonth() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function extractBankName(desc) {
  const patterns = [
    /TRF\s+IMEDIATA\s+DE\s+/i, /TRANSFERENCIA\s+DE\s+/i,
    /TRANSF(?:ERENCIA)?\s+DE\s+/i, /TRF\s+DE\s+/i,
    /ORDEM\s+DE\s+PAGAMENTO\s+DE\s+/i, /PAGAMENTO\s+DE\s+/i,
    /PAGT\s+DE\s+/i, /RECEBIDO\s+DE\s+/i, /REC\s+DE\s+/i,
  ];
  for (const p of patterns) {
    const m = String(desc || '').match(p);
    if (m) return String(desc).slice(m.index + m[0].length).trim();
  }
  return String(desc || '').trim();
}

function normName(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\b(unipessoal|lda|s\.?a\.?|ltd|sa|sl|srl|eirl|me|eireli|inc|llc|gmbh|bv)\b/gi, '')
    .replace(/[.,\-&']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function sigTokens(name) {
  return normName(name).split(' ').filter(w => w.length >= 3);
}

function matchClientByTokens(descricao, clients) {
  const descNorm = normName(descricao || '');
  let bestMatch = null;
  let bestScore = 0;
  for (const client of (clients || [])) {
    const tokens = sigTokens(client.name || '');
    if (tokens.length === 0) continue;
    const hits = tokens.filter(t => descNorm.includes(t)).length;
    const score = hits / tokens.length;
    if (hits >= 1 && score >= 0.75 && score > bestScore) {
      bestScore = score;
      bestMatch = client;
    }
  }
  return bestMatch;
}

function clienteLink(tx, notasCredito) {
  return notasCredito?.find(n => n.tx_key === txKey(tx));
}

function statusTx(tx, pagamentos, justificacoes, internos, notasCredito, reciboLinks, faturaLinks, impostos) {
  const key = txKey(tx);
  if (notasCredito?.some(n => n.tx_key === key)) return STATUS_KEYS.COM_CLIENTE;
  if (pagamentos?.some(p => p.transaction_data?.data === tx.data && p.transaction_data?.descricao === tx.descricao && String(p.transaction_data?.valor) === String(tx.valor))) return STATUS_KEYS.COM_CLIENTE;
  if (impostos?.some(i => i.tx_key === key)) return STATUS_KEYS.IMPOSTO;
  if (reciboLinks?.some(r => r.tx_key === key)) return STATUS_KEYS.COM_RECIBO;
  if (faturaLinks?.some(f => f.tx_key === key)) return STATUS_KEYS.COM_FATURA;
  if (internos?.some(i => i.tx_key === key)) return STATUS_KEYS.INTERNO;
  if (impostos?.some(i => i.tx_key === key)) return STATUS_KEYS.IMPOSTO;
  if (justificacoes?.some(j => j.tx_key === key)) return STATUS_KEYS.JUSTIFICADO;
  return STATUS_KEYS.SEM_CLIENTE;
}

// Normalização para matching de nomes de trabalhadores
function normWorker(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[.,\-&']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function workerScore(descricao, workerName) {
  const descNorm = normWorker(descricao);
  const workerNorm = normWorker(workerName);
  if (!workerNorm || workerNorm.length < 3) return 0;
  if (descNorm.includes(workerNorm) || workerNorm.includes(descNorm)) return 3;
  const tokens = workerNorm.split(' ').filter(w => w.length >= 3);
  if (tokens.length === 0) return 0;
  const hits = tokens.filter(t => descNorm.includes(t)).length;
  return hits;
}

function findBestReceipt(matchedWorkerName, txData, receipts) {
  const prevMonth = previousMonth(txData);
  const txMonth = txData.substring(0, 7);
  const txDay = parseInt(txData.split('-')[2]);
  const receiptMonth = txDay >= 16 ? txMonth : prevMonth;
  const workerNorm = normWorker(matchedWorkerName);
  const workerReceipts = receipts.filter(r => {
    const rNorm = normWorker(r.worker_name);
    return rNorm.includes(workerNorm) || workerNorm.includes(rNorm);
  });
  if (workerReceipts.length === 0) return null;
  return workerReceipts.find(r => r.mes === receiptMonth) || null;
}

// ── Linha de transacção ───────────────────────────────────────────────────────

function TxRow({ tx, pagamentos, justificacoes, internos, notasCredito, reciboLinks, faturaLinks, impostos, faturasData, clients, onJustificar, onRemoverJustificacao, onMarcarInterno, onDesfazerInterno, onMarcarImposto, onDesfazerImposto, onAcaoCliente, onDesfazerCliente, onAcaoRecibo, onDesfazerRecibo, onAcaoFatura, onDesfazerFatura }) {
  const status = statusTx(tx, pagamentos, justificacoes, internos, notasCredito, reciboLinks, faturaLinks, impostos);
  const tipo = tx.tipo; // 'credito' | 'debito'
  const key = txKey(tx);
  const link = clienteLink(tx, pagamentos);
  const clientName = link ? (clients?.find(c => c.id === link.client_id)?.name || link.client_id) : null;
  const justEntry = justificacoes.find(j => j.tx_key === key);
  const ncEntry = notasCredito.find(n => n.tx_key === key);
  const ncClientName = ncEntry ? (clients?.find(c => c.id === ncEntry.client_id)?.name || (faturasData?.find(f => f.id === ncEntry.client_id)?.dados?.fornecedor) || ncEntry.client_id) : null;
  const reciboEntry = reciboLinks?.find(r => r.tx_key === key);
  const faturaEntry = faturaLinks?.find(f => f.tx_key === key);
  const faturaData = faturaEntry ? faturasData?.find(f => f.id === faturaEntry.fatura_id) : null;
  const cfg = STATUS_CFG[status] || STATUS_CFG['Sem Cliente'];
  const Icon = cfg.icon;
  const displayStatus = labelStatus(status, tipo, ncEntry, faturasData, tx.descricao);

  return (
    <div className="px-4 py-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-col gap-1 min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">{tx.data}</span>

            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest ${cfg.bg} ${cfg.text}`}>
              <Icon size={9} /> {displayStatus}
              {ncEntry?.auto_matched && status === STATUS_KEYS.NOTA_CREDITO && (
                <Zap size={8} className="ml-0.5 opacity-60" title="Auto-match" />
              )}
              {internos.find(i2 => i2.tx_key === key)?.auto_matched && status === STATUS_KEYS.INTERNO && (
                <Zap size={8} className="ml-0.5 opacity-60" title="Auto-match" />
              )}
            </span>

            {status === STATUS_KEYS.COM_CLIENTE && clientName && (
              <span className="text-[9px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">{clientName}</span>
            )}
            {status === STATUS_KEYS.COM_RECIBO && reciboEntry && (
              <span className="text-[9px] font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-full">
                {reciboEntry.worker_name} · {fmtMes(reciboEntry.mes)}
                {reciboEntry.auto_matched && <Zap size={8} className="inline ml-0.5 opacity-60" title="Auto-match" />}
              </span>
            )}
            {status === STATUS_KEYS.COM_RECIBO && (
              <button onClick={() => onDesfazerRecibo(tx)}
                className="flex items-center gap-0.5 px-2 py-0.5 rounded-xl text-[9px] font-black uppercase tracking-widest bg-slate-100 text-slate-500 hover:bg-rose-100 hover:text-rose-600 transition-colors">
                <Undo2 size={9} /> Desfazer
              </button>
            )}
            {status === STATUS_KEYS.COM_FATURA && faturaData && (
              <span className="text-[9px] font-bold text-orange-700 bg-orange-50 px-2 py-0.5 rounded-full">
                {faturaData.dados?.fornecedor || '—'}{faturaData.dados?.numero_fatura ? ` · ${faturaData.dados.numero_fatura}` : ''}
                {faturaEntry?.auto_matched && <Zap size={8} className="inline ml-0.5 opacity-60" title="Auto-match" />}
              </span>
            )}
            {status === STATUS_KEYS.COM_FATURA && (
              <button onClick={() => onDesfazerFatura(tx)}
                className="flex items-center gap-0.5 px-2 py-0.5 rounded-xl text-[9px] font-black uppercase tracking-widest bg-slate-100 text-slate-500 hover:bg-rose-100 hover:text-rose-600 transition-colors">
                <Undo2 size={9} /> Desfazer
              </button>
            )}
            {status === STATUS_KEYS.NOTA_CREDITO && ncClientName && (
              <span className="text-[9px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                {ncClientName} · {fmtMes(ncEntry.period)}
              </span>
            )}
            {status === STATUS_KEYS.JUSTIFICADO && (
              <span className="text-[9px] text-slate-400 italic max-w-[200px] truncate" title={justEntry?.justification}>
                "{justEntry?.justification}"
              </span>
            )}

            {status === STATUS_KEYS.NOTA_CREDITO && (
              <button onClick={() => onDesfazerCliente(tx)}
                className="flex items-center gap-0.5 px-2 py-0.5 rounded-xl text-[9px] font-black uppercase tracking-widest bg-slate-100 text-slate-500 hover:bg-rose-100 hover:text-rose-600 transition-colors">
                <Undo2 size={9} /> Desfazer
              </button>
            )}
            {status === STATUS_KEYS.INTERNO && (
              <button onClick={() => onDesfazerInterno(tx)}
                className="flex items-center gap-0.5 px-2 py-0.5 rounded-xl text-[9px] font-black uppercase tracking-widest bg-slate-100 text-slate-500 hover:bg-rose-100 hover:text-rose-600 transition-colors">
                <Undo2 size={9} /> Desfazer
              </button>
            )}
            {status === STATUS_KEYS.IMPOSTO && (
              <span className="text-[9px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
                {fmtMes((tx.data || '').substring(0, 7))}
              </span>
            )}
            {status === STATUS_KEYS.IMPOSTO && (
              <button onClick={() => onDesfazerImposto(tx)}
                className="flex items-center gap-0.5 px-2 py-0.5 rounded-xl text-[9px] font-black uppercase tracking-widest bg-slate-100 text-slate-500 hover:bg-rose-100 hover:text-rose-600 transition-colors">
                <Undo2 size={9} /> Desfazer
              </button>
            )}
            {status === STATUS_KEYS.JUSTIFICADO && (
              <button onClick={() => onRemoverJustificacao(tx)}
                className="flex items-center gap-0.5 px-2 py-0.5 rounded-xl text-[9px] font-black uppercase tracking-widest bg-slate-100 text-slate-500 hover:bg-rose-100 hover:text-rose-600 transition-colors">
                <Undo2 size={9} /> Desfazer
              </button>
            )}
          </div>
          <p className="text-[10px] text-slate-400 truncate max-w-sm" title={tx.descricao}>{tx.descricao}</p>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <span className={`text-[12px] font-bold ${tipo === 'debito' ? 'text-rose-600' : 'text-emerald-700'}`}>
            {tipo === 'debito' ? '-' : ''}{fmtEur(Math.abs(parseFloat(tx.valor) || 0))}
          </span>
          {status === STATUS_KEYS.SEM_CLIENTE && (
            <div className="flex items-center gap-1 flex-wrap justify-end">
              {tipo === 'debito' && (
                <button onClick={() => onAcaoRecibo(tx)}
                  className="flex items-center gap-1 px-2 py-1 rounded-xl text-[9px] font-black uppercase tracking-widest bg-teal-100 text-teal-700 hover:bg-teal-200 transition-colors">
                  <UserCheck size={9} /> Recibo
                </button>
              )}
              {tipo === 'debito' && (
                <button onClick={() => onAcaoFatura(tx)}
                  className="flex items-center gap-1 px-2 py-1 rounded-xl text-[9px] font-black uppercase tracking-widest bg-orange-100 text-orange-700 hover:bg-orange-200 transition-colors">
                  <FileMinus size={9} /> Fatura Doc
                </button>
              )}
              {tipo === 'debito' ? (
                <button onClick={() => onAcaoCliente(tx)}
                  className="flex items-center gap-1 px-2 py-1 rounded-xl text-[9px] font-black uppercase tracking-widest bg-blue-100 text-blue-700 hover:bg-blue-200 transition-colors">
                  <Receipt size={9} /> Fatura
                </button>
              ) : (
                <button onClick={() => onAcaoCliente(tx)}
                  className="flex items-center gap-1 px-2 py-1 rounded-xl text-[9px] font-black uppercase tracking-widest bg-blue-100 text-blue-700 hover:bg-blue-200 transition-colors">
                  <Link size={9} /> Cliente
                </button>
              )}
              <button onClick={() => onMarcarInterno(tx)}
                className="flex items-center gap-1 px-2 py-1 rounded-xl text-[9px] font-black uppercase tracking-widest bg-purple-100 text-purple-700 hover:bg-purple-200 transition-colors">
                <ArrowLeftRight size={9} /> Interno
              </button>
              <button onClick={() => onJustificar(tx)}
                className="flex items-center gap-1 px-2 py-1 rounded-xl text-[9px] font-black uppercase tracking-widest bg-violet-100 text-violet-700 hover:bg-violet-200 transition-colors">
                <MessageSquare size={9} /> Justificar
              </button>
              {tipo === 'debito' && (
                <button onClick={() => onMarcarImposto(tx)}
                  className="flex items-center gap-1 px-2 py-1 rounded-xl text-[9px] font-black uppercase tracking-widest bg-amber-100 text-amber-700 hover:bg-amber-200 transition-colors">
                  <Percent size={9} /> PAGAMENTO IMPOSTO
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Card por mês ──────────────────────────────────────────────────────────────

function MovMesCard({ mes, txs, pagamentos, justificacoes, internos, notasCredito, reciboLinks, faturaLinks, impostos, faturasData, clients, onJustificar, onRemoverJustificacao, onMarcarInterno, onDesfazerInterno, onMarcarImposto, onDesfazerImposto, onAcaoCliente, onDesfazerCliente, onAcaoRecibo, onDesfazerRecibo, onAcaoFatura, onDesfazerFatura, onSelectRun }) {
  const [open, setOpen] = useState(false);
  const semCliente = txs.filter(tx => statusTx(tx, pagamentos, justificacoes, internos, notasCredito, reciboLinks, faturaLinks, impostos) === STATUS_KEYS.SEM_CLIENTE).length;
  const allOk = semCliente === 0;
  const totalMes = txs.reduce((s, tx) => {
    const v = parseFloat(tx.valor) || 0;
    return s + (tx.tipo === 'debito' ? -Math.abs(v) : Math.abs(v));
  }, 0);

  return (
    <div className="border border-slate-200 rounded-2xl overflow-hidden">
      <button
          onClick={() => setOpen(o => !o)}
          className="w-full flex items-center justify-between px-4 py-3 bg-white hover:bg-slate-50 transition-colors text-left"
        >
          <div className="flex items-center gap-3">
            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${allOk ? 'bg-emerald-500' : 'bg-amber-400'}`} />
            <button
              onClick={e => { e.stopPropagation(); onSelectRun && txs[0]?.run_id && onSelectRun(txs[0].run_id); }}
              className="text-sm font-bold text-indigo-600 hover:text-indigo-800 hover:underline"
              title="Clique para ver este mês num extrato específico"
            >{fmtMes(mes)}</button>
            <span className="text-[10px] text-slate-400">{txs.length} transacção(ões)</span>
          </div>
        <div className="flex items-center gap-3">
          <span className={`text-[11px] font-black ${totalMes < 0 ? 'text-rose-600' : 'text-slate-600'}`}>
            {totalMes < 0 ? '-' : ''}{fmtEur(Math.abs(totalMes))}
          </span>
          <span className={`text-[10px] font-black uppercase tracking-widest ${allOk ? 'text-emerald-600' : 'text-amber-600'}`}>
            {allOk ? 'Tudo Ok' : `${semCliente} s/ resolver`}
          </span>
          {open ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
        </div>
      </button>

      {open && (
        <div className="divide-y divide-slate-100 bg-slate-50">
          {txs.map((tx, i) => (
            <TxRow
              key={i}
              tx={tx}
              pagamentos={pagamentos}
              justificacoes={justificacoes}
              internos={internos}
              notasCredito={notasCredito}
              reciboLinks={reciboLinks}
              faturaLinks={faturaLinks}
              impostos={impostos}
              faturasData={faturasData}
              clients={clients}
              onJustificar={onJustificar}
              onRemoverJustificacao={onRemoverJustificacao}
              onMarcarInterno={onMarcarInterno}
              onDesfazerInterno={onDesfazerInterno}
              onMarcarImposto={onMarcarImposto}
              onDesfazerImposto={onDesfazerImposto}
              onAcaoCliente={onAcaoCliente}
              onDesfazerCliente={onDesfazerCliente}
              onAcaoRecibo={onAcaoRecibo}
              onDesfazerRecibo={onDesfazerRecibo}
              onAcaoFatura={onAcaoFatura}
              onDesfazerFatura={onDesfazerFatura}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function MovimentacoesTab() {
  const { supabase, clients } = useApp();

  const [allTxs, setAllTxs] = useState([]);
  const [pagamentos, setPagamentos] = useState([]);
  const [justificacoes, setJustificacoes] = useState([]);
  const [internos, setInternos] = useState([]);
  const [impostos, setImpostos] = useState([]);
  const [notasCredito, setNotasCredito] = useState([]);
  const [reciboLinks, setReciboLinks] = useState([]);
  const [faturaLinks, setFaturaLinks] = useState([]);
  const [faturasData, setFaturasData] = useState([]);
  const [receipts, setReceipts] = useState([]);
  const [salarialAliases, setSalarialAliases] = useState([]);
  const [aliases, setAliases] = useState([]);
  const [runId, setRunId] = useState(null);
  const [runData, setRunData] = useState(null);
  const [activeRunId, setActiveRunId] = useState(null);
  const [allRuns, setAllRuns] = useState([]);
  const [loading, setLoading] = useState(false);
  const [autoMatching, setAutoMatching] = useState(false);
  const [autoMatchCount, setAutoMatchCount] = useState(null);
  const [exportingZip, setExportingZip] = useState(false);
  const [exportProgress, setExportProgress] = useState({ current: 0, total: 0 });
  const [showAliases, setShowAliases] = useState(false);
  const [filter, setFilter] = useState('all'); // 'all' | 'entradas' | 'saidas'

  // Modal: fatura de fornecedor
  const [faturaModal, setFaturaModal] = useState(null);
  const [faturaSelId, setFaturaSelId] = useState('');
  const [faturaSaving, setFaturaSaving] = useState(false);

  // Modal: recibo de trabalhador
  const [reciboModal, setReciboModal] = useState(null);
  const [reciboWorkerId, setReciboWorkerId] = useState('');
  const [reciboWorkerName, setReciboWorkerName] = useState('');
  const [reciboMes, setReciboMes] = useState('');
  const [reciboSaving, setReciboSaving] = useState(false);

  // Modal: cliente/fatura (usado para entradas E saídas)
  const [ncModal, setNcModal] = useState(null);
  const [ncClientId, setNcClientId] = useState('');
  const [ncPeriod, setNcPeriod] = useState('');
  const [ncNotas, setNcNotas] = useState('');
  const [ncSaveAlias, setNcSaveAlias] = useState(false);
  const [ncAliasName, setNcAliasName] = useState('');
  const [ncSaving, setNcSaving] = useState(false);

  // Modal: interno
  const [internoModal, setInternoModal] = useState(null);
  const [internoSaveAlias, setInternoSaveAlias] = useState(false);
  const [internoAliasName, setInternoAliasName] = useState('');
  const [internoSaving, setInternoSaving] = useState(false);

  // Modal: imposto
  const [impostoModal, setImpostoModal] = useState(null);
  const [impostoSaveAlias, setImpostoSaveAlias] = useState(false);
  const [impostoAliasName, setImpostoAliasName] = useState('');
  const [impostoSaving, setImpostoSaving] = useState(false);

  // Modal: justificação
  const [justModal, setJustModal] = useState(null);
  const [justText, setJustText] = useState('');
  const [justSaving, setJustSaving] = useState(false);

  // Modal: adicionar alias manualmente
  const [addAliasModal, setAddAliasModal] = useState(false);
  const [addAliasName, setAddAliasName] = useState('');
  const [addAliasResolucao, setAddAliasResolucao] = useState('interno');
  const [addAliasClientId, setAddAliasClientId] = useState('');
  const [addAliasSaving, setAddAliasSaving] = useState(false);

  const [showExportMenu, setShowExportMenu] = useState(false);
  const exportRef = useRef(null);

  // ── Upload state (from ReconciliacaoAdmin) ───────────────────────────────────
  const [ficheiros, setFicheiros] = useState([]);
  const [dragging, setDragging] = useState(false);
  const [processando, setProcessando] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [erro, setErro] = useState(null);
  const [previewTransacoes, setPreviewTransacoes] = useState(null);
  const [previewFilename, setPreviewFilename] = useState('');
  const [selTransacoes, setSelTransacoes] = useState(new Set());
  const [txSearch, setTxSearch] = useState('');
  const [txTipoFiltro, setTxTipoFiltro] = useState('todos');
  const [csvMapping, setCsvMapping] = useState(null);
  const [colMap, setColMap] = useState({ dataCol: '', valorCol: '', descricaoCol: '', debitoCol: '', creditoCol: '', tipoCol: '', modo: 'valor' });
  const [runMonthYear, setRunMonthYear] = useState({});
  const inputRef = useRef(null);

  useEffect(() => {
    const handleClick = (e) => {
      if (exportRef.current && !exportRef.current.contains(e.target)) setShowExportMenu(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  useEffect(() => {
    if (activeRunId === null && allRuns.length > 0) {
      loadRun(undefined);
    }
  }, [activeRunId]);

  // ── Load run data ──────────────────────────────────────────────────────────

  const loadRun = async (overrideRunId) => {
    if (!supabase) return;

    // "Mostrar todos" — load all runs
    if (overrideRunId === undefined && activeRunId === null) {
      setLoading(true);
      try {
        const { data: allRunsData, error: runsErr } = await supabase
          .from('reconciliation_runs')
          .select('id, filename, created_at')
          .order('created_at', { ascending: false })
          .limit(20);

        if (runsErr) { console.error('Erro ao carregar runs:', runsErr); setLoading(false); return; }
        if (!allRunsData?.length) { setLoading(false); return; }

        // Collect all transactions from all runs
        const allTxsMerged = [];
        for (const run of allRunsData) {
          const { data: runTxs } = await supabase
            .from('reconciliation_runs')
            .select('transactions_json')
            .eq('id', run.id)
            .single();
          if (runTxs?.transactions_json) allTxsMerged.push(...runTxs.transactions_json.map(t => ({ ...t, run_id: run.id })));
        }

        setRunId(null);
        setRunData(null);
        setAllTxs(allTxsMerged);
        setAllRuns(allRunsData);

        // Populate runMonthYear for all runs
        for (const run of allRunsData) {
          const { data: runTxs } = await supabase
            .from('reconciliation_runs')
            .select('transactions_json')
            .eq('id', run.id)
            .single();
          if (runTxs?.transactions_json?.length) {
            const monthYear = extractMonthYearName(runTxs.transactions_json);
            if (monthYear) setRunMonthYear(prev => ({ ...prev, [run.id]: monthYear }));
          }
        }

        // Load all linked data for all runs
        const runIds = allRunsData.map(r => r.id);
const [{ data: pags }, { data: just }, { data: ints }, { data: imps }, { data: ncs }, { data: als }, { data: rls }, { data: recs }, { data: fats }] = await Promise.all([
          supabase.from('faturacao_clientes_pagamentos').select('transaction_data, client_id, period, reconciliation_run_id').in('reconciliation_run_id', runIds),
          supabase.from('entrada_justifications').select('tx_key, justification, run_id').in('run_id', runIds),
          supabase.from('entrada_internos').select('tx_key, run_id').in('run_id', runIds),
          supabase.from('entrada_impostos').select('tx_key, run_id').in('run_id', runIds),
          supabase.from('entrada_nota_credito_links').select('tx_key, client_id, period, notas, run_id').in('run_id', runIds),
          supabase.from('movimentacoes_aliases').select('id, bank_name, resolucao, client_id'),
          supabase.from('movimentacao_recibo_links').select('tx_key, worker_id, worker_name, mes, auto_matched, run_id').in('run_id', runIds),
          supabase.from('receipt_validations').select('worker_id, worker_name, mes, liquido_extraido').not('estado', 'in', '("erro","invalido")'),
          supabase.from('faturas').select('id, dados, status, tipo, storage_path').order('importado_em', { ascending: false }),
        ]);

        setPagamentos(pags || []);
        setJustificacoes(just || []);
        setInternos(ints || []);
        setImpostos(imps || []);
        setNotasCredito(ncs || []);
        setAliases(als || []);
        setReciboLinks(rls || []);
        const { data: fatLinksAllRuns } = await supabase
          .from('fatura_pagamento_links').select('fatura_id, run_id, tx_key, auto_matched').in('run_id', runIds);
        setFaturaLinks(fatLinksAllRuns || []);
        setFaturasData(fats || []);
      } catch (err) { console.error('Erro em loadRun (todos):', err); }
      setLoading(false);
      return;
    }

    let run;
    if (overrideRunId) {
      const { data } = await supabase
        .from('reconciliation_runs')
        .select('id, filename, created_at')
        .eq('id', overrideRunId)
        .single();
      run = data;
    } else if (activeRunId) {
      const { data } = await supabase
        .from('reconciliation_runs')
        .select('id, filename, created_at')
        .eq('id', activeRunId)
        .single();
      run = data;
    }

    if (!run) {
      const { data } = await supabase
        .from('reconciliation_runs')
        .select('id, filename, created_at')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      run = data;
      if (run) {
        setActiveRunId(run.id);
        setAllRuns(prev => prev.some(r => r.id === run.id) ? prev : [run, ...prev].slice(0, 10));
      }
    }

    if (!run) return;

    const rid = run.id;
    setRunId(rid);
    setRunData(run);

    // Load transactions separately
    const { data: runData } = await supabase
      .from('reconciliation_runs')
      .select('transactions_json')
      .eq('id', rid)
      .single();
    const txs = runData?.transactions_json || [];
    setAllTxs(txs);

    // Populate runMonthYear cache
    if (txs.length > 0) {
      const monthYear = extractMonthYearName(txs);
      if (monthYear) setRunMonthYear(prev => ({ ...prev, [rid]: monthYear }));
    }

    const runYear = new Date(run.created_at).getFullYear();
    const [{ data: pags }, { data: just }, { data: ints }, { data: imps }, { data: ncs }, { data: als }, { data: rls }, { data: salAls }, { data: recs }, { data: fats }, { data: fatLinks }] = await Promise.all([
      supabase.from('faturacao_clientes_pagamentos').select('transaction_data, client_id, period').eq('reconciliation_run_id', rid),
      supabase.from('entrada_justifications').select('tx_key, justification').eq('run_id', rid),
      supabase.from('entrada_internos').select('tx_key').eq('run_id', rid),
      supabase.from('entrada_impostos').select('tx_key').eq('run_id', rid),
      supabase.from('entrada_nota_credito_links').select('tx_key, client_id, period, notas').eq('run_id', rid),
      supabase.from('movimentacoes_aliases').select('id, bank_name, resolucao, client_id'),
      supabase.from('movimentacao_recibo_links').select('tx_key, worker_id, worker_name, mes, auto_matched').eq('run_id', rid),
      supabase.from('reconciliacao_salarial_aliases').select('pattern, worker_name'),
      supabase.from('receipt_validations').select('worker_id, worker_name, mes, liquido_extraido').not('estado', 'in', '("erro","invalido")'),
      supabase.from('faturas').select('id, dados, status, tipo').order('importado_em', { ascending: false }),
      supabase.from('fatura_pagamento_links').select('fatura_id, run_id, tx_key, auto_matched').eq('run_id', rid),
    ]);

    const pagsArr = pags || [];
    const justArr = just || [];
    const intsArr = ints || [];
    const impsArr = imps || [];
    const ncsArr = ncs || [];
    const alsArr = als || [];
    const rlsArr = rls || [];
    const salAlsArr = salAls || [];
    const recsArr = recs || [];

    const fatsArr = fats || [];
    const fatLinksArr = fatLinks || [];
    setPagamentos(pagsArr);
    setJustificacoes(justArr);
    setInternos(intsArr);
    setImpostos(impsArr);
    setNotasCredito(ncsArr);
    setAliases(alsArr);
    setReciboLinks(rlsArr);
    setSalarialAliases(salAlsArr);
    setReceipts(recsArr);
    setFaturasData(fatsArr);
    setFaturaLinks(fatLinksArr);
    setLoading(false);

    const resolvedKeys = new Set([
      ...pagsArr.map(p => `${p.transaction_data?.data}|${p.transaction_data?.descricao}|${p.transaction_data?.valor}`),
      ...justArr.map(j => j.tx_key),
      ...intsArr.map(i => i.tx_key),
      ...ncsArr.map(n => n.tx_key),
      ...rlsArr.map(r => r.tx_key),
      ...fatLinksArr.map(f => f.tx_key),
    ]);

    const unresolved = txs.filter(tx => !resolvedKeys.has(txKey(tx)));
    if (unresolved.length === 0) return;

    setAutoMatching(true);
    let totalCount = 0;
    const { count: faturaCount, insertedKeys: faturaKeys } = await runAutoMatchFaturas(
      unresolved.filter(tx => tx.tipo === 'debito'), fatsArr, rid, fatLinksArr, setFaturaLinks, supabase
    );
    totalCount += faturaCount;

    const { count: splitCount, insertedKeys: splitKeys } = await runAutoMatchFaturasSplit(
      unresolved.filter(tx => tx.tipo === 'debito'), fatsArr, rid, fatLinksArr, setFaturaLinks, supabase
    );
    totalCount += splitCount;
    const faturaAllKeys = new Set([...faturaKeys, ...splitKeys]);

    const debitosParaRecibo = unresolved.filter(tx => tx.tipo === 'debito' && !faturaAllKeys.has(txKey(tx)));
    const reciboCount = await runAutoMatchRecibos(
      debitosParaRecibo, rid, salAlsArr, recsArr, rlsArr, setReciboLinks, supabase
    );
    totalCount += reciboCount;

    const matchCount = await runAutoMatch(unresolved, rid, alsArr, clients, intsArr, impsArr, ncsArr, setInternos, setImpostos, setNotasCredito, setFaturaLinks, supabase, faturaAllKeys, fatsArr);
    totalCount += matchCount;

    const { data: freshNcs } = await supabase.from('entrada_nota_credito_links').select('tx_key, client_id, period').eq('run_id', rid);
    const ncsUpdated = freshNcs || [];
    const linkCount = await runVirtualLinkStep(supabase, rid, txs, fatsArr, ncsUpdated, fatLinksArr, setFaturaLinks);
    totalCount += linkCount;

    if (totalCount > 0) setAutoMatchCount(totalCount);
    setAutoMatching(false);

    const novoBancoFatura = fatsArr.find(f =>
      f.dados?.fornecedor === 'Novo Banco, S.A.' &&
      String(f.dados?.numero_fatura) === '4314117912'
    );
    if (novoBancoFatura) {
      const { data: freshFatLinks } = await supabase
        .from('fatura_pagamento_links')
        .select('fatura_id, tx_key')
        .eq('fatura_id', novoBancoFatura.id)
        .eq('run_id', rid);
      if (freshFatLinks && freshFatLinks.length > 0) {
        updateFaturasPagoIfComplete(fatsArr, freshFatLinks, txs, supabase, rid);
      }
    }

    const { data: freshFatLinks } = await supabase
      .from('fatura_pagamento_links').select('fatura_id, tx_key').eq('run_id', rid);
    const matchedItems = (freshFatLinks || []).map(l => {
      const fat = fatsArr.find(f => f.id === l.fatura_id);
      const tx = txs.find(t => txKey(t) === l.tx_key);
      return { fatura: fat, transacao: tx };
    }).filter(m => m.fatura && m.transacao);
    await autoConfirmarMatched(matchedItems, rid, { matched: matchedItems });
  };

  const handleRunAutoMatch = async () => {
    await loadRun();
  };

  useEffect(() => {
    handleRunAutoMatch();
  }, []);

  useEffect(() => {
    const fetchRuns = async () => {
      if (!supabase) return;
      const { data } = await supabase
        .from('reconciliation_runs')
        .select('id, filename, created_at')
        .order('created_at', { ascending: false })
        .limit(10);
      if (data) setAllRuns(data);
    };
    fetchRuns();
  }, []);

  // ── Upload handlers (from ReconciliacaoAdmin) ───────────────────────────────

  const handleDragOver = (e) => { e.preventDefault(); setDragging(true); };
  const handleDragLeave = () => setDragging(false);
  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    adicionarFicheiros(e.dataTransfer.files);
  };
  const handleFileChange = (e) => {
    adicionarFicheiros(e.target.files);
    e.target.value = '';
  };
  const adicionarFicheiros = (fileList) => {
    setErro(null);
    const validos = [];
    const invalidos = [];
    for (const f of fileList) {
      const ext = f.name.split('.').pop().toLowerCase();
      if (['csv', 'ofx', 'qfx'].includes(ext)) validos.push(f);
      else invalidos.push(f.name);
    }
    if (invalidos.length) setErro(`Formato não suportado: ${invalidos.join(', ')}. Aceites: CSV, OFX, QFX.`);
    if (validos.length) setFicheiros(prev => {
      const existentes = new Set(prev.map(f => f.name));
      return [...prev, ...validos.filter(f => !existentes.has(f.name))];
    });
  };

  const previsar = async () => {
    if (!ficheiros.length) return;
    setPreviewing(true);
    setErro(null);
    setCsvMapping(null);
    const allTx = [];
    let needsMappingData = null;
    for (const f of ficheiros) {
      try {
        const fp = new FormData();
        fp.append('file', f);
        const res = await fetch('/api/reconciliacao/parse', { method: 'POST', body: fp });
        const data = await res.json();
        if (!res.ok) { setErro(data.error || 'Erro ao ler ficheiro.'); continue; }
        if (data.needs_mapping) {
          needsMappingData = data;
          setCsvMapping({ columns: data.columns, preview: data.preview });
          setColMap({ dataCol: '', valorCol: '', descricaoCol: '', debitoCol: '', creditoCol: '', tipoCol: '', modo: 'valor' });
          setPreviewFilename(data.filename || f.name);
          setPreviewing(false);
          return;
        }
        allTx.push(...data.transactions.map(tx => ({ ...tx, _source: f.name })));
      } catch (err) {
        setErro(err.message || 'Erro de rede.');
      }
    }
    if (allTx.length) {
      setPreviewTransacoes(allTx);
      setPreviewFilename(ficheiros.map(f => f.name).join(', '));
      setSelTransacoes(new Set(allTx.map((_, i) => i)));
      setTxSearch('');
      setTxTipoFiltro('todos');
    }
    setFicheiros([]);
    setPreviewing(false);
  };

  const confirmarMapeamento = async () => {
    if (!ficheiros.length) return;
    setPreviewing(true);
    setErro(null);
    try {
      const ficheiroAtual = ficheiros[0];
      const formPayload = new FormData();
      formPayload.append('file', ficheiroAtual);
      formPayload.append('column_mapping', JSON.stringify(colMap));
      const res = await fetch('/api/reconciliacao/parse', { method: 'POST', body: formPayload });
      const data = await res.json();
      if (!res.ok) { setErro(data.error || 'Erro ao ler ficheiro.'); setPreviewing(false); return; }
      const novasTx = data.transactions.map(tx => ({ ...tx, _source: ficheiroAtual.name }));
      setPreviewTransacoes(novasTx);
      setPreviewFilename(ficheiroAtual.name);
      setSelTransacoes(new Set(novasTx.map((_, i) => i)));
      setTxSearch('');
      setTxTipoFiltro('todos');
      setCsvMapping(null);
      setFicheiros(ficheiros.slice(1));
    } catch (err) {
      setErro(err.message || 'Erro de rede.');
    }
    setPreviewing(false);
  };

  const processar = async () => {
    if (!previewTransacoes) return;
    const selected = previewTransacoes.filter((_, i) => selTransacoes.has(i));
    if (!selected.length) { setErro('Seleccione pelo menos um movimento.'); return; }
    setProcessando(true);
    setErro(null);
    try {
      const res = await fetch('/api/reconciliacao/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactions_json: selected, filename: previewFilename }),
      });
      const data = await res.json();
      if (!res.ok) { setErro(data.error || 'Erro ao processar.'); return; }
      setPreviewTransacoes(null);
      setFicheiros([]);
      setActiveRunId(data.run_id);
      setRunId(data.run_id);
      await loadRun(data.run_id);
    } catch (err) {
      setErro(err.message || 'Erro de rede.');
    } finally {
      setProcessando(false);
    }
  };

  async function updateFaturasPagoIfComplete(fatsArr, curFatLinks, txsData, sb, rid) {
    if (!curFatLinks || !curFatLinks.length || !txsData || !txsData.length) return;
    const linkedFatIds = [...new Set(curFatLinks.map(l => l.fatura_id))];

    for (const faturaId of linkedFatIds) {
      const fatura = fatsArr.find(f => f.id === faturaId);
      if (!fatura) continue;
      if (fatura.status === 'PAGO') continue;

      const fornecedor = String(fatura.dados?.fornecedor || '');
      const numFatura = String(fatura.dados?.numero_fatura || '');

      if (fornecedor !== 'Novo Banco, S.A.' || numFatura !== '4314117912') continue;

      const valorTotal = Math.abs(parseFloat(fatura.dados?.valor_total) || 0);
      if (valorTotal <= 0) continue;

      const linksForFatura = curFatLinks.filter(l => l.fatura_id === faturaId);
      let soma = 0;
      for (const link of linksForFatura) {
        const tx = txsData.find(t => txKey(t) === link.tx_key);
        if (tx) soma += Math.abs(parseFloat(tx.valor) || 0);
      }

      if (soma >= valorTotal - 0.01) {
        await sb.from('faturas').update({ status: 'PAGO' }).eq('id', faturaId);
        setFaturasData(prev => prev.map(f => f.id === faturaId ? { ...f, status: 'PAGO' } : f));
      }
    }
  }

  // ── Auto-match ────────────────────────────────────────────────────────────

  async function runAutoMatchFaturas(debitos, fatsArr, rid, curFatLinks, setFatLinks, sb) {
    if (!debitos.length || !fatsArr.length) return { count: 0, insertedKeys: new Set() };
    const existingKeys = new Set(curFatLinks.map(f => f.tx_key));
    const usedFatIds = new Set(curFatLinks.map(f => f.fatura_id));
    const toInsert = [];

    for (const tx of debitos) {
      const key = txKey(tx);
      if (existingKeys.has(key)) continue;
      const valorTx = Math.abs(parseFloat(tx.valor) || 0);

      let bestFatura = null;
      let bestScore = 0;

      for (const f of fatsArr) {
        if (usedFatIds.has(f.id)) continue;
        const valorFat = parseFloat(f.dados?.valor_total) || 0;
        if (Math.abs(valorTx - valorFat) > 0.01) continue;
        const tokens = normName(f.dados?.fornecedor || '').split(' ').filter(w => w.length >= 3);
        if (tokens.length === 0) continue;
        const descNorm = normName(tx.descricao || '');
        const hits = tokens.filter(t => descNorm.includes(t)).length;
        if (hits >= 1 && hits > bestScore) {
          bestScore = hits;
          bestFatura = f;
        }
      }

      if (!bestFatura) continue;
      existingKeys.add(key);
      usedFatIds.add(bestFatura.id);
      toInsert.push({ fatura_id: bestFatura.id, run_id: rid, tx_key: key, auto_matched: true });
    }

    if (toInsert.length === 0) return { count: 0, insertedKeys: new Set() };
    const { data } = await sb.from('fatura_pagamento_links')
      .upsert(toInsert, { onConflict: 'run_id,tx_key' })
      .select('fatura_id, run_id, tx_key, auto_matched');
    if (data) setFatLinks(prev => [...prev, ...data.filter(d => !prev.some(p => p.tx_key === d.tx_key))]);
    return { count: data?.length || 0, insertedKeys: new Set(toInsert.map(r => r.tx_key)) };
  }

  async function runAutoMatchFaturasSplit(debitos, fatsArr, rid, curFatLinks, setFatLinks, sb) {
    if (!debitos.length || !fatsArr.length) return { count: 0, insertedKeys: new Set() };
    const usedFatIds = new Set(curFatLinks.map(f => f.fatura_id));
    const usedTxKeys = new Set(curFatLinks.map(f => f.tx_key));

    const unmatchedDebitos = debitos.filter(tx => !usedTxKeys.has(txKey(tx)));
    const unmatchedFaturas = fatsArr.filter(f => !usedFatIds.has(f.id));

    if (unmatchedDebitos.length === 0 || unmatchedFaturas.length === 0) {
      return { count: 0, insertedKeys: new Set() };
    }

    const debitosPorFornecedor = {};
    for (const tx of unmatchedDebitos) {
      const descNorm = normName(tx.descricao || '');
      const valor = Math.abs(parseFloat(tx.valor) || 0);
      if (!debitosPorFornecedor[descNorm]) debitosPorFornecedor[descNorm] = [];
      debitosPorFornecedor[descNorm].push({ ...tx, _valor: valor });
    }

    const toInsert = [];
    const insertedFatIds = new Set();
    const insertedTxKeys = new Set();

    for (const fatura of unmatchedFaturas) {
      if (insertedFatIds.has(fatura.id)) continue;
      const tokens = normName(fatura.dados?.fornecedor || '').split(' ').filter(w => w.length >= 3);
      if (tokens.length === 0) continue;

      const matchingDebitos = [];
      for (const [descNorm, txs] of Object.entries(debitosPorFornecedor)) {
        const hits = tokens.filter(t => descNorm.includes(t)).length;
        if (hits >= 1) {
          for (const tx of txs) {
            if (!insertedTxKeys.has(txKey(tx))) {
              matchingDebitos.push(tx);
            }
          }
        }
      }

      if (matchingDebitos.length < 2) continue;

      const valorFat = parseFloat(fatura.dados?.valor_total) || 0;
      if (valorFat <= 0) continue;

      const subset = findSubsetSum(matchingDebitos, valorFat);
      if (subset.length > 0) {
        for (const tx of subset) {
          toInsert.push({ fatura_id: fatura.id, run_id: rid, tx_key: txKey(tx), auto_matched: true });
          insertedTxKeys.add(txKey(tx));
        }
        insertedFatIds.add(fatura.id);
      }
    }

    if (toInsert.length === 0) return { count: 0, insertedKeys: new Set() };
    const { data } = await sb.from('fatura_pagamento_links')
      .upsert(toInsert, { onConflict: 'run_id,tx_key' })
      .select('fatura_id, run_id, tx_key, auto_matched');
    if (data) setFatLinks(prev => [...prev, ...data.filter(d => !prev.some(p => p.tx_key === d.tx_key))]);
    return { count: data?.length || 0, insertedKeys: new Set(toInsert.map(r => r.tx_key)) };
  }

  function findSubsetSum(items, target) {
    const tolerance = 0.01;
    const vals = items.map(tx => tx._valor || Math.abs(parseFloat(tx.valor) || 0));

    function backtrack(index, currentSum, path) {
      if (Math.abs(currentSum - target) < tolerance) return path.slice();
      if (currentSum > target || index >= vals.length) return null;
      for (let i = index; i < vals.length; i++) {
        path.push(i);
        const result = backtrack(i + 1, currentSum + vals[i], path);
        if (result) return result;
        path.pop();
      }
      return null;
    }

    const result = backtrack(0, 0, []);
    if (!result) return [];
    return result.map(i => items[i]);
  }

  async function runAutoMatchRecibos(debitos, rid, salAlsArr, recsArr, curRls, setRls, sb) {
    if (!debitos.length || !recsArr.length) return 0;
    const existingKeys = new Set(curRls.map(r => r.tx_key));
    const toInsert = [];

    const descUpper = (s) => (s || '').toUpperCase();
    const isBancoTx = (tx) => BANCO_KEYWORDS.some(k => descUpper(tx.descricao || '').includes(k));
    const isInternoTx = (tx) => INTERNO_KEYWORDS.some(k => descUpper(tx.descricao || '').includes(k));
    const isImpostoTx = (tx) => IMPOSTO_KEYWORDS.some(k => descUpper(tx.descricao || '').includes(k));

    for (const tx of debitos) {
      const key = txKey(tx);
      if (existingKeys.has(key)) continue;
      if (isBancoTx(tx)) continue;
      if (isInternoTx(tx)) continue;
      if (isImpostoTx(tx)) continue;

      let matchedWorkerName = null;

      // 1. Alias salarial: verifica se algum pattern está na descrição
      for (const alias of salAlsArr) {
        if (!alias.pattern) continue;
        const patternNorm = normWorker(alias.pattern);
        const descNorm = normWorker(tx.descricao);
        if (descNorm.includes(patternNorm)) {
          matchedWorkerName = alias.worker_name;
          break;
        }
      }

      // 2. Token scoring por nome de trabalhador (mais permissivo)
      if (!matchedWorkerName) {
        const descClean = normWorker(tx.descricao)
          .replace(/\bp\/\s*/gi, '')
          .replace(/\bapp\s*\d*/gi, '')
          .replace(/\bapp\b/gi, '')
          .replace(/\d+/g, '')
          .replace(/[-&]/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
        const uniqueWorkers = [...new Map(recsArr.map(r => [normWorker(r.worker_name), r])).values()];
        let bestScore = 0;
        for (const receipt of uniqueWorkers) {
          const score = workerScore(descClean, receipt.worker_name);
          if (score >= 1 && score > bestScore) {
            bestScore = score;
            matchedWorkerName = receipt.worker_name;
          }
        }
      }

      if (!matchedWorkerName) continue;

      const bestReceipt = findBestReceipt(matchedWorkerName, tx.data, recsArr);
      if (!bestReceipt) continue;

      // Calcular mes do link a partir da data da transacção
      // Dias 1-15 → mês anterior | Dias 16-31 → mês da transacção
      const txDay = parseInt(tx.data.split('-')[2]);
      const txYear = parseInt(tx.data.substring(0, 4));
      const txMonth = parseInt(tx.data.substring(5, 7));
      let linkMes;
      if (txDay >= 16) {
        linkMes = tx.data.substring(0, 7);
      } else {
        const prevMonth = txMonth === 1 ? 12 : txMonth - 1;
        const prevYear = txMonth === 1 ? txYear - 1 : txYear;
        linkMes = `${prevYear}-${String(prevMonth).padStart(2, '0')}`;
      }

      toInsert.push({
        run_id: rid,
        tx_key: key,
        worker_id: bestReceipt.worker_id || null,
        worker_name: bestReceipt.worker_name,
        mes: linkMes,
        auto_matched: true,
      });
      existingKeys.add(key);
    }

    if (toInsert.length === 0) return 0;
    const { data } = await sb.from('movimentacao_recibo_links').upsert(toInsert, { onConflict: 'run_id,tx_key' }).select('tx_key, worker_id, worker_name, mes, auto_matched');
    if (data) setRls(prev => [...prev, ...data.filter(d => !prev.some(p => p.tx_key === d.tx_key))]);
    return data?.length || 0;
  }

  // Step 5: Ligação virtual para comissões bancárias
  // Executa para TODAS as entradas de crédito (não só unresolved)
  // Quando entrada ≠ fatura cliente, verifica se diferença corresponde a fatura de fornecedor
  async function runVirtualLinkStep(sb, rid, txs, fatsArr, ncsArr, curFatLinks, setFatLinks) {
    let count = 0;

    // Só processa créditos que já têm client_id (Step 3 fez match)
    const creditWithClient = txs.filter(tx =>
      tx.tipo === 'credito' &&
      ncsArr.some(n => n.tx_key === txKey(tx))
    );

    for (const tx of creditWithClient) {
      const key = txKey(tx);
      const clientNc = ncsArr.find(n => n.tx_key === key);
      if (!clientNc) continue;

      const valorTx = Math.abs(parseFloat(tx.valor) || 0);

      // Procurar fatura de cliente (tipo=cliente, status=PENDENTE) com valor > tx.valor
      const clienteFatura = fatsArr.find(f =>
        f.tipo === 'cliente' &&
        f.status === 'PENDENTE' &&
        Number(f.dados?.valor_total) > valorTx + 0.01
      );

      if (!clienteFatura) continue;

      const valorFaturaCliente = Math.abs(parseFloat(clienteFatura.dados?.valor_total) || 0);
      const diferenca = valorFaturaCliente - valorTx;

      // Se diferença está entre 0.01 e 500, procurar fatura com valor ≈ diferença
      if (diferenca > 0.01 && diferenca <= 500.00) {
        const comissaoFatura = fatsArr.find(f =>
          (!f.tipo || f.tipo === 'fornecedor') &&
          f.status === 'PENDENTE' &&
          Math.abs(parseFloat(f.dados?.valor_total || 0) - diferenca) <= 0.01
        );

        if (comissaoFatura) {
          // Criar fatura_pagamento_links se ainda não existir
          const jaLinkado = curFatLinks.some(fl => fl.fatura_id === clienteFatura.id && fl.tx_key === key);
          if (!jaLinkado) {
            await sb.from('fatura_pagamento_links').upsert({
              fatura_id: clienteFatura.id,
              run_id: rid,
              tx_key: key,
              auto_matched: true,
            }, { onConflict: 'fatura_id,tx_key' });
          }

          // Atualizar status das faturas para PAGO
          await sb.from('faturas').update({ status: 'PAGO' }).eq('id', clienteFatura.id);
          await sb.from('faturas').update({ status: 'PAGO' }).eq('id', comissaoFatura.id);
          count++;

          // Atualizar state local
          setFatLinks(prev => [...prev, { fatura_id: clienteFatura.id, run_id: rid, tx_key: key, auto_matched: true }]);
        }
      }
    }

    return count;
  }

  async function runAutoMatch(unresolved, rid, alsArr, clientList, curInternos, curImpostos, curNcs, setInts, setImpostos, setNcs, setFatLinks, sb, extraExcludeKeys = new Set(), fatsArr = []) {
    const toInsertInternos = [];
    const toInsertImpostos = [];
    const toInsertNcs = [];
    const toInsertFaturas = [];
    const existingIntKeys = new Set(curInternos.map(i => i.tx_key));
    const existingImpKeys = new Set(curImpostos.map(i => i.tx_key));
    const existingNcKeys = new Set(curNcs.map(n => n.tx_key));

    for (const tx of unresolved) {
      const key = txKey(tx);
      if (existingIntKeys.has(key) || existingImpKeys.has(key) || existingNcKeys.has(key) || extraExcludeKeys.has(key)) continue;

      const bankName = extractBankName(tx.descricao);
      const bankNorm = normName(bankName);
      const descUpper = String(tx.descricao || '').toUpperCase();

      // 1. Alias explícito (fuzzy match)
      const alias = alsArr.find(a => {
        const aNorm = normName(a.bank_name);
        return bankNorm.includes(aNorm) || aNorm.includes(bankNorm);
      });
      if (alias) {
        if (alias.resolucao === 'interno') {
          toInsertInternos.push({ run_id: rid, tx_key: key });
          existingIntKeys.add(key);
          continue;
        }
        if (alias.resolucao === 'imposto') {
          toInsertImpostos.push({ run_id: rid, tx_key: key });
          existingImpKeys.add(key);
          continue;
        }
        if (alias.resolucao === 'nota_credito' && alias.client_id && tx.tipo === 'credito') {
          toInsertNcs.push({ run_id: rid, tx_key: key, client_id: alias.client_id, period: previousMonth(tx.data) });
          existingNcKeys.add(key);
          continue;
        }
      }

      // 2. Palavras-chave de interno
      if (INTERNO_KEYWORDS.some(k => descUpper.includes(k))) {
        toInsertInternos.push({ run_id: rid, tx_key: key });
        existingIntKeys.add(key);
        continue;
      }

      // 2c. Palavras-chave de imposto
      if (IMPOSTO_KEYWORDS.some(k => descUpper.includes(k))) {
        toInsertImpostos.push({ run_id: rid, tx_key: key });
        existingImpKeys.add(key);
        continue;
      }

      // 2b. Taxa bancária: débitos com keywords de banco
      //    Avaliado DEPOIS de alias para permitir alias sobrescrever
      if (tx.tipo === 'debito' && BANCO_KEYWORDS.some(k => descUpper.includes(k))) {
        const faturaBanco = fatsArr.find(f =>
          f.dados?.fornecedor === 'Novo Banco, S.A.' &&
          String(f.dados?.numero_fatura) === '4314117912'
        );
        if (faturaBanco) {
          toInsertFaturas.push({ fatura_id: faturaBanco.id, run_id: rid, tx_key: key, auto_matched: true });
          existingIntKeys.add(key);
          continue;
        }
        toInsertInternos.push({ run_id: rid, tx_key: key });
        existingIntKeys.add(key);
        continue;
      }

      // 3. Match por tokens de cliente (apenas créditos)
      if (tx.tipo === 'credito') {
        const client = matchClientByTokens(tx.descricao, clientList);
        if (client) {
          toInsertNcs.push({ run_id: rid, tx_key: key, client_id: client.id, period: previousMonth(tx.data) });
          existingNcKeys.add(key);
        }
      }

      // 4. Match créditos com Notas de Crédito de fornecedores (NC na tabela faturas)
      if (tx.tipo === 'credito' && !existingNcKeys.has(key)) {
        const valorTx = Math.abs(parseFloat(tx.valor) || 0);
        const descNorm = normName(tx.descricao || '');
        for (const f of fatsArr) {
          if (!f.dados?.numero_fatura?.startsWith('NC')) continue;
          const valorFat = Math.abs(parseFloat(f.dados?.valor_total) || 0);
          if (Math.abs(valorTx - valorFat) > 0.01) continue;
          const tokens = normName(f.dados?.fornecedor || '').split(' ').filter(w => w.length >= 3);
          if (tokens.length === 0) continue;
          const hits = tokens.filter(t => descNorm.includes(t)).length;
          if (hits >= 1) {
            toInsertNcs.push({ run_id: rid, tx_key: key, client_id: f.id, period: tx.data.substring(0, 7) });
            existingNcKeys.add(key);
            break;
          }
        }
      }

      // 5. Ligação virtual: crédito → fatura cliente pendente → diferença coberta por fatura fornecedor (comissão bancária)
      // Executa mesmo se Step 3 já fez match (existingNcKeys) — precisamos verificar se a fatura cliente fica PAGA
      if (tx.tipo === 'credito' && !toInsertFaturas.some(f => f.tx_key === key)) {
        const valorTx = Math.abs(parseFloat(tx.valor) || 0);

        // a) Procurar fatura de cliente (tipo=cliente, status=PENDENTE) com valor > tx.valor
        const clienteFatura = fatsArr.find(f =>
          f.tipo === 'cliente' &&
          f.status === 'PENDENTE' &&
          Number(f.dados?.valor_total) > valorTx + 0.01
        );

        if (clienteFatura) {
          const valorFaturaCliente = Math.abs(parseFloat(clienteFatura.dados?.valor_total) || 0);
          const diferenca = valorFaturaCliente - valorTx;

          // b) Se diferença está entre 0.01 e 500 (tolerância), procurar fatura pendente com valor ≈ diferença
          if (diferenca > 0.01 && diferenca <= 500.00) {
            const fornecedorFatura = fatsArr.find(f =>
              (!f.tipo || f.tipo === 'fornecedor') &&
              f.status === 'PENDENTE' &&
              Math.abs(parseFloat(f.dados?.valor_total || 0) - diferenca) <= 0.01
            );

            if (fornecedorFatura) {
              // Criar links: entrada → fatura cliente
              toInsertFaturas.push({ fatura_id: clienteFatura.id, run_id: rid, tx_key: key, auto_matched: true });
              // Atualizar status das faturas para PAGO
              sb.from('faturas').update({ status: 'PAGO' }).eq('id', clienteFatura.id).then(() => {});
              sb.from('faturas').update({ status: 'PAGO' }).eq('id', fornecedorFatura.id).then(() => {});
            }
          }
        }
      }
    }

    let count = 0;
    if (toInsertInternos.length > 0) {
      const { data } = await sb.from('entrada_internos').upsert(toInsertInternos, { onConflict: 'run_id,tx_key' }).select('tx_key');
      if (data) {
        const tagged = data.map(d => ({ ...d, auto_matched: true }));
        setInts(prev => [...prev, ...tagged.filter(d => !prev.some(p => p.tx_key === d.tx_key))]);
        count += data.length;
      }
    }
    if (toInsertImpostos.length > 0) {
      const { data } = await sb.from('entrada_impostos').upsert(toInsertImpostos, { onConflict: 'run_id,tx_key' }).select('tx_key');
      if (data) {
        const tagged = data.map(d => ({ ...d, auto_matched: true }));
        setImpostos(prev => [...prev, ...tagged.filter(d => !prev.some(p => p.tx_key === d.tx_key))]);
        count += data.length;
      }
    }
if (toInsertNcs.length > 0) {
      const { data } = await sb.from('entrada_nota_credito_links').upsert(toInsertNcs, { onConflict: 'run_id,tx_key' }).select('tx_key, client_id, period, notas');
      if (data) {
        const tagged = data.map(d => ({ ...d, auto_matched: true }));
        setNcs(prev => [...prev, ...data.filter(d => !prev.some(p => p.tx_key === d.tx_key))]);
        count += data.length;
      }
    }
    if (toInsertFaturas.length > 0) {
      const { data } = await sb.from('fatura_pagamento_links').upsert(toInsertFaturas, { onConflict: 'run_id,tx_key' }).select('fatura_id, run_id, tx_key, auto_matched');
      if (data) {
        setFatLinks(prev => [...prev, ...data.filter(d => !prev.some(p => p.tx_key === d.tx_key))]);
        count += data.length;
      }
    }
    return count;
  }

  // ── Dados derivados ───────────────────────────────────────────────────────

  const creditos = allTxs.filter(t => t.tipo === 'credito');
  const debitos  = allTxs.filter(t => t.tipo === 'debito');
  const filteredTxs = filter === 'entradas' ? creditos : filter === 'saidas' ? debitos : allTxs;

  const getStatus = tx => statusTx(tx, pagamentos, justificacoes, internos, notasCredito, reciboLinks, faturaLinks, impostos);

  const totalResolvido = filteredTxs.filter(tx => getStatus(tx) !== STATUS_KEYS.SEM_CLIENTE).length;
  const semResolver    = filteredTxs.filter(tx => getStatus(tx) === STATUS_KEYS.SEM_CLIENTE).length;
  const totalEntradas  = creditos.reduce((s, tx) => s + Math.abs(parseFloat(tx.valor) || 0), 0);
  const totalSaidas    = debitos.reduce((s, tx) => s + Math.abs(parseFloat(tx.valor) || 0), 0);

  const comClienteCount  = filteredTxs.filter(tx => getStatus(tx) === STATUS_KEYS.COM_CLIENTE).length;
  const comReciboCount   = filteredTxs.filter(tx => getStatus(tx) === STATUS_KEYS.COM_RECIBO).length;
  const comFaturaCount   = filteredTxs.filter(tx => getStatus(tx) === STATUS_KEYS.COM_FATURA).length;
  const notaCreditoCount = filteredTxs.filter(tx => getStatus(tx) === STATUS_KEYS.NOTA_CREDITO).length;
  const internoCount     = filteredTxs.filter(tx => getStatus(tx) === STATUS_KEYS.INTERNO).length;
  const impostoCount     = filteredTxs.filter(tx => getStatus(tx) === STATUS_KEYS.IMPOSTO).length;
  const justCount        = filteredTxs.filter(tx => getStatus(tx) === STATUS_KEYS.JUSTIFICADO).length;

  const grupos = filteredTxs.reduce((acc, tx) => {
    const mes = (tx.data || '').substring(0, 7) || 'Desconhecido';
    (acc[mes] = acc[mes] || []).push(tx);
    return acc;
  }, {});

  const ROW_COLORS = {
    'Com Cliente':   [227, 252, 239],
    'Com Recibo':    [207, 250, 254],
    'Com Fatura':   [254, 235, 222],
    'Nota Crédito': [219, 234, 254],
    'Interno':       [233, 213, 244],
    'Imposto':      [254, 243, 199],
    'Justificado':  [238, 238, 238],
    'Sem Cliente':   [255, 255, 255],
  };

  const buildRowsForTx = (tx) => {
    const status = getStatus(tx);
    const key = txKey(tx);
    const link = notasCredito.find(n => n.tx_key === key);
    const clientName = link ? (clients?.find(c => c.id === link.client_id)?.name || '') : '';
    const ncEntry = link;
    const justEntry = justificacoes.find(j => j.tx_key === key);
    const detalhe = status === STATUS_KEYS.COM_CLIENTE ? clientName
      : status === STATUS_KEYS.JUSTIFICADO ? (justEntry?.justification || '')
      : '';
    const valor = tx.tipo === 'debito' ? `-${fmtEur(Math.abs(parseFloat(tx.valor) || 0))}` : fmtEur(tx.valor);
    return { status, row: [tx.data, tx.tipo === 'debito' ? 'Saída' : 'Entrada', tx.descricao || '', valor, labelStatus(status, tx.tipo, ncEntry, faturasData, tx.descricao), detalhe] };
  };

  const buildRows = () => filteredTxs.map(tx => {
    const { row } = buildRowsForTx(tx);
    return row;
  });

const calcTotals = (txs) => {
    const totCredito = txs.filter(t => t.tipo === 'credito').reduce((s, t) => s + parseFloat(t.valor || 0), 0);
    const totDebito = txs.filter(t => t.tipo === 'debito').reduce((s, t) => s + parseFloat(t.valor || 0), 0);
    const totImposto = txs.filter(t => {
      const key = txKey(t);
      return impostos?.some(i => i.tx_key === key);
    }).reduce((s, t) => s + parseFloat(t.valor || 0), 0);
    const totInterno = txs.filter(t => {
      const key = txKey(t);
      return internos?.some(i => i.tx_key === key);
    }).reduce((s, t) => s + parseFloat(t.valor || 0), 0);
    const totFatura = txs.filter(t => {
      const key = txKey(t);
      return faturaLinks?.some(f => f.tx_key === key);
    }).reduce((s, t) => s + parseFloat(t.valor || 0), 0);
    const totRecibo = txs.filter(t => {
      const key = txKey(t);
      return reciboLinks?.some(r => r.tx_key === key) && !faturaLinks?.some(f => f.tx_key === key);
    }).reduce((s, t) => s + parseFloat(t.valor || 0), 0);
const totSemCliente = txs.filter(t => {
      const key = txKey(t);
      return !impostos?.some(i => i.tx_key === key)
        && !internos?.some(i => i.tx_key === key)
        && !faturaLinks?.some(f => f.tx_key === key)
        && !reciboLinks?.some(r => r.tx_key === key)
        && !notasCredito?.some(n => n.tx_key === key)
        && !justificacoes?.some(j => j.tx_key === key);
    }).reduce((s, t) => s + parseFloat(t.valor || 0), 0);
    const totJustificado = txs.filter(t => {
      const key = txKey(t);
      return justificacoes?.some(j => j.tx_key === key);
    }).reduce((s, t) => s + parseFloat(t.valor || 0), 0);
    const totCliente = txs.filter(t => {
      const key = txKey(t);
      return notasCredito?.some(n => n.tx_key === key);
    }).reduce((s, t) => s + parseFloat(t.valor || 0), 0);
    return { totCredito, totDebito, totImposto, totInterno, totFatura, totRecibo, totCliente, totSemCliente, totJustificado };
  };

  const renderPdfSummary = (doc, y, txs) => {
    const t = calcTotals(txs);
    const linha = (label, valor, r, g, b) => {
      doc.setFillColor(r, g, b);
      doc.rect(14, y, 277, 7, 'F');
      doc.setFontSize(9); doc.setTextColor(30);
      doc.text(label, 16, y + 5);
      doc.setTextColor(0);
      doc.text(fmtEur(valor), 291, y + 5, { align: 'right' });
      y += 8;
    };
    doc.setFontSize(11); doc.setTextColor(30); doc.setFont('helvetica', 'bold');
    doc.text('Resumo', 14, y); y += 6;
    doc.setFont('helvetica', 'normal');
    linha('Total Créditos', t.totCredito, 227, 252, 239);
    linha('Total Débitos', t.totDebito, 254, 235, 222);
    linha(`Imposto (${txs.filter(tx => { const k = txKey(tx); return impostos?.some(i => i.tx_key === k); }).length} transações)`, t.totImposto, 254, 243, 199);
    linha(`Interno (${txs.filter(tx => { const k = txKey(tx); return internos?.some(i => i.tx_key === k); }).length} transações)`, t.totInterno, 233, 213, 244);
    linha(`Com Fatura (${txs.filter(tx => { const k = txKey(tx); return faturaLinks?.some(f => f.tx_key === k); }).length} transações)`, t.totFatura, 254, 235, 222);
    linha(`Com Cliente (${txs.filter(tx => { const k = txKey(tx); return notasCredito?.some(n => n.tx_key === k); }).length} transações)`, t.totCliente, 227, 252, 239);
    linha(`Justificado (${txs.filter(tx => { const k = txKey(tx); return justificacoes?.some(j => j.tx_key === k); }).length} transações)`, t.totJustificado, 238, 238, 238);
    linha(`Sem Cliente (${txs.filter(tx => { const k = txKey(tx); return !impostos?.some(i => i.tx_key === k) && !internos?.some(i => i.tx_key === k) && !faturaLinks?.some(f => f.tx_key === k) && !reciboLinks?.some(r => r.tx_key === k) && !notasCredito?.some(n => n.tx_key === k) && !justificacoes?.some(j => j.tx_key === k); }).length} transações)`, t.totSemCliente, 255, 255, 255);
    return y;
  };

  const getLogoBase64 = async () => {
    try {
      const response = await fetch('/MAGNETIC (3).png');
      const blob = await response.blob();
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.readAsDataURL(blob);
      });
    } catch { return null; }
  };

  const handleExportCsv = () => {
    const esc = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const header = ['Data', 'Tipo', 'Descrição', 'Valor (€)', 'Status', 'Detalhe'].map(esc).join(';');
    const rows = buildRows().map(r => r.map(esc).join(';'));
    const blob = new Blob(['﻿' + [header, ...rows].join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'movimentacoes_validacao.csv'; a.click();
    URL.revokeObjectURL(url);
    setShowExportMenu(false);
  };

  const handleExportPdf = async () => {
    const logoBase64 = await getLogoBase64();
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    if (logoBase64) doc.addImage(logoBase64, 'PNG', 14, 4, 22, 22);
    doc.setFontSize(14); doc.setTextColor(30);
    doc.text('Relatório de Movimentações', logoBase64 ? 42 : 14, 18);
    doc.setFontSize(8); doc.setTextColor(120);
    doc.text(`Gerado em ${new Date().toLocaleDateString('pt-PT')} · Extrato: ${runData?.created_at ? new Date(runData.created_at).toLocaleDateString('pt-PT') : '—'}`, logoBase64 ? 42 : 14, 24);

    let currentY = logoBase64 ? 30 : 28;

    const sortedMeses = Object.keys(grupos).sort((a, b) => b.localeCompare(a));
    for (const mes of sortedMeses) {
      const mesTxs = grupos[mes];
      const mesLabel = fmtMes(mes);

      doc.setFontSize(11); doc.setTextColor(30);
      doc.setFillColor(240, 242, 245);
      doc.rect(14, currentY, 277, 7, 'F');
      doc.text(mesLabel, 16, currentY + 5);
      currentY += 10;

      const mesData = mesTxs.map(tx => buildRowsForTx(tx));
      const body = mesData.map(d => d.row);

      autoTable(doc, {
        startY: currentY,
        head: [['Data', 'Tipo', 'Descrição', 'Valor (€)', 'Status', 'Detalhe']],
        body,
        styles: { fontSize: 6.5, cellPadding: 1.5, lineHeight: 1.2 },
        headStyles: { fillColor: [99, 102, 241], textColor: 255, fontStyle: 'bold' },
        didParseCell: (data) => {
          if (data.section === 'body') {
            const status = mesData[data.row.index]?.status;
            if (status && ROW_COLORS[status]) {
              const [r, g, b] = ROW_COLORS[status];
              data.cell.styles.fillColor = [r, g, b];
            }
          }
        },
        columnStyles: {
          0: { cellWidth: 22 },
          1: { cellWidth: 16 },
          2: { cellWidth: 60, cellStyles: { overflow: 'linebreak' } },
          3: { cellWidth: 22 },
          4: { cellWidth: 28 },
          5: { cellWidth: 50 },
        },
        margin: { left: 14, right: 14 },
        showHead: 'firstPage',
      });

      currentY = doc.lastAutoTable.finalY + 6;

      if (currentY > 180) { doc.addPage(); currentY = 20; }
    }

    doc.addPage();
    doc.setFontSize(16); doc.setTextColor(30);
    doc.text('Resumo Financeiro', 14, 20);
    renderPdfSummary(doc, 28, filteredTxs);
    doc.save('movimentacoes_validacao.pdf');
    setShowExportMenu(false);
  };

  const handleExportZip = async () => {
    setExportingZip(true);
    setExportProgress({ current: 0, total: 0 });
    setShowExportMenu(false);
    try {
      const JSZipLib = (await import('jszip')).default;
      const { jsPDF } = await import('jspdf');
      const autoTable = (await import('jspdf-autotable')).default;
      const logoBase64 = await getLogoBase64();

      const monthLabel = runData
        ? new Date(runData.created_at).toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' })
        : 'todos';
      const safeMonth = monthLabel.replace(/[^a-zA-Z0-9]/g, '');

      const zip = new JSZipLib();
      const relatorioFolder = zip.folder('relatorio');
      const extratoFolder = zip.folder('extrato');
      const faturasFolder = zip.folder('faturas');
      const mesesFolder = zip.folder('meses');

      // ── Relatório PDF único (sem cores, como antes no ZIP) ──────────────────
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      doc.setFontSize(14); doc.setTextColor(30);
      doc.text('Relatório de Movimentações', 14, 18);
      doc.setFontSize(8); doc.setTextColor(120);
      doc.text(`Gerado em ${new Date().toLocaleDateString('pt-PT')} · Extrato: ${runData?.created_at ? new Date(runData.created_at).toLocaleDateString('pt-PT') : 'Todos'}`, 14, 24);
      const rows = buildRows();
      autoTable(doc, {
        startY: 30,
        head: [['Data', 'Tipo', 'Descrição', 'Valor (€)', 'Status', 'Detalhe']],
        body: rows,
        styles: { fontSize: 6.5, cellPadding: 1.3 },
        headStyles: { fillColor: [99, 102, 241], textColor: 255, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        columnStyles: { 2: { cellWidth: 55 }, 5: { cellWidth: 45 } },
      });
      relatorioFolder.file('Relatorio_Movimentacoes.pdf', doc.output('blob'));

      // ── PDFs por mês (com cores) ─────────────────────────────────────────────
      const sortedMeses = Object.keys(grupos).sort((a, b) => b.localeCompare(a));
      for (const mes of sortedMeses) {
        const mesTxs = grupos[mes];
        const mesLabel = fmtMes(mes).replace(/[^a-zA-Z0-9]/g, '_');
        const docMes = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
        if (logoBase64) docMes.addImage(logoBase64, 'PNG', 14, 4, 22, 22);
        docMes.setFontSize(14); docMes.setTextColor(30);
        docMes.text(`Relatório de Movimentações — ${fmtMes(mes)}`, logoBase64 ? 42 : 14, 18);
        docMes.setFontSize(8); docMes.setTextColor(120);
        docMes.text(`Gerado em ${new Date().toLocaleDateString('pt-PT')} · Extrato: ${runData?.created_at ? new Date(runData.created_at).toLocaleDateString('pt-PT') : 'Todos'}`, logoBase64 ? 42 : 14, 24);
        const startY = logoBase64 ? 30 : 28;
        const mesData = mesTxs.map(tx => buildRowsForTx(tx));
        const body = mesData.map(d => d.row);
        autoTable(docMes, {
          startY,
          head: [['Data', 'Tipo', 'Descrição', 'Valor (€)', 'Status', 'Detalhe']],
          body,
          styles: { fontSize: 6.5, cellPadding: 1.5, lineHeight: 1.2 },
          headStyles: { fillColor: [99, 102, 241], textColor: 255, fontStyle: 'bold' },
          didParseCell: (data) => {
            if (data.section === 'body') {
              const status = mesData[data.row.index]?.status;
              if (status && ROW_COLORS[status]) {
                const [r, g, b] = ROW_COLORS[status];
                data.cell.styles.fillColor = [r, g, b];
              }
            }
          },
          columnStyles: {
            0: { cellWidth: 22 },
            1: { cellWidth: 16 },
            2: { cellWidth: 60, cellStyles: { overflow: 'linebreak' } },
            3: { cellWidth: 22 },
            4: { cellWidth: 28 },
            5: { cellWidth: 50 },
          },
          margin: { left: 14, right: 14 },
          showHead: 'firstPage',
        });
        docMes.addPage();
        docMes.setFontSize(16); docMes.setTextColor(30);
        docMes.text(`Resumo — ${fmtMes(mes)}`, 14, 20);
        renderPdfSummary(docMes, 28, mesTxs);
        mesesFolder.file(`Relatorio_${mesLabel}.pdf`, docMes.output('blob'));
      }

      // ── Extrato CSV ────────────────────────────────────────────────────────
      const txStatus = (tx) => {
        const key = txKey(tx);
        if (notasCredito.some(n => n.tx_key === key)) return 'Com Cliente';
        if (faturaLinks.some(f => f.tx_key === key)) return 'Com Fatura';
        if (reciboLinks.some(r => r.tx_key === key)) return 'Com Recibo';
        if (internos.some(i => i.tx_key === key)) return 'Interno';
        if (justificacoes.some(j => j.tx_key === key)) return 'Justificado';
        if (pagamentos.some(p => p.transaction_data && txKey(p.transaction_data) === key)) return 'Com Cliente';
        return 'Sem Cliente';
      };

      const csvLines = ['Data,Tipo,Descrição,Valor (€),Status'];
      for (const tx of allTxs) {
        const status = txStatus(tx);
        csvLines.push(`"${tx.data}","${tx.tipo}","${(tx.descricao || '').replace(/"/g, '""')}","${tx.valor}","${status}"`);
      }
      const csvBlob = new Blob([csvLines.join('\n')], { type: 'text/csv;charset=utf-8;' });
      extratoFolder.file('extrato_bancario.csv', csvBlob);

      // ── Extrato PDF (texto real do extrato) ─────────────────────────────────
      const docExtrato = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      docExtrato.setFontSize(16); docExtrato.setTextColor(30);
      docExtrato.text('Extrato Bancário', 14, 18);
      docExtrato.setFontSize(9); docExtrato.setTextColor(120);
      docExtrato.text(`Ficheiro: ${runData?.filename || 'N/A'}  ·  Período: ${monthLabel}  ·  ${allTxs.length} movimentos`, 14, 25);

      const extratoRows = allTxs.map(tx => {
        const signo = tx.tipo === 'credito' ? '+' : '-';
        return [tx.data, tx.tipo === 'credito' ? 'Crédito' : 'Débito', tx.descricao || '', `${signo}${tx.valor}`];
      });

      autoTable(docExtrato, {
        startY: 30,
        head: [['Data', 'Tipo', 'Descrição', 'Valor (€)']],
        body: extratoRows,
        styles: { fontSize: 7, cellPadding: 1.5 },
        headStyles: { fillColor: [30, 60, 100], textColor: 255, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [245, 247, 250] },
        columnStyles: { 0: { cellWidth: 25 }, 1: { cellWidth: 20 }, 2: { cellWidth: 180 }, 3: { cellWidth: 30 } },
      });

      extratoFolder.file('extrato_bancario.pdf', docExtrato.output('blob'));

      // ── Faturas PDF do storage ─────────────────────────────────────────────
      const linkedFatIds = [...new Set(faturaLinks.map(l => l.fatura_id).filter(Boolean))];
      const faturasNoZip = faturasData.filter(f => linkedFatIds.includes(f.id) && f.storage_path);
      const total = faturasNoZip.length;

      if (total > 0) {
        for (let i = 0; i < faturasNoZip.length; i++) {
          const fat = faturasNoZip[i];
          setExportProgress({ current: i + 1, total });
          const fornecedor = (fat.dados?.fornecedor || 'SEM_FORNECEDOR').replace(/[^a-zA-Z0-9]/g, '_');
          const numero = (fat.dados?.numero_fatura || fat.id).replace(/[^a-zA-Z0-9]/g, '_');
          const filename = `FAT_${fornecedor}_${numero}.pdf`;
          try {
            const { data: pdfBlob, error } = await supabase.storage.from('faturas').download(fat.storage_path);
            if (error || !pdfBlob) {
              console.warn(`Fatura ${fat.id} não acessível:`, error?.message);
              continue;
            }
            faturasFolder.file(filename, pdfBlob);
          } catch (e) {
            console.warn(`Erro ao baixar fatura ${fat.id}:`, e.message);
          }
        }
      }

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `movimentacoes_Extrato_${safeMonth}.zip`;
      document.body.appendChild(a);
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Erro ao gerar ZIP:', err);
      alert('Ocorreu um erro ao gerar o ZIP. Tente novamente.');
    } finally {
      setExportingZip(false);
      setExportProgress({ current: 0, total: 0 });
    }
  };

  // ── Acções: Interno ───────────────────────────────────────────────────────

  const handleConfirmarInterno = async () => {
    if (!internoModal) return;
    const effectiveRunId = internoModal.run_id || runId;
    if (!effectiveRunId) return;
    setInternoSaving(true);
    const key = txKey(internoModal);
    await supabase.from('entrada_internos').upsert({ run_id: effectiveRunId, tx_key: key }, { onConflict: 'run_id,tx_key' });
    setInternos(prev => [...prev.filter(i => i.tx_key !== key), { tx_key: key }]);

    if (internoSaveAlias && internoAliasName.trim()) {
      const { data: newAlias } = await supabase
        .from('movimentacoes_aliases')
        .upsert({ bank_name: internoAliasName.trim(), resolucao: 'interno', client_id: null }, { onConflict: 'bank_name' })
        .select('id, bank_name, resolucao, client_id')
        .single();
      if (newAlias) setAliases(prev => [newAlias, ...prev.filter(a => a.bank_name !== internoAliasName.trim())]);
    }

    setInternoSaving(false);
    setInternoModal(null);
    setInternoSaveAlias(false);
    setInternoAliasName('');
  };

  const handleDesfazerInterno = async (tx) => {
    const effectiveRunId = tx.run_id || runId;
    if (!effectiveRunId) return;
    const key = txKey(tx);
    await supabase.from('entrada_internos').delete().eq('run_id', effectiveRunId).eq('tx_key', key);
    setInternos(prev => prev.filter(i => i.tx_key !== key));
  };

  // ── Acções: Imposto ───────────────────────────────────────────────────────────

  const handleConfirmarImposto = async () => {
    if (!impostoModal) return;
    const effectiveRunId = impostoModal.run_id || runId;
    if (!effectiveRunId) return;
    setImpostoSaving(true);
    const key = txKey(impostoModal);
    await supabase.from('entrada_impostos').upsert({ run_id: effectiveRunId, tx_key: key }, { onConflict: 'run_id,tx_key' });
    setImpostos(prev => [...prev.filter(i => i.tx_key !== key), { tx_key: key }]);

    if (impostoSaveAlias && impostoAliasName.trim()) {
      const { data: newAlias } = await supabase
        .from('movimentacoes_aliases')
        .upsert({ bank_name: impostoAliasName.trim(), resolucao: 'imposto', client_id: null }, { onConflict: 'bank_name' })
        .select('id, bank_name, resolucao, client_id')
        .single();
      if (newAlias) setAliases(prev => [newAlias, ...prev.filter(a => a.bank_name !== impostoAliasName.trim())]);
    }

    setImpostoSaving(false);
    setImpostoModal(null);
    setImpostoSaveAlias(false);
    setImpostoAliasName('');
  };

  const handleDesfazerImposto = async (tx) => {
    const effectiveRunId = tx.run_id || runId;
    if (!effectiveRunId) return;
    const key = txKey(tx);
    await supabase.from('entrada_impostos').delete().eq('run_id', effectiveRunId).eq('tx_key', key);
    setImpostos(prev => prev.filter(i => i.tx_key !== key));
  };

  // ── Acções: Cliente / Fatura ──────────────────────────────────────────────

  const handleOpenAcaoCliente = (tx) => {
    const mes = (tx.data || '').substring(0, 7);
    setNcModal(tx);
    setNcClientId('');
    setNcPeriod(mes);
    setNcNotas('');
    setNcSaveAlias(false);
  };

  const handleSaveAcaoCliente = async () => {
    if (!ncClientId || !ncPeriod || !ncModal) return;
    const effectiveRunId = ncModal.run_id || runId;
    if (!effectiveRunId) return;
    setNcSaving(true);
    const key = txKey(ncModal);
    const { data, error } = await supabase
      .from('entrada_nota_credito_links')
      .upsert(
        { run_id: effectiveRunId, tx_key: key, client_id: ncClientId, period: ncPeriod, notas: ncNotas.trim() || null },
        { onConflict: 'run_id,tx_key' }
      )
      .select('tx_key, client_id, period, notas')
      .single();
    if (!error && data) {
      setNotasCredito(prev => [...prev.filter(n => n.tx_key !== data.tx_key), data]);
    }

    if (ncSaveAlias && ncAliasName.trim()) {
      const { data: newAlias } = await supabase
        .from('movimentacoes_aliases')
        .upsert({ bank_name: ncAliasName.trim(), resolucao: 'nota_credito', client_id: ncClientId }, { onConflict: 'bank_name' })
        .select('id, bank_name, resolucao, client_id')
        .single();
      if (newAlias) setAliases(prev => [newAlias, ...prev.filter(a => a.bank_name !== ncAliasName.trim())]);
    }

    setNcSaving(false);
    setNcModal(null);
    setNcAliasName('');
  };

  const handleDesfazerCliente = async (tx) => {
    const effectiveRunId = tx.run_id || runId;
    if (!effectiveRunId) return;
    const key = txKey(tx);
    await supabase.from('entrada_nota_credito_links').delete().eq('run_id', effectiveRunId).eq('tx_key', key);
    setNotasCredito(prev => prev.filter(n => n.tx_key !== key));
  };

  // ── Acções: Justificação ──────────────────────────────────────────────────

  const handleSaveJustificacao = async () => {
    if (!justText.trim() || !justModal) return;
    const effectiveRunId = justModal.run_id || runId;
    if (!effectiveRunId) return;
    setJustSaving(true);
    const key = txKey(justModal);
    const { data, error } = await supabase
      .from('entrada_justifications')
      .upsert({ run_id: effectiveRunId, tx_key: key, justification: justText.trim() }, { onConflict: 'run_id,tx_key' })
      .select('tx_key, justification')
      .single();
    if (!error && data) {
      setJustificacoes(prev => [...prev.filter(j => j.tx_key !== data.tx_key), data]);
    }
    setJustSaving(false);
    setJustModal(null);
    setJustText('');
  };

  const handleRemoverJustificacao = async (tx) => {
    const effectiveRunId = tx.run_id || runId;
    if (!effectiveRunId) return;
    const key = txKey(tx);
    await supabase.from('entrada_justifications').delete().eq('run_id', effectiveRunId).eq('tx_key', key);
    setJustificacoes(prev => prev.filter(j => j.tx_key !== key));
  };

  // ── Acções: Aliases ───────────────────────────────────────────────────────

  const handleApagarAlias = async (id) => {
    await supabase.from('movimentacoes_aliases').delete().eq('id', id);
    setAliases(prev => prev.filter(a => a.id !== id));
  };

  // ── Acções: Recibo ────────────────────────────────────────────────────────

  const handleOpenAcaoRecibo = (tx) => {
    setReciboModal(tx);
    setReciboWorkerId('');
    setReciboWorkerName('');
    setReciboMes(previousMonth(tx.data)); // recibo do mês anterior por defeito
  };

  const handleSaveAcaoRecibo = async () => {
    if (!reciboWorkerName || !reciboMes || !reciboModal) return;
    const effectiveRunId = reciboModal.run_id || runId;
    if (!effectiveRunId) return;
    setReciboSaving(true);
    const key = txKey(reciboModal);
    const tipo = (() => {
      const txDay = parseInt(reciboModal.data.split('-')[2]);
      return (txDay >= 1 && txDay <= 6) || txDay >= 16 ? 'Adiantamento' : 'Liquidação';
    })();
    const { data, error } = await supabase
      .from('movimentacao_recibo_links')
      .upsert(
        { run_id: effectiveRunId, tx_key: key, worker_id: reciboWorkerId || null, worker_name: reciboWorkerName, mes: reciboMes, tipo, auto_matched: false },
        { onConflict: 'run_id,tx_key' }
      )
      .select('tx_key, worker_id, worker_name, mes, tipo, auto_matched')
      .single();
    if (!error && data) {
      setReciboLinks(prev => [...prev.filter(r => r.tx_key !== data.tx_key), data]);
    }
    setReciboSaving(false);
    setReciboModal(null);
  };

  const handleDesfazerRecibo = async (tx) => {
    const effectiveRunId = tx.run_id || runId;
    if (!effectiveRunId) return;
    const key = txKey(tx);
    await supabase.from('movimentacao_recibo_links').delete().eq('run_id', effectiveRunId).eq('tx_key', key);
    setReciboLinks(prev => prev.filter(r => r.tx_key !== key));
  };

  // ── Acções: Fatura ────────────────────────────────────────────────────────

  const handleOpenAcaoFatura = (tx) => {
    setFaturaModal(tx);
    setFaturaSelId('');
  };

  const handleSaveAcaoFatura = async () => {
    if (!faturaSelId || !faturaModal) return;
    const effectiveRunId = faturaModal.run_id || runId;
    if (!effectiveRunId) return;
    setFaturaSaving(true);
    const key = txKey(faturaModal);
    await supabase.from('fatura_pagamento_links').delete().eq('tx_key', key);
    const { data, error } = await supabase
      .from('fatura_pagamento_links')
      .insert({ fatura_id: faturaSelId, run_id: effectiveRunId, tx_key: key, auto_matched: false })
      .select('fatura_id, run_id, tx_key, auto_matched')
      .single();
    if (!error && data) {
      setFaturaLinks(prev => [...prev.filter(f => f.tx_key !== data.tx_key && f.fatura_id !== data.fatura_id), data]);
    }
    setFaturaSaving(false);
    setFaturaModal(null);
    setFaturaSelId('');
  };

  const handleDesfazerFatura = async (tx) => {
    const effectiveRunId = tx.run_id || runId;
    if (!effectiveRunId) return;
    const key = txKey(tx);

    // Restore fatura to PENDENTE before deleting link
    const link = faturaLinks.find(f => f.tx_key === key);
    if (link?.fatura_id) {
      await supabase.from('faturas').update({ status: 'PENDENTE' }).eq('id', link.fatura_id);
    }

    await supabase.from('fatura_pagamento_links').delete().eq('run_id', effectiveRunId).eq('tx_key', key);
    setFaturaLinks(prev => prev.filter(f => f.tx_key !== key));
  };

  const handleSaveNovoAlias = async () => {
    if (!addAliasName.trim()) return;
    if (addAliasResolucao === 'nota_credito' && !addAliasClientId) return;
    setAddAliasSaving(true);
    const { data: newAlias } = await supabase
      .from('movimentacoes_aliases')
      .upsert(
        { bank_name: addAliasName.trim(), resolucao: addAliasResolucao, client_id: addAliasResolucao === 'nota_credito' ? addAliasClientId : null },
        { onConflict: 'bank_name' }
      )
      .select('id, bank_name, resolucao, client_id')
      .single();
    if (newAlias) setAliases(prev => [newAlias, ...prev.filter(a => a.bank_name !== addAliasName.trim())]);
    setAddAliasSaving(false);
    setAddAliasModal(false);
    setAddAliasName('');
    setAddAliasResolucao('interno');
    setAddAliasClientId('');
  };

  // ── Auto-confirmar todos os matches de um run ────────────────────────────
  const autoConfirmarMatched = async (matchedItems, runId, fullResults) => {
    if (!supabase || !matchedItems?.length) return matchedItems;

    const faturaItemsComData = matchedItems.filter(
      m => m.fatura?.id && m.fatura?.fonte !== 'recibo' && m.transacao?.data
    );

    const porConfirmar = matchedItems.filter(
      m => m.fatura?.id && m.fatura?.status !== 'PAGO' && m.rule !== 'confirmed_manual'
    );
    const faturasPorConfirmar = porConfirmar.filter(m => m.fatura.fonte !== 'recibo');
    const recibosPorConfirmar = porConfirmar.filter(m => m.fatura.fonte === 'recibo');

    const allFaturaIdsUpdate = [...new Set([
      ...faturasPorConfirmar.map(m => m.fatura.id),
      ...faturaItemsComData.map(m => m.fatura.id),
    ])];
    let dadosMap = {};
    if (allFaturaIdsUpdate.length) {
      const { data: faturasAtuals } = await supabase
        .from('faturas').select('id, dados').in('id', allFaturaIdsUpdate);
      dadosMap = Object.fromEntries((faturasAtuals || []).map(f => [f.id, f.dados]));
    }

    const semDataPagamento = faturaItemsComData.filter(
      m => m.fatura.status === 'PAGO' && !dadosMap[m.fatura.id]?.data_pagamento
    );
    const pagasSemDataNenhuma = matchedItems.filter(
      m => m.fatura?.id && m.fatura?.fonte !== 'recibo' &&
        m.fatura.status === 'PAGO' && !m.transacao?.data && !dadosMap[m.fatura.id]?.data_pagamento
    );

    const hoje = new Date().toISOString().slice(0, 10);
    await Promise.all([
      ...faturasPorConfirmar.map(m => {
        const existente = dadosMap[m.fatura.id] || {};
        const dataPagamento = m.transacao?.data || existente.data_pagamento || hoje;
        const payload = { status: 'PAGO' };
        payload.dados = { ...existente, data_pagamento: dataPagamento };
        return supabase.from('faturas').update(payload).eq('id', m.fatura.id);
      }),
      ...semDataPagamento.map(m => supabase.from('faturas').update({
        dados: { ...(dadosMap[m.fatura.id] || {}), data_pagamento: m.transacao.data },
      }).eq('id', m.fatura.id)),
      ...pagasSemDataNenhuma.map(m => supabase.from('faturas').update({
        dados: { ...(dadosMap[m.fatura.id] || {}), data_pagamento: hoje },
      }).eq('id', m.fatura.id)),
      ...recibosPorConfirmar.map(m =>
        supabase.from('receipt_validations').update({ estado: 'pago' }).eq('id', m.fatura.id)
      ),
    ]);

    if (!porConfirmar.length && !semDataPagamento.length && !pagasSemDataNenhuma.length) return matchedItems;

    const confirmedIds = new Set(porConfirmar.map(m => m.fatura.id));
    const newMatched = matchedItems.map(m =>
      confirmedIds.has(m.fatura?.id) ? { ...m, fatura: { ...m.fatura, status: 'PAGO' } } : m
    );

    if (runId && confirmedIds.size > 0) {
      await supabase.from('reconciliation_runs').update({
        results_json: { ...(fullResults || {}), matched: newMatched },
      }).eq('id', runId);
    }

    return newMatched;
  };

  // ── Render ────────────────────────────────────────────────────────────────

  // Upload / Preview zone
  if (ficheiros.length > 0 || previewTransacoes) {
    return (
      <div className="space-y-3">
        {ficheiros.length > 0 && (
          <div className="bg-white rounded-2xl border-2 border-dashed border-indigo-200 p-6 text-center">
            <div className="flex flex-col items-center gap-3">
              <Upload size={28} className="text-indigo-400" />
              <p className="text-sm font-semibold text-slate-700">{ficheiros.length} ficheiro(s) pronto(s) para processar</p>
              <p className="text-xs text-slate-400">{ficheiros.map(f => f.name).join(', ')}</p>
              <div className="flex gap-2">
                <button onClick={() => setFicheiros([])} className="px-4 py-2 text-xs font-bold uppercase tracking-widest border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50">Cancelar</button>
                <button onClick={previsar} disabled={previewing} className="flex items-center gap-2 px-4 py-2 text-xs font-bold uppercase tracking-widest bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50">
                  {previewing ? <Loader2 size={13} className="animate-spin" /> : null}
                  Pré-visualizar
                </button>
              </div>
            </div>
          </div>
        )}
        {csvMapping && (
          <div className="bg-white rounded-2xl border border-indigo-100 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-indigo-700">Mapeamento de Colunas — {previewFilename}</p>
              <button onClick={() => { setCsvMapping(null); setFicheiros([]); }} className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50">Cancelar</button>
            </div>
            <p className="text-[10px] text-slate-500">Selecione qual coluna corresponde a cada campo:</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">Data</label>
                <select value={colMap.dataCol} onChange={e => setColMap(p => ({ ...p, dataCol: e.target.value }))} className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-xl">
                  <option value="">— Selecionar —</option>
                  {(csvMapping.columns || []).map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">Valor</label>
                <select value={colMap.valorCol} onChange={e => setColMap(p => ({ ...p, valorCol: e.target.value }))} className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-xl">
                  <option value="">— Selecionar —</option>
                  {(csvMapping.columns || []).map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">Descrição</label>
                <select value={colMap.descricaoCol} onChange={e => setColMap(p => ({ ...p, descricaoCol: e.target.value }))} className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-xl">
                  <option value="">— Selecionar —</option>
                  {(csvMapping.columns || []).map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">Tipo (opcional)</label>
                <select value={colMap.tipoCol} onChange={e => setColMap(p => ({ ...p, tipoCol: e.target.value }))} className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-xl">
                  <option value="">— Nenhum —</option>
                  {(csvMapping.columns || []).map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">Débito (opcional)</label>
                <select value={colMap.debitoCol} onChange={e => setColMap(p => ({ ...p, debitoCol: e.target.value }))} className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-xl">
                  <option value="">— Nenhum —</option>
                  {(csvMapping.columns || []).map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">Crédito (opcional)</label>
                <select value={colMap.creditoCol} onChange={e => setColMap(p => ({ ...p, creditoCol: e.target.value }))} className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-xl">
                  <option value="">— Nenhum —</option>
                  {(csvMapping.columns || []).map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
            {csvMapping.preview && csvMapping.preview.length > 0 && (
              <div className="mt-2">
                <p className="text-[10px] font-black uppercase text-slate-400 mb-1">Pré-visualização (primeiras 3 linhas)</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-[10px] border border-slate-100 rounded-lg">
                    <thead>
                      <tr className="bg-slate-50">
                        {(csvMapping.columns || []).map(c => <th key={c} className="px-2 py-1 text-slate-500 font-bold">{c}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {csvMapping.preview.slice(0, 3).map((row, i) => (
                        <tr key={i} className="border-t border-slate-100">
                          {(csvMapping.columns || []).map(c => <td key={c} className="px-2 py-1 text-slate-600">{String(row[c] || '')}</td>)}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            <button
              onClick={confirmarMapeamento}
              disabled={previewing || !colMap.dataCol || (!colMap.valorCol && !colMap.debitoCol) || !colMap.descricaoCol}
              className="flex items-center gap-2 px-4 py-2 text-xs font-bold uppercase tracking-widest bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50"
            >
              {previewing ? <Loader2 size={13} className="animate-spin" /> : null}
              Confirmar Mapeamento
            </button>
          </div>
        )}
        {previewTransacoes && (
          <div className="bg-white rounded-2xl border border-slate-100 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-slate-700">{previewFilename}</p>
              <div className="flex gap-2">
                <button onClick={() => { setPreviewTransacoes(null); setFicheiros([]); }} className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50">Cancelar</button>
                <button onClick={processar} disabled={processando} className="flex items-center gap-2 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 disabled:opacity-50">
                  {processando ? <Loader2 size={11} className="animate-spin" /> : null}
                  Processar
                </button>
              </div>
            </div>
            <div className="flex gap-2 mb-2">
              <input type="text" placeholder="Filtrar descrição…" value={txSearch} onChange={e => setTxSearch(e.target.value)} className="flex-1 px-3 py-1.5 text-xs border border-slate-200 rounded-xl" />
              <select value={txTipoFiltro} onChange={e => setTxTipoFiltro(e.target.value)} className="px-3 py-1.5 text-xs border border-slate-200 rounded-xl">
                <option value="todos">Todos</option>
                <option value="credito">Entradas</option>
                <option value="debito">Saídas</option>
              </select>
            </div>
            <div className="max-h-64 overflow-y-auto space-y-1">
              {previewTransacoes.filter(tx => {
                const matchSearch = !txSearch || tx.descricao?.toLowerCase().includes(txSearch.toLowerCase());
                const matchTipo = txTipoFiltro === 'todos' || tx.tipo === txTipoFiltro;
                return matchSearch && matchTipo;
              }).map((tx, i) => (
                <div key={i} className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs ${selTransacoes.has(i) ? 'bg-indigo-50 border border-indigo-200' : 'bg-slate-50 border border-transparent'}`}>
                  <input type="checkbox" checked={selTransacoes.has(i)} onChange={e => { const s = new Set(selTransacoes); e.target.checked ? s.add(i) : s.delete(i); setSelTransacoes(s); }} className="accent-indigo-600" />
                  <span className="w-20 text-slate-500">{tx.data}</span>
                  <span className={`w-16 text-right font-bold ${tx.tipo === 'credito' ? 'text-emerald-600' : 'text-rose-600'}`}>{parseFloat(tx.valor || 0).toLocaleString('pt-PT', { minimumFractionDigits: 2 })} €</span>
                  <span className="flex-1 truncate text-slate-600">{tx.descricao}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        {erro && (
          <div className="flex items-center gap-2 p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-600">
            <X size={14} /> {erro}
          </div>
        )}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3">
        <Loader2 size={24} className="animate-spin text-indigo-400" />
        <p className="text-[11px] text-slate-400">A carregar movimentações do extrato…</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Upload zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`bg-white rounded-2xl border-2 border-dashed p-6 text-center cursor-pointer transition-all ${dragging ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200 hover:border-indigo-300'}`}
      >
        <input ref={inputRef} type="file" accept=".csv,.ofx,.qfx" multiple onChange={handleFileChange} className="hidden" />
        <div className="flex flex-col items-center gap-2">
          <Upload size={24} className={dragging ? 'text-indigo-500' : 'text-slate-400'} />
          <p className="text-sm font-semibold text-slate-600">
            {dragging ? 'Largue o ficheiro aqui' : 'Arraste CSV, OFX ou QFX ou clique para selecionar'}
          </p>
          <p className="text-[10px] text-slate-400">Suporta múltiplos ficheiros</p>
        </div>
      </div>

      {/* Filtros: Todas | Entradas | Saídas */}
      <div className="flex items-center gap-1.5">
        {[
          { key: 'all',      label: 'Todas',    count: allTxs.length },
          { key: 'entradas', label: 'Entradas', count: creditos.length, icon: TrendingUp,   color: 'text-emerald-600' },
          { key: 'saidas',   label: 'Saídas',   count: debitos.length,  icon: TrendingDown, color: 'text-rose-600' },
        ].map(({ key, label, count, icon: Icon, color }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${
              filter === key
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
            }`}
          >
            {Icon && <Icon size={11} className={filter === key ? 'text-white' : color} />}
            {label}
            {count > 0 && (
              <span className={`px-1.5 py-0.5 rounded-full text-[8px] font-black ${filter === key ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-500'}`}>
                {count}
              </span>
            )}
          </button>
        ))}

        {/* Botão Atualizar Match */}
        <button
          onClick={handleRunAutoMatch}
          disabled={autoMatching}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-sm hover:bg-indigo-700 transition-colors disabled:opacity-50"
        >
          {autoMatching ? (
            <><Loader2 size={11} className="animate-spin" /> A procurar...</>
          ) : (
            <><RefreshCw size={11} /> Atualizar Match</>
          )}
        </button>
      </div>

      {/* Run selector */}
      {allRuns.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black text-slate-400 uppercase">Extrato:</span>
            <select
              value={activeRunId || ''}
              onChange={e => {
                const id = e.target.value;
                setActiveRunId(id || null);
                if (id) loadRun(id);
              }}
              className="flex-1 text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-xl px-3 py-1.5 max-w-xs"
            >
<option value="">Mostrar todos</option>
              {allRuns.map(r => (
                <option key={r.id} value={r.id}>
                  {runMonthYear[r.id] || extractMonthYearName(r.transactions_json) || r.filename || 'Extrato'} — {new Date(r.created_at).toLocaleDateString('pt-PT')}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-wrap gap-2">
            {allRuns.map(r => (
              <div key={r.id} className={`flex items-center gap-1 px-2 py-1 rounded-xl text-[10px] font-bold border ${activeRunId === r.id ? 'bg-indigo-100 border-indigo-300 text-indigo-700' : 'bg-slate-50 border-slate-200 text-slate-500'}`}>
                <button
                  onClick={() => { setActiveRunId(r.id); loadRun(r.id); }}
                  className="hover:underline"
                >
                  {runMonthYear[r.id] || extractMonthYearName(r.transactions_json) || r.filename || 'Extrato'}
                </button>
                <button
                  onClick={async () => {
                    if (!window.confirm('Apagar este extrato? As faturas confirmadas voltarão a PENDENTE.')) return;
                    const runId = r.id;

                    // Buscar matched do run
                    const { data: runData } = await supabase
                      .from('reconciliation_runs')
                      .select('results_json')
                      .eq('id', runId)
                      .single();

                    if (runData?.results_json?.matched?.length) {
                      const faturaMatches = runData.results_json.matched
                        .filter(m => m.fatura?.fonte !== 'recibo' && m.fatura?.id);
                      const reciboMatches = runData.results_json.matched
                        .filter(m => m.fatura?.fonte === 'recibo' && m.fatura?.id);

                      if (faturaMatches.length) {
                        const porStatus = {};
                        for (const m of faturaMatches) {
                          const st = m.fatura.status_original || 'PENDENTE';
                          if (!porStatus[st]) porStatus[st] = [];
                          porStatus[st].push(m.fatura.id);
                        }
                        await Promise.all(
                          Object.entries(porStatus).map(([st, ids]) =>
                            supabase.from('faturas').update({ status: st }).in('id', ids)
                          )
                        );
                      }

                      if (reciboMatches.length) {
                        const porEstado = {};
                        for (const m of reciboMatches) {
                          const est = m.fatura.estado_original || 'valido';
                          if (!porEstado[est]) porEstado[est] = [];
                          porEstado[est].push(m.fatura.id);
                        }
                        await Promise.all(
                          Object.entries(porEstado).map(([est, ids]) =>
                            supabase.from('receipt_validations').update({ estado: est }).in('id', ids)
                          )
                        );
                      }

                      const fatIds = faturaMatches.map(m => m.fatura.id);
                      if (fatIds.length) {
                        const { data: faturasAtuals } = await supabase.from('faturas').select('id, dados').in('id', fatIds);
                        const comDataPagamento = (faturasAtuals || []).filter(f => f.dados?.data_pagamento);
                        if (comDataPagamento.length) {
                          await Promise.all(comDataPagamento.map(f => {
                            const { data_pagamento, ...dadosSem } = f.dados;
                            return supabase.from('faturas').update({ dados: dadosSem }).eq('id', f.id);
                          }));
                        }
                      }
                    }

                    // Apagar associações
                    await supabase.from('faturacao_clientes_pagamentos').delete().eq('reconciliation_run_id', runId);
                    await supabase.from('fatura_pagamento_links').delete().eq('run_id', runId);
                    await supabase.from('entrada_justifications').delete().eq('run_id', runId);
                    await supabase.from('entrada_internos').delete().eq('run_id', runId);
                    await supabase.from('entrada_nota_credito_links').delete().eq('run_id', runId);
                    await supabase.from('movimentacao_recibo_links').delete().eq('run_id', runId);

                    // Apagar o run
                    await supabase.from('reconciliation_runs').delete().eq('id', runId);

                    setAllRuns(prev => prev.filter(x => x.id !== runId));
                    if (activeRunId === runId) { setActiveRunId(null); setRunId(null); setAllTxs([]); }
                  }}
                  className="ml-1 text-rose-400 hover:text-rose-600"
                  title="Apagar extrato"
                >
                  <X size={10} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* KPIs */}
      <div className="flex items-start justify-between gap-3">
        <div className="grid grid-cols-3 gap-3 flex-1">
          {[
            { label: 'Total',        value: filteredTxs.length, color: 'text-slate-700',   bg: 'bg-slate-50' },
            { label: 'Resolvidos',   value: totalResolvido,     color: 'text-emerald-700', bg: 'bg-emerald-50' },
            { label: 'Por Resolver', value: semResolver,        color: 'text-amber-700',   bg: 'bg-amber-50' },
          ].map(c => (
            <div key={c.label} className={`${c.bg} rounded-2xl px-4 py-3 text-center`}>
              <p className={`text-2xl font-black ${c.color}`}>{c.value}</p>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-0.5">{c.label}</p>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-1.5 flex-shrink-0">
          <button
            onClick={() => setShowAliases(v => !v)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${showAliases ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-500 hover:bg-indigo-100 hover:text-indigo-700'}`}
          >
            <Tag size={13} /> Aliases {aliases.length > 0 && `(${aliases.length})`}
          </button>
          <div className="relative" ref={exportRef}>
            <button
              onClick={() => setShowExportMenu(v => !v)}
              className="w-full flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-indigo-100 text-slate-500 hover:text-indigo-700 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all"
            >
              <Download size={13} /> Exportar
            </button>
            {showExportMenu && (
              <div className="absolute right-0 top-full mt-1 bg-white rounded-2xl shadow-xl border border-slate-100 py-1 z-20 min-w-[130px]">
                <button onClick={handleExportCsv}
                  className="w-full flex items-center gap-2 px-4 py-2.5 text-[11px] font-bold text-slate-700 hover:bg-slate-50 transition-colors">
                  <FileText size={13} className="text-emerald-600" /> CSV
                </button>
                <button onClick={handleExportPdf}
                  className="w-full flex items-center gap-2 px-4 py-2.5 text-[11px] font-bold text-slate-700 hover:bg-slate-50 transition-colors">
                  <FileText size={13} className="text-rose-500" /> PDF
                </button>
                <button onClick={handleExportZip} disabled={exportingZip}
                  className="w-full flex items-center gap-2 px-4 py-2.5 text-[11px] font-bold text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50">
                  {exportingZip ? <Loader2 size={13} className="animate-spin text-indigo-600" /> : <FileArchive size={13} className="text-indigo-600" />}
                  {exportingZip ? `ZIP ${exportProgress.current}/${exportProgress.total}` : 'ZIP'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Totais de entradas/saídas */}
      {(filter === 'all' || filter === 'entradas' || filter === 'saidas') && (
        <div className="flex gap-2">
          {filter !== 'saidas' && totalEntradas > 0 && (
            <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-1.5">
              <TrendingUp size={11} className="text-emerald-600" />
              <span className="text-[10px] font-black text-emerald-700">+{fmtEur(totalEntradas)}</span>
            </div>
          )}
          {filter !== 'entradas' && totalSaidas > 0 && (
            <div className="flex items-center gap-1.5 bg-rose-50 border border-rose-100 rounded-xl px-3 py-1.5">
              <TrendingDown size={11} className="text-rose-600" />
              <span className="text-[10px] font-black text-rose-700">-{fmtEur(totalSaidas)}</span>
            </div>
          )}
        </div>
      )}

      {/* Breakdown dos resolvidos */}
      {totalResolvido > 0 && (
        <div className="flex flex-wrap gap-2 text-[9px] font-black uppercase tracking-widest text-slate-400">
          {comClienteCount > 0 && <span className="text-emerald-600">{comClienteCount} Com Cliente/Fatura</span>}
          {comReciboCount > 0 && <><span>·</span><span className="text-teal-600">{comReciboCount} Com Recibo</span></>}
          {comFaturaCount > 0 && <><span>·</span><span className="text-orange-600">{comFaturaCount} Com Fatura Doc</span></>}
          {notaCreditoCount > 0 && <><span>·</span><span className="text-blue-600">{notaCreditoCount} Cliente/Fatura</span></>}
          {internoCount > 0 && <><span>·</span><span className="text-purple-600">{internoCount} Interno</span></>}
          {impostoCount > 0 && <><span>·</span><span className="text-amber-600">{impostoCount} Imposto</span></>}
          {justCount > 0 && <><span>·</span><span className="text-violet-600">{justCount} Justificados</span></>}
        </div>
      )}

      {/* Auto-match */}
      {autoMatching && (
        <div className="flex items-center gap-2 text-[10px] text-indigo-500 font-bold">
          <Loader2 size={12} className="animate-spin" /> A executar auto-match…
        </div>
      )}
      {autoMatchCount !== null && autoMatchCount > 0 && !autoMatching && (
        <div className="flex items-center gap-2 bg-indigo-50 border border-indigo-100 rounded-2xl px-4 py-2">
          <Zap size={13} className="text-indigo-500 flex-shrink-0" />
          <p className="text-[10px] font-bold text-indigo-700">
            Auto-match: {autoMatchCount} transacç{autoMatchCount !== 1 ? 'ões resolvidas' : 'ão resolvida'} automaticamente
          </p>
          <button onClick={() => setAutoMatchCount(null)} className="ml-auto text-indigo-300 hover:text-indigo-500">
            <X size={12} />
          </button>
        </div>
      )}

      {/* Painel de aliases */}
      {showAliases && (
        <div className="border border-slate-200 rounded-2xl overflow-hidden">
          <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Aliases de Movimentações</p>
            <button
              onClick={() => { setAddAliasModal(true); setAddAliasName(''); setAddAliasResolucao('interno'); setAddAliasClientId(''); }}
              className="flex items-center gap-1 px-2.5 py-1 rounded-xl text-[9px] font-black uppercase tracking-widest bg-indigo-100 text-indigo-700 hover:bg-indigo-200 transition-colors"
            >
              <Plus size={11} /> Alias
            </button>
          </div>
          {aliases.length === 0 ? (
            <p className="text-[11px] text-slate-400 text-center py-6">Nenhum alias guardado ainda.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {aliases.map(a => {
                const clientName = a.client_id ? (clients?.find(c => c.id === a.client_id)?.name || a.client_id) : null;
                const cfg = a.resolucao === 'interno' ? STATUS_CFG['Interno'] : STATUS_CFG['Nota Crédito'];
                const Icon = cfg.icon;
                return (
                  <div key={a.id} className="flex items-center gap-3 px-4 py-2.5">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest ${cfg.bg} ${cfg.text} flex-shrink-0`}>
                      <Icon size={9} /> {a.resolucao === 'interno' ? 'Interno' : 'Cliente'}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-bold text-slate-700 truncate" title={a.bank_name}>{a.bank_name}</p>
                      {clientName && <p className="text-[9px] text-slate-400">{clientName}</p>}
                    </div>
                    <button onClick={() => handleApagarAlias(a.id)}
                      className="text-slate-300 hover:text-rose-500 transition-colors flex-shrink-0">
                      <Trash2 size={13} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {runData && (
        <p className="text-[10px] text-slate-400">
          Extrato importado em {new Date(runData.created_at).toLocaleDateString('pt-PT')} · {creditos.length} entradas · {debitos.length} saídas
        </p>
      )}

      {/* Lista por mês */}
      {Object.keys(grupos).length === 0 ? (
        <p className="text-center text-slate-400 py-8 text-sm">Nenhuma transacção encontrada.</p>
      ) : (
        Object.entries(grupos)
          .sort(([a], [b]) => b.localeCompare(a))
          .map(([mes, txs]) => (
            <MovMesCard
              key={mes}
              mes={mes}
              txs={txs}
              pagamentos={pagamentos}
              justificacoes={justificacoes}
              internos={internos}
              notasCredito={notasCredito}
              reciboLinks={reciboLinks}
              clients={clients}
              faturaLinks={faturaLinks}
              impostos={impostos}
              faturasData={faturasData}
              onJustificar={tx => { setJustModal(tx); setJustText(''); }}
              onRemoverJustificacao={handleRemoverJustificacao}
              onMarcarInterno={tx => { setInternoModal(tx); setInternoSaveAlias(false); }}
              onDesfazerInterno={handleDesfazerInterno}
              onMarcarImposto={tx => setImpostoModal(tx)}
              onDesfazerImposto={handleDesfazerImposto}
              onAcaoCliente={handleOpenAcaoCliente}
              onDesfazerCliente={handleDesfazerCliente}
              onAcaoRecibo={handleOpenAcaoRecibo}
              onDesfazerRecibo={handleDesfazerRecibo}
              onAcaoFatura={handleOpenAcaoFatura}
              onDesfazerFatura={handleDesfazerFatura}
              onSelectRun={id => { setActiveRunId(id); loadRun(id); }}
            />
          ))
      )}

      {/* Modal: Interno */}
      {internoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-start justify-between">
              <h3 className="text-sm font-black text-slate-800">Marcar como Interno</h3>
              <button onClick={() => setInternoModal(null)} className="text-slate-400 hover:text-slate-600"><X size={16} /></button>
            </div>
            <div className="bg-purple-50 rounded-2xl px-4 py-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-purple-600 mb-1">Transacção</p>
              <p className="text-sm font-bold text-slate-800">{fmtEur(Math.abs(parseFloat(internoModal.valor) || 0))}</p>
              <p className="text-[11px] text-slate-500 mt-0.5">{internoModal.data}</p>
              <p className="text-[10px] text-slate-400 mt-0.5 break-all">{internoModal.descricao}</p>
            </div>
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input type="checkbox" checked={internoSaveAlias} onChange={e => {
                setInternoSaveAlias(e.target.checked);
                if (e.target.checked) setInternoAliasName(extractBankName(internoModal.descricao));
              }} className="w-4 h-4 rounded accent-purple-600" />
              <span className="text-[11px] font-bold text-slate-600">
                Guardar alias <span className="font-normal text-slate-400">— reconhecer automaticamente em importações futuras</span>
              </span>
            </label>
            {internoSaveAlias && (
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block mb-1">Nome do alias</label>
                <input type="text" value={internoAliasName} onChange={e => setInternoAliasName(e.target.value)}
                  className="w-full border border-purple-200 rounded-xl px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-purple-300 bg-purple-50" />
              </div>
            )}
            <div className="flex gap-2 pt-1">
              <button onClick={() => setInternoModal(null)}
                className="flex-1 px-4 py-2.5 rounded-2xl text-[11px] font-black uppercase tracking-widest border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors">
                Cancelar
              </button>
              <button disabled={internoSaving} onClick={handleConfirmarInterno}
                className="flex-1 px-4 py-2.5 rounded-2xl text-[11px] font-black uppercase tracking-widest bg-purple-600 text-white hover:bg-purple-700 transition-colors disabled:opacity-40 flex items-center justify-center gap-1.5">
                {internoSaving ? <Loader2 size={13} className="animate-spin" /> : <ArrowLeftRight size={13} />} Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Pagamento Imposto */}
      {impostoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-start justify-between">
              <h3 className="text-sm font-black text-slate-800">Pagamento Imposto</h3>
              <button onClick={() => setImpostoModal(null)} className="text-slate-400 hover:text-slate-600"><X size={16} /></button>
            </div>
            <div className="bg-amber-50 rounded-2xl px-4 py-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-amber-600 mb-1">Transacção</p>
              <p className="text-sm font-bold text-slate-800">{fmtEur(Math.abs(parseFloat(impostoModal.valor) || 0))}</p>
              <p className="text-[11px] text-slate-500 mt-0.5">{impostoModal.data}</p>
              <p className="text-[10px] text-slate-400 mt-0.5 break-all">{impostoModal.descricao}</p>
            </div>
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input type="checkbox" checked={impostoSaveAlias} onChange={e => {
                setImpostoSaveAlias(e.target.checked);
                if (e.target.checked) setImpostoAliasName(extractBankName(impostoModal.descricao));
              }} className="w-4 h-4 rounded accent-amber-600" />
              <span className="text-[11px] font-bold text-slate-600">
                Guardar alias <span className="font-normal text-slate-400">— reconhecer automaticamente em importações futuras</span>
              </span>
            </label>
            {impostoSaveAlias && (
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block mb-1">Nome do alias</label>
                <input type="text" value={impostoAliasName} onChange={e => setImpostoAliasName(e.target.value)}
                  className="w-full border border-amber-200 rounded-xl px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-300 bg-amber-50" />
              </div>
            )}
            <div className="flex gap-2 pt-1">
              <button onClick={() => setImpostoModal(null)}
                className="flex-1 px-4 py-2.5 rounded-2xl text-[11px] font-black uppercase tracking-widest border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors">
                Cancelar
              </button>
              <button disabled={impostoSaving} onClick={handleConfirmarImposto}
                className="flex-1 px-4 py-2.5 rounded-2xl text-[11px] font-black uppercase tracking-widest bg-amber-600 text-white hover:bg-amber-700 transition-colors disabled:opacity-40 flex items-center justify-center gap-1.5">
                {impostoSaving ? <Loader2 size={13} className="animate-spin" /> : <Percent size={13} />} Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Cliente / Fatura */}
      {ncModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-start justify-between">
              <h3 className="text-sm font-black text-slate-800">
                {ncModal.tipo === 'debito' ? 'Ligar a Fatura' : 'Ligar a Cliente'}
              </h3>
              <button onClick={() => setNcModal(null)} className="text-slate-400 hover:text-slate-600"><X size={16} /></button>
            </div>
            <div className={`rounded-2xl px-4 py-3 ${ncModal.tipo === 'debito' ? 'bg-rose-50' : 'bg-blue-50'}`}>
              <p className={`text-[10px] font-black uppercase tracking-widest mb-1 ${ncModal.tipo === 'debito' ? 'text-rose-600' : 'text-blue-600'}`}>Transacção</p>
              <p className="text-sm font-bold text-slate-800">{fmtEur(Math.abs(parseFloat(ncModal.valor) || 0))}</p>
              <p className="text-[11px] text-slate-500 mt-0.5">{ncModal.data}</p>
              <p className="text-[10px] text-slate-400 mt-0.5 break-all">{ncModal.descricao}</p>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block mb-1">Cliente</label>
                <select value={ncClientId} onChange={e => setNcClientId(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white">
                  <option value="">— Selecionar cliente —</option>
                  {(clients || []).sort((a, b) => (a.name || '').localeCompare(b.name || '')).map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block mb-1">Mês de referência</label>
                <input type="month" value={ncPeriod} onChange={e => setNcPeriod(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-300" />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block mb-1">Notas (opcional)</label>
                <input type="text" value={ncNotas} onChange={e => setNcNotas(e.target.value)}
                  placeholder={ncModal.tipo === 'debito' ? 'Ex: Fatura nº 42, pagamento a fornecedor…' : 'Ex: Nota de crédito nº 42, pagamento parcial…'}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-300" />
              </div>
              {ncModal.tipo === 'credito' && (
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input type="checkbox" checked={ncSaveAlias} onChange={e => {
                    setNcSaveAlias(e.target.checked);
                    if (e.target.checked) setNcAliasName(extractBankName(ncModal.descricao));
                  }} className="w-4 h-4 rounded accent-blue-600" />
                  <span className="text-[11px] font-bold text-slate-600">
                    Guardar alias <span className="font-normal text-slate-400">— auto-match futuro para este remetente</span>
                  </span>
                </label>
              )}
              {ncSaveAlias && ncModal.tipo === 'credito' && (
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block mb-1">Nome do alias</label>
                  <input type="text" value={ncAliasName} onChange={e => setNcAliasName(e.target.value)}
                    className="w-full border border-blue-200 rounded-xl px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-300 bg-blue-50" />
                </div>
              )}
            </div>
            <div className="flex gap-2 pt-1">
              <button onClick={() => setNcModal(null)}
                className="flex-1 px-4 py-2.5 rounded-2xl text-[11px] font-black uppercase tracking-widest border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors">
                Cancelar
              </button>
              <button disabled={!ncClientId || !ncPeriod || ncSaving} onClick={handleSaveAcaoCliente}
                className={`flex-1 px-4 py-2.5 rounded-2xl text-[11px] font-black uppercase tracking-widest text-white transition-colors disabled:opacity-40 flex items-center justify-center gap-1.5 ${ncModal.tipo === 'debito' ? 'bg-rose-600 hover:bg-rose-700' : 'bg-blue-600 hover:bg-blue-700'}`}>
                {ncSaving ? <Loader2 size={13} className="animate-spin" /> : ncModal.tipo === 'debito' ? <Receipt size={13} /> : <Link size={13} />}
                {ncModal.tipo === 'debito' ? 'Ligar Fatura' : 'Ligar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Justificação */}
      {justModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-start justify-between">
              <h3 className="text-sm font-black text-slate-800">Justificar Transacção</h3>
              <button onClick={() => { setJustModal(null); setJustText(''); }} className="text-slate-400 hover:text-slate-600"><X size={16} /></button>
            </div>
            <div className="bg-amber-50 rounded-2xl px-4 py-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-amber-600 mb-1">Transacção</p>
              <p className="text-sm font-bold text-slate-800">{fmtEur(Math.abs(parseFloat(justModal.valor) || 0))}</p>
              <p className="text-[11px] text-slate-500 mt-0.5">{justModal.data}</p>
              <p className="text-[10px] text-slate-400 mt-0.5 break-all">{justModal.descricao}</p>
            </div>
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block mb-1">Justificação</label>
              <textarea value={justText} onChange={e => setJustText(e.target.value)}
                placeholder="Ex: Juro bancário, reembolso de despesa, transferência interna…"
                rows={3}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-300 resize-none" />
            </div>
            <div className="flex gap-2 pt-1">
              <button onClick={() => { setJustModal(null); setJustText(''); }}
                className="flex-1 px-4 py-2.5 rounded-2xl text-[11px] font-black uppercase tracking-widest border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors">
                Cancelar
              </button>
              <button disabled={!justText.trim() || justSaving} onClick={handleSaveJustificacao}
                className="flex-1 px-4 py-2.5 rounded-2xl text-[11px] font-black uppercase tracking-widest bg-violet-600 text-white hover:bg-violet-700 transition-colors disabled:opacity-40 flex items-center justify-center gap-1.5">
                {justSaving ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle size={13} />} Marcar Ok
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Fatura de fornecedor */}
      {faturaModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-start justify-between">
              <h3 className="text-sm font-black text-slate-800">Ligar a Fatura de Fornecedor</h3>
              <button onClick={() => setFaturaModal(null)} className="text-slate-400 hover:text-slate-600"><X size={16} /></button>
            </div>
            <div className="bg-orange-50 rounded-2xl px-4 py-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-orange-600 mb-1">Transacção</p>
              <p className="text-sm font-bold text-slate-800">{fmtEur(Math.abs(parseFloat(faturaModal.valor) || 0))}</p>
              <p className="text-[11px] text-slate-500 mt-0.5">{faturaModal.data}</p>
              <p className="text-[10px] text-slate-400 mt-0.5 break-all">{faturaModal.descricao}</p>
            </div>
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block mb-1">Fatura</label>
              <select value={faturaSelId} onChange={e => setFaturaSelId(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-orange-300 bg-white">
                <option value="">— Selecionar fatura —</option>
                {faturasData.filter(f => f.status !== 'PAGO' && !faturaLinks.some(l => l.fatura_id === f.id))
                  .sort((a, b) => (a.dados?.fornecedor || '').localeCompare(b.dados?.fornecedor || ''))
                  .map(f => (
                    <option key={f.id} value={f.id}>
                      {f.dados?.fornecedor || 'Sem fornecedor'} · {f.dados?.numero_fatura || '—'} · {fmtEur(f.dados?.valor_total)}
                    </option>
                  ))}
              </select>
            </div>
            <div className="flex gap-2 pt-1">
              <button onClick={() => setFaturaModal(null)}
                className="flex-1 px-4 py-2.5 rounded-2xl text-[11px] font-black uppercase tracking-widest border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors">
                Cancelar
              </button>
              <button disabled={!faturaSelId || faturaSaving} onClick={handleSaveAcaoFatura}
                className="flex-1 px-4 py-2.5 rounded-2xl text-[11px] font-black uppercase tracking-widest bg-orange-600 text-white hover:bg-orange-700 transition-colors disabled:opacity-40 flex items-center justify-center gap-1.5">
                {faturaSaving ? <Loader2 size={13} className="animate-spin" /> : <FileMinus size={13} />} Ligar Fatura
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Recibo de trabalhador */}
      {reciboModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-start justify-between">
              <h3 className="text-sm font-black text-slate-800">Ligar a Recibo de Trabalhador</h3>
              <button onClick={() => setReciboModal(null)} className="text-slate-400 hover:text-slate-600"><X size={16} /></button>
            </div>
            <div className="bg-teal-50 rounded-2xl px-4 py-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-teal-600 mb-1">Transacção</p>
              <p className="text-sm font-bold text-slate-800">{fmtEur(Math.abs(parseFloat(reciboModal.valor) || 0))}</p>
              <p className="text-[11px] text-slate-500 mt-0.5">{reciboModal.data}</p>
              <p className="text-[10px] text-slate-400 mt-0.5 break-all">{reciboModal.descricao}</p>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block mb-1">Trabalhador</label>
                <select
                  value={reciboWorkerName}
                  onChange={e => {
                    const selected = e.target.value;
                    setReciboWorkerName(selected);
                    const workerReceipt = receipts.find(r => r.worker_name === selected);
                    setReciboWorkerId(workerReceipt?.worker_id || '');
                    // Pré-selecionar mês anterior (recibo de Abril pago em Maio)
                    const prevM = previousMonth(reciboModal.data);
                    const hasPrev = receipts.some(r => r.worker_name === selected && r.mes === prevM);
                    setReciboMes(hasPrev ? prevM : (workerReceipt?.mes || ''));
                  }}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-300 bg-white"
                >
                  <option value="">— Selecionar trabalhador —</option>
                  {[...new Set(receipts.map(r => r.worker_name))].sort().map(name => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
              </div>
              {reciboWorkerName && (
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block mb-1">Mês do recibo</label>
                  <select
                    value={reciboMes}
                    onChange={e => setReciboMes(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-300 bg-white"
                  >
                    <option value="">— Selecionar mês —</option>
                    {receipts
                      .filter(r => r.worker_name === reciboWorkerName)
                      .sort((a, b) => b.mes.localeCompare(a.mes))
                      .map(r => (
                        <option key={r.mes} value={r.mes}>
                          {fmtMes(r.mes)} — {fmtEur(r.liquido_extraido)}
                        </option>
                      ))}
                  </select>
                </div>
              )}
            </div>
            <div className="flex gap-2 pt-1">
              <button onClick={() => setReciboModal(null)}
                className="flex-1 px-4 py-2.5 rounded-2xl text-[11px] font-black uppercase tracking-widest border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors">
                Cancelar
              </button>
              <button
                disabled={!reciboWorkerName || !reciboMes || reciboSaving}
                onClick={handleSaveAcaoRecibo}
                className="flex-1 px-4 py-2.5 rounded-2xl text-[11px] font-black uppercase tracking-widest bg-teal-600 text-white hover:bg-teal-700 transition-colors disabled:opacity-40 flex items-center justify-center gap-1.5">
                {reciboSaving ? <Loader2 size={13} className="animate-spin" /> : <UserCheck size={13} />} Ligar Recibo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Novo Alias */}
      {addAliasModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-start justify-between">
              <h3 className="text-sm font-black text-slate-800">Novo Alias</h3>
              <button onClick={() => setAddAliasModal(false)} className="text-slate-400 hover:text-slate-600"><X size={16} /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block mb-1">Nome do banco/remetente</label>
                <input type="text" value={addAliasName} onChange={e => setAddAliasName(e.target.value)}
                  placeholder="Ex: EMPRESA EXEMPLO LDA"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block mb-1">Resolução</label>
                <div className="flex gap-2">
                  {[
                    { val: 'interno',      label: 'Interno',  cfg: STATUS_CFG['Interno'] },
                    { val: 'nota_credito', label: 'Cliente',  cfg: STATUS_CFG['Nota Crédito'] },
                  ].map(({ val, label, cfg }) => (
                    <button key={val} onClick={() => setAddAliasResolucao(val)}
                      className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border-2 transition-all ${addAliasResolucao === val ? `border-current ${cfg.bg} ${cfg.text}` : 'border-slate-200 text-slate-400 hover:border-slate-300'}`}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              {addAliasResolucao === 'nota_credito' && (
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block mb-1">Cliente</label>
                  <select value={addAliasClientId} onChange={e => setAddAliasClientId(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white">
                    <option value="">— Selecionar cliente —</option>
                    {(clients || []).sort((a, b) => (a.name || '').localeCompare(b.name || '')).map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            <div className="flex gap-2 pt-1">
              <button onClick={() => setAddAliasModal(false)}
                className="flex-1 px-4 py-2.5 rounded-2xl text-[11px] font-black uppercase tracking-widest border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors">
                Cancelar
              </button>
              <button
                disabled={!addAliasName.trim() || (addAliasResolucao === 'nota_credito' && !addAliasClientId) || addAliasSaving}
                onClick={handleSaveNovoAlias}
                className="flex-1 px-4 py-2.5 rounded-2xl text-[11px] font-black uppercase tracking-widest bg-indigo-600 text-white hover:bg-indigo-700 transition-colors disabled:opacity-40 flex items-center justify-center gap-1.5">
                {addAliasSaving ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />} Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
