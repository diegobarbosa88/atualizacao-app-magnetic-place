import React, { useState, useMemo, useEffect, useCallback } from 'react';
import emailjs from '@emailjs/browser';
import { callGemini } from '../../utils/aiUtils';
import { EMAILJS_SERVICE_ID, EMAILJS_PUBLIC_KEY, EMAILJS_TEMPLATE_ID_NOTIF } from '../../utils/emailUtils';
import SectionHeaderShell from '../../components/common/SectionHeaderShell';
import {
  Download, Sparkles, Share2, X, Copy, Send, Loader2, Calculator,
  ChevronLeft, ChevronRight, CheckCircle, AlertTriangle,
} from 'lucide-react';

const MESES_PT = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

// Igual à função usada em useCostReportsData.js
function getRateAtDate(logDate, history, currentRate) {
  if (!history || history.length === 0) return Number(currentRate) || 0;
  const sorted = [...history].sort((a, b) => new Date(a.data_alteracao) - new Date(b.data_alteracao));
  const firstDate = sorted[0].data_alteracao.substring(0, 10);
  if (logDate < firstDate) return Number(sorted[0].valor_anterior) || 0;
  for (let i = sorted.length - 1; i >= 0; i--) {
    if (logDate >= sorted[i].data_alteracao.substring(0, 10)) return Number(sorted[i].valor_novo) || 0;
  }
  return Number(currentRate) || 0;
}

function fmtEur(val) {
  return Number(val || 0).toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}

