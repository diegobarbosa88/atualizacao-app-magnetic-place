import React, { useState, useEffect } from 'react';
import { Loader2, FileSearch, Upload, AlertTriangle } from 'lucide-react';
import { parseReciboTOConline } from '../../utils/validarReciboTOConline';
import { separarRecibosTOConline } from '../../utils/separarRecibosTOConline';
import {
  encontrarWorker,
  calcularBrutoDeMes,
  calcularTolerancias,
  formatarMes,
  guardarValidacao,
} from '../../utils/validacaoHelpers';

// Ferramenta para reprocessar recibos já validados em receipt_validations,
// reextraindo os valores diretamente dos PDFs originais em vez das linhas já
// gravadas. Sem caminho automático para buscar os PDFs à API da TOConline
// (não existe fatura_id/documento_id guardado, nem endpoint — ver
// investigação), por isso o re-upload é manual, tal como o fluxo original de
// validação (ModoBursting.jsx).
//
// Passo 1 (dry-run, handleProcessar): reextrai e compara, nunca escreve.
// Passo 2 (handleEscrever): só depois do admin ver o relatório do Passo 1 —
// faz backup das linhas que vão mudar (receipt_validations_backup_pre_reextracao)
// e grava via guardarValidacao() (mesmo fluxo já usado por ModoBursting.jsx,
// para não duplicar lógica de upsert).
const MES_MIN = '2026-01';
const MES_MAX = '2026-05';

const CAMPOS = [
  { key: 'ajudas_custo_extraidas', novoKey: 'ajudasCustoExtraido', label: 'Ajudas Custo' },
  { key: 'abonos_extraidos',       novoKey: 'abonosExtraidos',     label: 'Abonos' },
  { key: 'ss_extraido',            novoKey: 'ssExtraido',          label: 'Seg. Social' },
  { key: 'irs_extraido',           novoKey: 'irsExtraido',         label: 'IRS' },
  { key: 'liquido_extraido',       novoKey: 'liquidoExtraido',     label: 'Líquido' },
  { key: 'bruto_plataforma',       novoKey: 'bruto',               label: 'Bruto Plataforma' },
];

function valoresIguais(a, b) {
  const na = a == null ? null : Number(a);
  const nb = b == null ? null : Number(b);
  if (na == null && nb == null) return true;
  if (na == null || nb == null) return false;
  return Math.abs(na - nb) < 0.005;
}

function fmt(v) {
  return v == null ? '—' : Number(v).toFixed(2) + '€';
}

