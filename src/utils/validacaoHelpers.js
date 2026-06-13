import { CheckCircle, AlertTriangle, XCircle, AlertCircle } from 'lucide-react';

export const MESES_PT = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

export const mesesDisponiveis = Array.from({ length: 12 }, (_, i) => {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - i);
  return { value: d.toISOString().slice(0, 7), label: `${MESES_PT[d.getMonth()]} ${d.getFullYear()}` };
});

export function normalizarNome(str) {
  return str.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

// Trabalhadores isentos de validação automática — recibo é sempre marcado como válido
export const TRABALHADORES_SEMPRE_VALIDOS = [
  'diego rocha barbosa',
  'nicole emanuele rosa da costa galtieri',
].map(normalizarNome);

export function isWorkerSempreValido(worker) {
  if (!worker?.name) return false;
  return TRABALHADORES_SEMPRE_VALIDOS.includes(normalizarNome(worker.name));
}

export function aplicarOverrideSempreValido(resultado, worker) {
  if (!resultado?.sucesso || !isWorkerSempreValido(worker)) return resultado;
  return {
    ...resultado,
    valido: true,
    aviso: false,
    divergencia: 0,
    divergenciaSinal: 0,
    mensagem: 'Recibo marcado como válido (trabalhador isento de validação automática).',
  };
}

export function encontrarWorker(nomeExtraido, workers) {
  if (!nomeExtraido) return null;
  const n = normalizarNome(nomeExtraido);

  // 1. correspondência exata
  let found = workers.find(w => normalizarNome(w.name) === n);
  if (found) return found;

  // 2. um nome contém o outro (substring)
  found = workers.find(w => { const wn = normalizarNome(w.name); return wn.includes(n) || n.includes(wn); });
  if (found) return found;

  // 3. palavras significativas em comum (≥3 chars) — apanha "da/de" intercalados
  const nWords = n.split(/\s+/).filter(w => w.length >= 3);
  found = workers.find(w => {
    const wWords = normalizarNome(w.name).split(/\s+/).filter(w => w.length >= 3);
    const comuns = nWords.filter(nw => wWords.includes(nw));
    return comuns.length >= 2 && comuns.length / Math.max(nWords.length, wWords.length) >= 0.6;
  });
  return found ?? null;
}

export function estadoBg(r) {
  if (!r.sucesso) return 'bg-amber-50 border-amber-200';
  if (r.valido)   return 'bg-emerald-50 border-emerald-200';
  if (r.aviso)    return 'bg-yellow-50 border-yellow-200';
  return               'bg-red-50 border-red-200';
}

export function estadoLabel(r) {
  if (!r.sucesso) return 'Erro';
  if (r.valido)   return 'Válido';
  if (r.aviso)    return 'Aviso';
  return               'Inválido';
}

export const ESTADOS_OPTIONS = [
  { id: 'valido',   label: 'Válido',   Icon: CheckCircle,   color: 'text-emerald-500' },
  { id: 'aviso',    label: 'Aviso',    Icon: AlertTriangle, color: 'text-yellow-500' },
  { id: 'invalido', label: 'Inválido', Icon: XCircle,       color: 'text-red-500' },
  { id: 'erro',     label: 'Erro',     Icon: AlertCircle,   color: 'text-amber-500' },
];

// Deriva o objeto "r" (com sucesso/valido/aviso) a partir do estado string
export function estadoStringToFlags(estado) {
  if (estado === 'valido')   return { sucesso: true,  valido: true,  aviso: false };
  if (estado === 'aviso')    return { sucesso: true,  valido: false, aviso: true  };
  if (estado === 'invalido') return { sucesso: true,  valido: false, aviso: false };
  return                            { sucesso: false, valido: false, aviso: false }; // erro
}

// ─── Guardar no Supabase ───────────────────────────────────────────────────────
export async function guardarValidacao(r, extra = {}) {
  const db = window.supabaseInstance;
  if (!db) throw new Error('Supabase não disponível');
  const { error } = await db.from('receipt_validations').insert({
    worker_id:        extra.worker?.id   ?? r.worker?.id   ?? null,
    worker_name:      extra.worker?.name ?? r.worker?.name ?? r.nomeExtraido ?? null,
    mes:              extra.mes  ?? r.mes  ?? null,
    bruto_plataforma: extra.bruto ?? r.bruto ?? null,
    abonos_extraidos: r.abonosExtraidos ?? null,
    ss_extraido:      r.ssExtraido      ?? null,
    irs_extraido:     r.irsExtraido     ?? null,
    liquido_extraido: r.liquidoExtraido ?? null,
    ajudas_custo_extraidas: r.ajudasCustoExtraido ?? null,
    divergencia:      r.divergencia     ?? null,
    estado:           !r.sucesso ? 'erro' : r.valido ? 'valido' : r.aviso ? 'aviso' : 'invalido',
    mensagem:         r.mensagem ?? null,
    origem:           r.origem ?? extra.origem ?? null,
    session_id:       extra.sessionId ?? null,
    bruto_extraido:   r.abonosExtraidos ?? null,
  });
  if (error) throw error;
}

// ─── Helper de formatação de mês ──────────────────────────────────────────────
export function formatarMes(mesStr) {
  if (!mesStr || mesStr === '—') return '—';
  const [ano, m] = mesStr.split('-');
  return `${MESES_PT[parseInt(m, 10) - 1]} ${ano}`;
}

export const ESTADO_BADGE = {
  valido:   'bg-emerald-100 text-emerald-700',
  aviso:    'bg-yellow-100 text-yellow-700',
  invalido: 'bg-red-100 text-red-600',
  erro:     'bg-amber-100 text-amber-700',
};

export const ESTADO_PT = { valido: 'Válido', aviso: 'Aviso', invalido: 'Inválido', erro: 'Erro' };

export function agruparPorSessao(registos) {
  const mapa = new Map();
  for (const r of registos) {
    const key = r.session_id ?? r.id;
    if (!mapa.has(key)) mapa.set(key, []);
    mapa.get(key).push(r);
  }
  return [...mapa.values()].sort((a, b) =>
    new Date(b[0].created_at) - new Date(a[0].created_at)
  );
}

export function formatarDataHora(isoStr) {
  const d = new Date(isoStr);
  return d.toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', year: 'numeric' })
    + ' · ' + d.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
}

export const STATUS_DOC = {
  Rascunho: { label: 'Rascunho',   cls: 'bg-slate-100 text-slate-500' },
  Pendente:  { label: 'Disponível', cls: 'bg-blue-100 text-blue-600' },
  Enviado:   { label: 'Enviado',    cls: 'bg-emerald-100 text-emerald-700' },
  Assinado:  { label: 'Assinado',   cls: 'bg-emerald-100 text-emerald-700' },
  signed:    { label: 'Assinado',   cls: 'bg-emerald-100 text-emerald-700' },
};