export default function ContabilidadeTab({ workers, supabase, systemSettings }) {
  const now = new Date();
  const [selectedYear, setSelectedYear]       = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth]     = useState(now.getMonth() + 1);
  const [logsData, setLogsData]               = useState([]);
  const [rateHistory, setRateHistory]         = useState([]);
  const [contabRows, setContabRows]           = useState([]);
  const [localEdits, setLocalEdits]           = useState({});
  const [isLoading, setIsLoading]             = useState(false);
  const [savingId, setSavingId]               = useState(null);
  const [geminiAnalysis, setGeminiAnalysis]   = useState('');
  const [isLoadingGemini, setIsLoadingGemini] = useState(false);
  const [geminiError, setGeminiError]         = useState('');
  const [showShareModal, setShowShareModal]   = useState(false);
  const [shareEmail, setShareEmail]           = useState('contabilidade@magnetic.pt');
  const [emailSent, setEmailSent]             = useState(false);
  const [emailSending, setEmailSending]       = useState(false);
  const [copyOk, setCopyOk]                   = useState(false);

  const mesStr  = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`;
  const nomeMes = MESES_PT[selectedMonth - 1];

  // Carrega logs do mês + histórico de taxas + dados editáveis (contabilidade_mensal)
  useEffect(() => {
    if (!supabase) return;
    setIsLoading(true);
    Promise.all([
      supabase.from('logs').select('id,workerId,date,hours').like('date', `${mesStr}%`),
      supabase.from('worker_valorhora_history').select('*'),
      supabase.from('contabilidade_mensal').select('*').eq('mes', mesStr),
    ]).then(([logsRes, rateRes, contabRes]) => {
      setLogsData(logsRes.data || []);
      setRateHistory(rateRes.data || []);
      setContabRows(contabRes.data || []);
      setLocalEdits({});
    }).finally(() => setIsLoading(false));
  }, [supabase, mesStr]);

  // Custo dos logs = mesmo cálculo de Custos/Equipa (horas × taxa correta por data)
  const calcCustoLogs = useCallback((workerId, defaultRate) => {
    const workerHistory = rateHistory.filter(h => h.worker_id === workerId);
    return logsData
      .filter(l => l.workerId === workerId)
      .reduce((sum, log) => {
        const rate = getRateAtDate(log.date, workerHistory, defaultRate || 0);
        return sum + (Number(log.hours) || 0) * rate;
      }, 0);
  }, [logsData, rateHistory]);

  const getContabRow = useCallback((workerId) => {
    const dbRow = contabRows.find(r => r.worker_id === workerId);
    const local = localEdits[workerId] || {};
    return {
      dias_trabalhados: local.dias_trabalhados ?? dbRow?.dias_trabalhados ?? 22,
      observacoes:      local.observacoes      ?? dbRow?.observacoes      ?? '',
    };
  }, [contabRows, localEdits]);

  const rows = useMemo(() => {
    const activeWorkers = (workers || []).filter(w => w.status === 'ativo');
    return activeWorkers.map(worker => {
      const contab        = getContabRow(worker.id);
      // Ordenado Bruto = custo dos logs (igual a Custos/Equipa)
      const ordenadoBruto = calcCustoLogs(worker.id, worker.valorHora);
      // Salário Base vem do perfil do trabalhador
      const salarioBase   = Number(worker.vencimento_base) || 0;
      // Sub. Alimentação = dias editáveis × valor diário do perfil
      const mealTotal     = (Number(worker.subsidio_alimentacao_dia) || 0) * Number(contab.dias_trabalhados);
      // Ajudas = valor que falta para fechar o Ordenado Bruto
      const ajudas        = ordenadoBruto - salarioBase - mealTotal;
      return { worker, ...contab, salarioBase, mealTotal, ajudas, ordenadoBruto };
    });
  }, [workers, calcCustoLogs, getContabRow]);

  const totals = useMemo(() => rows.reduce((acc, r) => ({
    salarioBase:  acc.salarioBase  + r.salarioBase,
    mealTotal:    acc.mealTotal    + r.mealTotal,
    ajudas:       acc.ajudas       + r.ajudas,
    ordenadoBruto: acc.ordenadoBruto + r.ordenadoBruto,
  }), { salarioBase: 0, mealTotal: 0, ajudas: 0, ordenadoBruto: 0 }), [rows]);

  const handleEdit = (workerId, field, value) => {
    setLocalEdits(prev => ({
      ...prev,
      [workerId]: { ...(prev[workerId] || {}), [field]: value },
    }));
  };

  const handleBlur = async (workerId) => {
    if (!supabase || !localEdits[workerId]) return;
    setSavingId(workerId);
    const contab = getContabRow(workerId);
    await supabase.from('contabilidade_mensal').upsert({
      worker_id:        workerId,
      mes:              mesStr,
      dias_trabalhados: Number(contab.dias_trabalhados) || 22,
      observacoes:      contab.observacoes || '',
    }, { onConflict: 'worker_id,mes' });
    const { data } = await supabase.from('contabilidade_mensal').select('*').eq('mes', mesStr);
    setContabRows(data || []);
    setSavingId(null);
  };

  const handleExportCSV = () => {
    const filename = `ORDENADO BRUTO MAGNETIC ${selectedYear} -(AJUDASDECUSTOS ${nomeMes}).csv`;
    const header = [
      '"Nome Trabalhador"', '"NIF"', '"Empresa"', '"Morada"',
      '"Início Vínculo"', '"Cessação Vínculo"', '"Salário Base (€)"',
      '"Subsídio de Alimentação (€)"', '"Ajudas de Custo / Outros (€)"',
      '"Ordenado Bruto (€)"', '"Observações"',
    ].join(';');
    const csvRows = rows.map(r => [
      `"${r.worker.name}"`,
      `"${r.worker.nif || '-'}"`,
      `"MAGNETIC"`,
      `"${r.worker.address || '-'}"`,
      `"${r.worker.dataInicio || '-'}"`,
      `"${r.worker.dataFim || '-'}"`,
      r.salarioBase.toFixed(2),
      r.mealTotal.toFixed(2),
      r.ajudas.toFixed(2),
      r.ordenadoBruto.toFixed(2),
      `"${r.observacoes || ''}"`,
    ].join(';'));
    const blob = new Blob(['﻿' + [header, ...csvRows].join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  };

  const handleGeminiAudit = async () => {
    const apiKey = systemSettings?.geminiApiKey;
    if (!apiKey) { setGeminiError('Chave Gemini não configurada nas definições.'); return; }
    setIsLoadingGemini(true); setGeminiError(''); setGeminiAnalysis('');
    const prompt = `Folha de ordenado bruto — ${nomeMes} ${selectedYear}:\n` +
      rows.map(r =>
        `${r.worker.name}: Base ${r.salarioBase.toFixed(2)}€, ` +
        `Alimentação ${r.mealTotal.toFixed(2)}€ (${r.dias_trabalhados} dias × ${Number(r.worker.subsidio_alimentacao_dia) || 0}€), ` +
        `Ajudas ${r.ajudas.toFixed(2)}€, Bruto Total ${r.ordenadoBruto.toFixed(2)}€`
      ).join('\n');
    const sys = 'Analisa os valores de ajudas de custo e subsídio de alimentação com base no regime fiscal português. Destaca alertas de limites de isenção de IRS/SS (subsídio alimentação em cartão: limite isento 10.20€/dia em 2024; ajudas de custo: limites legais por categoria profissional). Responde em português.';
    try {
      const resultado = await callGemini(prompt, sys, apiKey);
      setGeminiAnalysis(resultado);
    } catch {
      setGeminiError('Erro ao contactar a IA. Verifique a chave Gemini nas definições.');
    } finally {
      setIsLoadingGemini(false);
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(import.meta.env.VITE_ACCOUNTANT_PORTAL_URL || window.location.origin);
    setCopyOk(true);
    setTimeout(() => setCopyOk(false), 2000);
  };

  const handleSendEmail = async () => {
    setEmailSending(true);
    try {
      await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID_NOTIF, {
        to_email: shareEmail,
        to_name: 'Contabilista',
        notification_title: `Folha de Ordenados Brutos — ${nomeMes} ${selectedYear}`,
        notification_message: `A folha de ordenado bruto MAGNETIC de ${nomeMes} ${selectedYear} está disponível para consulta.`,
        link_unico: import.meta.env.VITE_ACCOUNTANT_PORTAL_URL || window.location.origin,
      }, EMAILJS_PUBLIC_KEY);
      setEmailSent(true);
      setTimeout(() => setEmailSent(false), 3000);
    } catch {
      alert('Erro ao enviar e-mail. Verifique as configurações do EmailJS.');
    } finally {
      setEmailSending(false);
    }
  };

  const prevMonth = () => {
    if (selectedMonth === 1) { setSelectedMonth(12); setSelectedYear(y => y - 1); }
    else setSelectedMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (selectedMonth === 12) { setSelectedMonth(1); setSelectedYear(y => y + 1); }
    else setSelectedMonth(m => m + 1);
  };

  const INPUT_CLS      = 'w-full border-0 bg-transparent focus:bg-white focus:ring-1 focus:ring-blue-300 focus:rounded px-1 text-right text-sm outline-none';
  const INPUT_TEXT_CLS = 'w-full border-0 bg-transparent focus:bg-white focus:ring-1 focus:ring-blue-300 focus:rounded px-1 text-sm outline-none';

  return (
    <div className="flex flex-col gap-4 p-4 sm:p-6 min-h-full">

      {/* CABEÇALHO */}
      <SectionHeaderShell
        icon={<Calculator size={18} />}
        title="Contabilidade"
        subtitle="Ordenado Bruto Mensal"
        rightSlot={(
          <div className="flex flex-wrap items-center gap-3">
            {/* Navegação mês */}
            <div className="flex items-center gap-1 bg-white/10 rounded-xl p-1">
              <button onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors">
                <ChevronLeft size={16} className="text-white" />
              </button>
              <span className="px-3 py-1 text-sm font-black text-white capitalize min-w-[140px] text-center">
                {nomeMes} {selectedYear}
              </span>
              <button onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors">
                <ChevronRight size={16} className="text-white" />
              </button>
            </div>

            {/* Ações */}
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={handleGeminiAudit}
                disabled={isLoadingGemini}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-black uppercase tracking-wider bg-violet-50 text-violet-700 border border-violet-200 hover:bg-violet-100 transition-colors disabled:opacity-50"
              >
                {isLoadingGemini ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                Análise IA
              </button>
              <button
                onClick={() => setShowShareModal(true)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-black uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 transition-colors"
              >
                <Share2 size={14} /> Partilhar
              </button>
              <button
                onClick={handleExportCSV}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-black uppercase tracking-wider bg-emerald-600 text-white hover:bg-emerald-700 transition-colors shadow-sm"
              >
                <Download size={14} /> Exportar CSV
              </button>
            </div>
          </div>
        )}
      />

      {/* TABELA */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16 gap-3 text-slate-400">
            <Loader2 size={22} className="animate-spin" />
            <span className="text-sm font-bold">A carregar dados…</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead className="sticky top-0 z-10 bg-slate-50 border-b-2 border-slate-200">
                <tr>
                  <th className="text-left px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-wider whitespace-nowrap">Colaborador</th>
                  <th className="text-right px-3 py-3 text-[10px] font-black text-slate-500 uppercase tracking-wider whitespace-nowrap">Salário Base (€)</th>
                  <th className="text-center px-3 py-3 text-[10px] font-black text-slate-500 uppercase tracking-wider whitespace-nowrap">Dias</th>
                  <th className="text-right px-3 py-3 text-[10px] font-black text-slate-500 uppercase tracking-wider whitespace-nowrap">Sub. Alimentação (€)</th>
                  <th className="text-right px-3 py-3 text-[10px] font-black text-slate-500 uppercase tracking-wider whitespace-nowrap">Ajudas / Outros (€)</th>
                  <th className="text-right px-3 py-3 text-[10px] font-black text-emerald-700 uppercase tracking-wider whitespace-nowrap bg-emerald-50">Ordenado Bruto (€)</th>
                  <th className="text-left px-3 py-3 text-[10px] font-black text-slate-500 uppercase tracking-wider">Observações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-center py-10 text-slate-400 text-sm">
                      Nenhum colaborador ativo encontrado.
                    </td>
                  </tr>
                )}
                {rows.map(r => (
                  <tr key={r.worker.id} className="hover:bg-slate-50/60 transition-colors">

                    {/* Nome */}
                    <td className="px-4 py-2.5">
                      <div className="font-bold text-slate-800 leading-tight">{r.worker.name}</div>
                      {r.worker.nif && <div className="text-[10px] text-slate-400 font-mono">{r.worker.nif}</div>}
                    </td>

                    {/* Salário Base (= Bruto − Sub. Alimentação − Ajudas) */}
                    <td className="px-3 py-2.5 text-right font-bold text-slate-700 whitespace-nowrap tabular-nums">
                      {fmtEur(r.salarioBase)}
                    </td>

                    {/* Dias trabalhados (editável) */}
                    <td className="px-2 py-2.5 w-16 text-center">
                      {savingId === r.worker.id
                        ? <Loader2 size={12} className="animate-spin mx-auto text-slate-300" />
                        : (
                          <input
                            type="number"
                            min={0} max={31}
                            value={r.dias_trabalhados}
                            onChange={e => handleEdit(r.worker.id, 'dias_trabalhados', e.target.value)}
                            onBlur={() => handleBlur(r.worker.id)}
                            className={INPUT_CLS}
                          />
                        )
                      }
                    </td>

                    {/* Sub. Alimentação (dias × subsidio_alimentacao_dia do perfil) */}
                    <td className="px-3 py-2.5 text-right text-slate-600 whitespace-nowrap tabular-nums">
                      {fmtEur(r.mealTotal)}
                      {!Number(r.worker.subsidio_alimentacao_dia) && (
                        <span className="ml-1 text-amber-500 text-[9px]" title="Subsídio/dia não definido no perfil">!</span>
                      )}
                    </td>

                    {/* Ajudas / Outros (calculado: Bruto − Salário Base − Sub. Alimentação) */}
                    <td className="px-3 py-2.5 text-right text-slate-600 whitespace-nowrap tabular-nums">
                      {fmtEur(r.ajudas)}
                    </td>

                    {/* Ordenado Bruto = custo dos logs (igual a Custos/Equipa) */}
                    <td className="px-4 py-2.5 text-right bg-emerald-50 whitespace-nowrap tabular-nums">
                      <span className="font-black text-emerald-700 text-base">{fmtEur(r.ordenadoBruto)}</span>
                    </td>

                    {/* Observações (editável) */}
                    <td className="px-2 py-2.5 min-w-[180px]">
                      <input
                        type="text"
                        value={r.observacoes}
                        onChange={e => handleEdit(r.worker.id, 'observacoes', e.target.value)}
                        onBlur={() => handleBlur(r.worker.id)}
                        className={INPUT_TEXT_CLS}
                        placeholder="Notas para a contabilista…"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
              {rows.length > 0 && (
                <tfoot className="bg-slate-800 text-white">
                  <tr>
                    <td className="px-4 py-3 font-black text-[11px] uppercase tracking-wider">TOTAIS</td>
                    <td className="px-3 py-3 text-right font-black tabular-nums">{fmtEur(totals.salarioBase)}</td>
                    <td></td>
                    <td className="px-3 py-3 text-right font-bold tabular-nums">{fmtEur(totals.mealTotal)}</td>
                    <td className="px-3 py-3 text-right font-bold tabular-nums">{fmtEur(totals.ajudas)}</td>
                    <td className="px-4 py-3 text-right bg-emerald-700 font-black text-lg tabular-nums">{fmtEur(totals.ordenadoBruto)}</td>
                    <td></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </div>

      {/* ANÁLISE GEMINI */}
      {(geminiAnalysis || geminiError) && (
        <div className={`rounded-2xl border p-4 ${geminiError ? 'bg-red-50 border-red-200' : 'bg-violet-50 border-violet-200'}`}>
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 mb-2">
              {geminiError
                ? <AlertTriangle size={16} className="text-red-500" />
                : <Sparkles size={16} className="text-violet-600" />
              }
              <span className="text-[11px] font-black uppercase tracking-wider text-violet-700">
                {geminiError ? 'Erro IA' : 'Análise Fiscal — Gemini AI'}
              </span>
            </div>
            <button onClick={() => { setGeminiAnalysis(''); setGeminiError(''); }} className="text-slate-400 hover:text-slate-600">
              <X size={14} />
            </button>
          </div>
          <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
            {geminiError || geminiAnalysis}
          </p>
        </div>
      )}

      {/* MODAL DE PARTILHA */}
      {showShareModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <Share2 size={18} className="text-blue-600" />
                <h3 className="font-black text-slate-800">Partilhar Folha</h3>
              </div>
              <button onClick={() => { setShowShareModal(false); setEmailSent(false); }} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>

            <p className="text-sm text-slate-500 mb-4">
              Enviar notificação da folha de <strong>{nomeMes} {selectedYear}</strong> por e-mail ou copiar o link do portal.
            </p>

            <div className="mb-4">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1 block">Link do Portal</label>
              <div className="flex gap-2">
                <div className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-600 font-mono truncate">
                  {import.meta.env.VITE_ACCOUNTANT_PORTAL_URL || window.location.origin}
                </div>
                <button
                  onClick={handleCopyLink}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-black uppercase tracking-wider transition-colors ${
                    copyOk ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {copyOk ? <CheckCircle size={14} /> : <Copy size={14} />}
                  {copyOk ? 'Copiado!' : 'Copiar'}
                </button>
              </div>
            </div>

            <div className="mb-5">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1 block">E-mail da Contabilista</label>
              <input
                type="email"
                value={shareEmail}
                onChange={e => setShareEmail(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 transition-all"
                placeholder="contabilidade@empresa.pt"
              />
            </div>

            <button
              onClick={handleSendEmail}
              disabled={emailSending || !shareEmail}
              className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl font-black text-sm uppercase tracking-wider transition-colors ${
                emailSent
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50'
              }`}
            >
              {emailSending ? <Loader2 size={16} className="animate-spin" /> : emailSent ? <CheckCircle size={16} /> : <Send size={16} />}
              {emailSent ? 'E-mail Enviado!' : emailSending ? 'A Enviar…' : 'Enviar Notificação'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