const ModoReextracao = ({ workers, logs, systemSettings, workerRateHistory = [] }) => {
  const [existentes, setExistentes] = useState(null);
  const [erroExistentes, setErroExistentes] = useState(null);
  const [files, setFiles] = useState([]);
  const [processando, setProcessando] = useState(false);
  const [relatorio, setRelatorio] = useState(null);
  const [escrevendo, setEscrevendo] = useState(false);
  const [resultadoEscrita, setResultadoEscrita] = useState(null);

  const tolerancias = calcularTolerancias(systemSettings);

  useEffect(() => {
    const db = window.supabaseInstance;
    if (!db) return;
    db.from('receipt_validations')
      .select('*')
      .gte('mes', MES_MIN).lte('mes', MES_MAX)
      .eq('estado', 'valido')
      .then(({ data, error }) => {
        if (error) { setErroExistentes(error.message); return; }
        setExistentes(data || []);
      });
  }, []);

  const handleFiles = (e) => {
    const fs = Array.from(e.target.files).filter(f => f.type === 'application/pdf');
    setFiles(fs);
    setRelatorio(null);
    setResultadoEscrita(null);
  };

  const handleProcessar = async () => {
    if (!files.length || !existentes) return;
    setProcessando(true);
    setRelatorio(null);
    setResultadoEscrita(null);

    const processados = [];
    for (const file of files) {
      try {
        // separarRecibosTOConline (mesma função usada por ModoBursting.jsx)
        // agrupa páginas por continuidade de NIF — uma página sem NIF próprio
        // herda o NIF da página anterior. Isto lida corretamente com recibos
        // de 2+ páginas (ex.: trabalhadores com muitas linhas — horas extra,
        // transporte — cujo "Total Abonos" só aparece na página seguinte).
        // A divisão anterior (por presença do texto "Emitido por TOConline",
        // que aparece em TODAS as páginas como rodapé, não só na última)
        // fechava a secção logo na 1ª página, perdendo SS/IRS/Ajudas de
        // Custo — que ficavam a 0 mesmo havendo valor real no recibo.
        const { resultados, orfaos } = await separarRecibosTOConline(file);
        for (const r of resultados) {
          const { nome, mes } = { nome: r.nome, mes: r.mes };
          const worker = nome ? encontrarWorker(nome, workers) : null;
          const bruto = calcularBrutoDeMes(worker, mes, logs, workerRateHistory);
          const validacao = parseReciboTOConline(r.texto, bruto, tolerancias);
          processados.push({ origem: file.name, nomeExtraido: nome, worker, mes, bruto, ...validacao });
        }
        if (resultados.length === 0 && orfaos.length > 0) {
          processados.push({ origem: file.name, erro: `${orfaos.length} página(s) sem NIF identificável — documento não reconhecido como recibo TOConline.` });
        }
      } catch (err) {
        processados.push({ origem: file.name, erro: err.message });
      }
    }

    const linhas = [];
    let nIguais = 0, nMudam = 0, nFalhas = 0, nSemAmbito = 0, nSemExistente = 0;
    const existentesUsados = new Set();

    for (const p of processados) {
      if (p.erro || (p.sucesso === false)) {
        nFalhas++;
        linhas.push({ tipo: 'falha', origem: p.origem, worker: p.worker, mes: p.mes, motivo: p.erro || p.mensagem || 'Falha desconhecida na extração.' });
        continue;
      }
      if (!p.worker || !p.mes || p.mes < MES_MIN || p.mes > MES_MAX) {
        nSemAmbito++;
        linhas.push({ tipo: 'sem-ambito', origem: p.origem, nomeExtraido: p.nomeExtraido, worker: p.worker, mes: p.mes });
        continue;
      }
      const existente = existentes.find(e => e.worker_id === p.worker.id && e.mes === p.mes);
      if (!existente) {
        nSemExistente++;
        linhas.push({ tipo: 'sem-existente', worker: p.worker, mes: p.mes });
        continue;
      }
      existentesUsados.add(existente.id);

      const camposAlterados = CAMPOS
        .map(c => ({ campo: c.label, antigo: existente[c.key], novo: p[c.novoKey] }))
        .filter(c => !valoresIguais(c.antigo, c.novo));

      if (camposAlterados.length === 0) {
        nIguais++;
        linhas.push({ tipo: 'igual', worker: p.worker, mes: p.mes });
      } else {
        nMudam++;
        // Guarda `p` (resultado completo da reextração) e `existente` (linha
        // atual da BD) para o Passo 2 — handleEscrever precisa de ambos
        // (backup do valor antigo + payload completo para guardarValidacao).
        linhas.push({ tipo: 'mudou', worker: p.worker, mes: p.mes, campos: camposAlterados, p, existente });
      }
    }

    const existentesSemPdf = existentes.filter(e => !existentesUsados.has(e.id));

    setRelatorio({ linhas, nIguais, nMudam, nFalhas, nSemAmbito, nSemExistente, existentesSemPdf, totalExistentes: existentes.length });
    setProcessando(false);
  };

  // Passo 2 — só chamado depois do admin ver o relatório do dry-run e clicar
  // "Confirmar e escrever". Para cada linha que muda: (1) faz backup do valor
  // atual em receipt_validations_backup_pre_reextracao, (2) grava o novo
  // valor via guardarValidacao (mesmo upsert já usado por ModoBursting.jsx —
  // onConflict worker_id,mes, por isso atualiza a linha existente em vez de
  // duplicar). Falhas individuais não bloqueiam as restantes.
  const handleEscrever = async () => {
    const db = window.supabaseInstance;
    if (!db || !relatorio) return;
    setEscrevendo(true);
    setResultadoEscrita(null);

    const linhasParaEscrever = relatorio.linhas.filter(l => l.tipo === 'mudou');
    let nAtualizadas = 0;
    const falhas = [];

    for (const l of linhasParaEscrever) {
      try {
        const { error: erroBackup } = await db.from('receipt_validations_backup_pre_reextracao').insert({
          receipt_validation_id: l.existente.id,
          motivo: 'Reextração ModoReextracao.jsx (Passo 2)',
          worker_id: l.existente.worker_id,
          worker_name: l.existente.worker_name,
          mes: l.existente.mes,
          bruto_plataforma: l.existente.bruto_plataforma,
          abonos_extraidos: l.existente.abonos_extraidos,
          ss_extraido: l.existente.ss_extraido,
          irs_extraido: l.existente.irs_extraido,
          liquido_extraido: l.existente.liquido_extraido,
          divergencia: l.existente.divergencia,
          estado: l.existente.estado,
          mensagem: l.existente.mensagem,
          origem: l.existente.origem,
          bruto_extraido: l.existente.bruto_extraido,
          ajudas_custo_extraidas: l.existente.ajudas_custo_extraidas,
        });
        if (erroBackup) throw erroBackup;

        await guardarValidacao(l.p, { worker: l.worker, mes: l.mes, bruto: l.p.bruto });
        nAtualizadas++;
      } catch (e) {
        falhas.push({ worker: l.worker.name, mes: l.mes, erro: e.message });
      }
    }

    setResultadoEscrita({ nAtualizadas, nTentadas: linhasParaEscrever.length, falhas });
    setEscrevendo(false);
  };

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800 font-semibold space-y-1">
        <p>1. Reextração compara sempre em modo dry-run — nada é escrito automaticamente.</p>
        <p>2. Só depois de reveres o relatório, o botão "Confirmar e escrever" grava as alterações — com backup automático de cada linha antes de a sobrescrever.</p>
        <p>Reprocessamento de recibos Jan-Mai 2026 (estado='válido') a partir dos PDFs originais.</p>
      </div>

      {erroExistentes && (
        <p className="text-[10px] text-red-500 font-medium px-1">Erro a carregar linhas existentes: {erroExistentes}</p>
      )}

      {existentes && (
        <p className="text-[10px] text-[var(--slate-dim)] font-medium">
          {existentes.length} linha{existentes.length !== 1 ? 's' : ''} em receipt_validations no âmbito (mes {MES_MIN} a {MES_MAX}, estado='valido').
        </p>
      )}

      <label className="flex flex-col items-center justify-center gap-2 p-8 bg-[var(--surface)] border-2 border-dashed border-[var(--border)] rounded-2xl cursor-pointer hover:border-indigo-400 hover:bg-indigo-50 transition-all">
        <FileSearch size={28} className="text-[var(--slate)]" />
        <span className="text-sm font-bold text-[var(--slate-dim)]">
          {files.length > 0
            ? `${files.length} ficheiro${files.length > 1 ? 's' : ''} selecionado${files.length > 1 ? 's' : ''}`
            : 'Clique para selecionar os PDF(s) originais'}
        </span>
        <span className="text-[10px] text-[var(--slate-dim)]">1 PDF com todos os recibos, ou vários PDFs separados</span>
        <input type="file" accept=".pdf" multiple className="hidden" onChange={handleFiles} />
      </label>

      <button onClick={handleProcessar} disabled={!files.length || !existentes || processando}
        className="w-full py-3 bg-[var(--orange)] text-[var(--navy-solid)] rounded-xl text-sm font-black uppercase tracking-widest hover:bg-[var(--orange-hover)] transition-all shadow-md shadow-[var(--orange-shadow)] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2">
        {processando ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
        {processando ? 'A reextrair e comparar...' : 'Reextrair e comparar (dry-run)'}
      </button>

      {relatorio && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {[
              { label: 'Iguais',          val: relatorio.nIguais,       cls: 'emerald' },
              { label: 'Mudam',           val: relatorio.nMudam,        cls: 'amber'   },
              { label: 'Falhas',          val: relatorio.nFalhas,       cls: 'red'     },
              { label: 'Fora de âmbito',  val: relatorio.nSemAmbito,    cls: 'slate'   },
              { label: 'Sem existente',   val: relatorio.nSemExistente, cls: 'red'     },
            ].map(({ label, val, cls }) => (
              <div key={label} className={`bg-${cls}-50 border border-${cls}-200 rounded-xl p-3 text-center`}>
                <p className={`text-lg font-black text-${cls}-600`}>{val}</p>
                <p className={`text-[9px] font-black uppercase tracking-widest text-${cls}-500`}>{label}</p>
              </div>
            ))}
          </div>

          {relatorio.existentesSemPdf.length > 0 && (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 space-y-1">
              <p className="text-[10px] font-black text-red-600 tracking-widest flex items-center gap-1.5">
                <AlertTriangle size={12} /> {relatorio.existentesSemPdf.length} linha(s) em receipt_validations SEM PDF correspondente nos ficheiros enviados
              </p>
              {relatorio.existentesSemPdf.map(e => (
                <p key={e.id} className="text-[10px] text-red-500">{e.worker_name} · {formatarMes(e.mes)}</p>
              ))}
            </div>
          )}

          {/* Tabela worker_id | mes | campo | valor_antigo | valor_novo — só linhas que mudam */}
          {relatorio.nMudam > 0 && (
            <div className="rounded-2xl border border-[var(--border-soft)] overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-[var(--surface)] border-b border-[var(--border-soft)]">
                  <tr>
                    {['Worker', 'Mês', 'Campo', 'Valor antigo', 'Valor novo'].map(h => (
                      <th key={h} className="px-4 py-2.5 text-left text-[10px] font-black uppercase tracking-widest text-[var(--slate-dim)]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-soft)]">
                  {relatorio.linhas.filter(l => l.tipo === 'mudou').flatMap(l =>
                    l.campos.map((c, i) => (
                      <tr key={`${l.worker.id}-${l.mes}-${c.campo}`} className={i === 0 ? 'border-t-2 border-[var(--border)]' : ''}>
                        <td className="px-4 py-2 font-bold text-[var(--ink-mid)]">{i === 0 ? l.worker.name : ''}</td>
                        <td className="px-4 py-2 text-[var(--slate-dim)]">{i === 0 ? formatarMes(l.mes) : ''}</td>
                        <td className="px-4 py-2 text-[var(--ink-soft)]">{c.campo}</td>
                        <td className="px-4 py-2 text-[var(--slate-dim)]">{fmt(c.antigo)}</td>
                        <td className="px-4 py-2 font-bold text-amber-600">{fmt(c.novo)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {relatorio.nMudam > 0 && !resultadoEscrita && (
            <button onClick={handleEscrever} disabled={escrevendo}
              className="w-full py-3 bg-amber-600 text-white rounded-xl text-sm font-black uppercase tracking-widest hover:bg-amber-700 transition-all shadow-md shadow-amber-200 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2">
              {escrevendo ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
              {escrevendo ? `A gravar (com backup)...` : `Confirmar e escrever ${relatorio.nMudam} linha(s) alterada(s)`}
            </button>
          )}

          {resultadoEscrita && (
            <div className={`rounded-2xl border px-4 py-3 space-y-1 ${resultadoEscrita.falhas.length > 0 ? 'border-amber-200 bg-amber-50' : 'border-emerald-200 bg-emerald-50'}`}>
              <p className={`text-[10px] font-black tracking-widest ${resultadoEscrita.falhas.length > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
                {resultadoEscrita.nAtualizadas}/{resultadoEscrita.nTentadas} linha(s) atualizadas (backup gravado em receipt_validations_backup_pre_reextracao antes de cada escrita)
              </p>
              {resultadoEscrita.falhas.map((f, i) => (
                <p key={i} className="text-[10px] text-red-500">{f.worker} · {formatarMes(f.mes)}: {f.erro}</p>
              ))}
            </div>
          )}

          {relatorio.nFalhas > 0 && (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 space-y-1">
              <p className="text-[10px] font-black text-red-600 tracking-widest mb-1">FALHAS DE EXTRAÇÃO</p>
              {relatorio.linhas.filter(l => l.tipo === 'falha').map((l, i) => (
                <p key={i} className="text-[10px] text-red-500">{l.origem}{l.worker ? ` (${l.worker.name})` : ''}: {l.motivo}</p>
              ))}
            </div>
          )}

          {relatorio.nSemAmbito > 0 && (
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 space-y-1">
              <p className="text-[10px] font-black text-[var(--slate-dim)] tracking-widest mb-1">FORA DE ÂMBITO (mês fora de Jan-Mai 2026, ou trabalhador não reconhecido)</p>
              {relatorio.linhas.filter(l => l.tipo === 'sem-ambito').map((l, i) => (
                <p key={i} className="text-[10px] text-[var(--slate-dim)]">{l.origem}: {l.worker?.name ?? l.nomeExtraido ?? '—'} · {l.mes ?? '—'}</p>
              ))}
            </div>
          )}

          {relatorio.nSemExistente > 0 && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 space-y-1">
              <p className="text-[10px] font-black text-amber-600 tracking-widest mb-1">SEM LINHA EXISTENTE EM receipt_validations (não estava no âmbito válido/Jan-Mai)</p>
              {relatorio.linhas.filter(l => l.tipo === 'sem-existente').map((l, i) => (
                <p key={i} className="text-[10px] text-amber-600">{l.worker.name} · {formatarMes(l.mes)}</p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ModoReextracao;
