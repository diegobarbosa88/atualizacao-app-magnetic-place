import React, { useState, useRef } from 'react';
import {
  Upload, FileSpreadsheet, CheckCircle2, AlertTriangle,
  HelpCircle, Loader2, ArrowRight,
} from 'lucide-react';
import ModalShell from '../../../components/common/ModalShell';
import { PROFISSOES_EMPRESA, findProfissaoByCodigo } from '../../../data/profissoesEmpresa';
import { CNP_PROFISSOES } from '../../../data/cnpProfissoes';

// ─── Normalização ────────────────────────────────────────────────────────────

function norm(str = '') {
  return str
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// ─── Parsing CSV (Windows-1252) ───────────────────────────────────────────────

function splitLinha(linha, sep) {
  const out = [];
  let cur = '';
  let inQ = false;
  for (const c of linha) {
    if (c === '"') { inQ = !inQ; }
    else if (c === sep && !inQ) { out.push(cur.trim()); cur = ''; }
    else cur += c;
  }
  out.push(cur.trim());
  return out;
}

function parsearCSV(text) {
  const linhas = text.split(/\r?\n/).filter(l => l.trim());
  if (linhas.length < 2) return [];
  const sep = linhas[0].includes(';') ? ';' : ',';
  const headers = splitLinha(linhas[0], sep).map(h => h.replace(/^"|"$/g, '').trim());
  return linhas.slice(1).map(linha => {
    const vals = splitLinha(linha, sep).map(v => v.replace(/^"|"$/g, '').trim());
    const row = {};
    headers.forEach((h, i) => { row[norm(h)] = vals[i] || ''; });
    row._raw = row; // keep normalized keys
    return row;
  }).filter(r => Object.values(r).some(v => v));
}

// Aceder a coluna por variações normalizadas do nome
function col(row, ...chaves) {
  for (const c of chaves) {
    const v = row[norm(c)];
    if (v?.trim()) return v.trim();
  }
  return '';
}

// ─── Mapeamentos de campo ────────────────────────────────────────────────────

const MODALIDADE_MAP = {
  'sem termo tempo completo':           { tipo_contrato: 'sem_termo',           regime: 'tempo_inteiro' },
  'sem termo tempo parcial':            { tipo_contrato: 'sem_termo',           regime: 'tempo_parcial' },
  'a termo certo tempo completo':       { tipo_contrato: 'termo_certo',         regime: 'tempo_inteiro' },
  'a termo certo tempo parcial':        { tipo_contrato: 'termo_certo',         regime: 'tempo_parcial' },
  'a termo incerto tempo completo':     { tipo_contrato: 'termo_incerto',       regime: 'tempo_inteiro' },
  'a termo incerto tempo parcial':      { tipo_contrato: 'termo_incerto',       regime: 'tempo_parcial' },
  'muito curta duracao':                { tipo_contrato: 'muito_curta_duracao', regime: 'tempo_inteiro' },
  'muito curta duracao tempo completo': { tipo_contrato: 'muito_curta_duracao', regime: 'tempo_inteiro' },
  'muito curta duracao tempo parcial':  { tipo_contrato: 'muito_curta_duracao', regime: 'tempo_parcial' },
};

const TIPO_LABEL = {
  sem_termo: 'Sem Termo', termo_certo: 'A Termo Certo',
  termo_incerto: 'A Termo Incerto', muito_curta_duracao: 'Muito Curta Duração',
};
const REGIME_LABEL   = { tempo_inteiro: 'Tempo Inteiro', tempo_parcial: 'Tempo Parcial' };
const PRESTACAO_MAP  = { presencial: 'presencial', teletrabalho: 'remoto', 'teletrabalho parcial': 'hibrido', hibrido: 'hibrido' };
const MODO_LABEL     = { presencial: 'Presencial', remoto: 'Remoto (Teletrabalho)', hibrido: 'Híbrido (Teletrabalho parcial)' };

// ─── Match de profissão (CPP) ────────────────────────────────────────────────

function matchProfissao(csvProfissao) {
  if (!csvProfissao?.trim()) return null;
  const n = norm(csvProfissao);

  // 1. rotulo exacto (lista empresa)
  let p = PROFISSOES_EMPRESA.find(x => norm(x.rotulo) === n);
  if (p) return { codigoCPP: p.codigoCPP, designacaoModal: p.designacaoModal, profissao: p.rotulo };

  // 2. CSV contido em designacaoModal
  p = PROFISSOES_EMPRESA.find(x => norm(x.designacaoModal).includes(n));
  if (p) return { codigoCPP: p.codigoCPP, designacaoModal: p.designacaoModal, profissao: p.rotulo };

  // 3. designacaoModal começa com CSV
  p = PROFISSOES_EMPRESA.find(x => norm(x.designacaoModal).startsWith(n));
  if (p) return { codigoCPP: p.codigoCPP, designacaoModal: p.designacaoModal, profissao: p.rotulo };

  // 4. Lista CNP completa — exacto
  let c = CNP_PROFISSOES.find(x => norm(x.nome) === n);
  if (c) return { codigoCPP: c.codigo, designacaoModal: c.nome, profissao: c.nome };

  // 5. Lista CNP — começa com CSV (ex: "Serralheiro civil" em "Serralheiro Civil / ...")
  c = CNP_PROFISSOES.find(x => norm(x.nome).startsWith(n));
  if (c) return { codigoCPP: c.codigo, designacaoModal: c.nome, profissao: c.nome };

  return null;
}

// ─── Conversão de números e datas ────────────────────────────────────────────

function parsarNumPT(str) {
  if (!str?.trim()) return null;
  const n = parseFloat(str.replace(/\./g, '').replace(',', '.'));
  return isNaN(n) ? null : n;
}

function parsarData(str) {
  if (!str?.trim()) return null;
  const m = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  return null;
}

// ─── Calcula diferenças para um trabalhador ───────────────────────────────────

function computarAlteracoes(csvRow, worker) {
  const alts = [];

  const push = (campo, label, valorAtual, valorCSV, novoValor, acao, extra = {}) => {
    alts.push({ campo, label, valorAtual: valorAtual || '(vazio)', valorCSV, novoValor, acao, ...extra });
  };

  // ── Profissão CPP ──
  const csvProfissao = col(csvRow, 'Profissão', 'Profissao');
  if (csvProfissao) {
    const match = matchProfissao(csvProfissao);
    const atualCodigo = worker.profissao_cnp || '';
    const atualLabel  = atualCodigo
      ? `${atualCodigo} — ${findProfissaoByCodigo(atualCodigo)?.designacaoModal || worker.profissao || '?'}`
      : '';

    if (match) {
      const valorCSV = `${match.codigoCPP} — ${match.designacaoModal}`;
      if (!atualCodigo) {
        push('profissao_cnp', 'Profissão CPP', atualLabel, valorCSV, match.codigoCPP, 'atualizar', { _profissao: match.profissao });
      } else if (atualCodigo !== match.codigoCPP) {
        push('profissao_cnp', 'Profissão CPP', atualLabel, valorCSV, match.codigoCPP, 'conflito', { _profissao: match.profissao });
      }
    } else {
      push('profissao_cnp', 'Profissão CPP', atualCodigo, `"${csvProfissao}" — sem mapeamento`, null, 'sem_mapeamento');
    }
  }

  // ── Modalidade → tipo_contrato + regime ──
  const csvModal = col(csvRow, 'Modalidade contrato', 'Modalidade de contrato', 'Modalidade Contrato');
  if (csvModal) {
    const mapped = MODALIDADE_MAP[norm(csvModal)];
    if (mapped) {
      const atualTipo = worker.tipo_contrato || 'sem_termo';
      if (atualTipo !== mapped.tipo_contrato) {
        push('tipo_contrato', 'Tipo de Contrato',
          TIPO_LABEL[atualTipo] || atualTipo,
          TIPO_LABEL[mapped.tipo_contrato] || mapped.tipo_contrato,
          mapped.tipo_contrato, 'conflito');
      }
      const atualRegime = worker.regime || 'tempo_inteiro';
      if (atualRegime !== mapped.regime) {
        push('regime', 'Regime',
          REGIME_LABEL[atualRegime] || atualRegime,
          REGIME_LABEL[mapped.regime] || mapped.regime,
          mapped.regime, 'conflito');
      }
    } else {
      push('tipo_contrato', 'Modalidade de Contrato', worker.tipo_contrato || 'sem_termo', csvModal, null, 'sem_mapeamento');
    }
  }

  // ── Prestação de trabalho → modo_trabalho ──
  const csvPrest = col(csvRow, 'Prestação trabalho', 'Prestação de trabalho', 'Prestacao trabalho');
  if (csvPrest) {
    const mappedModo = PRESTACAO_MAP[norm(csvPrest)];
    if (mappedModo) {
      const atualModo = worker.modo_trabalho || 'presencial';
      if (atualModo !== mappedModo) {
        push('modo_trabalho', 'Modo de Trabalho',
          MODO_LABEL[atualModo] || atualModo,
          MODO_LABEL[mappedModo] || mappedModo,
          mappedModo, 'conflito');
      }
    } else {
      push('modo_trabalho', 'Modo de Trabalho', worker.modo_trabalho || 'presencial', csvPrest, null, 'sem_mapeamento');
    }
  }

  // ── Horas de trabalho → horas_semanais ──
  const csvHoras = col(csvRow, 'Horas trabalho', 'Horas de trabalho', 'Horas Trabalho');
  if (csvHoras) {
    const horasNum = parsarNumPT(csvHoras.replace(',', '.'));
    if (horasNum !== null) {
      const atualH = worker.horas_semanais ?? null;
      if (atualH === null || Math.abs(atualH - horasNum) > 0.01) {
        push('horas_semanais', 'Horas / Semana',
          atualH !== null ? String(atualH) : '',
          String(horasNum), horasNum,
          atualH === null ? 'atualizar' : 'conflito');
      }
    }
  }

  // ── Remuneração base → vencimento_base (só se app estiver vazio) ──
  const csvRemun = col(csvRow, 'Remuneração base(€)', 'Remuneracao base(€)', 'Remuneração base', 'Remuneração Base');
  if (csvRemun) {
    const remNum = parsarNumPT(csvRemun);
    if (remNum !== null && remNum > 0) {
      const atualR = worker.vencimento_base;
      if (!atualR || atualR === 0) {
        push('vencimento_base', 'Vencimento Base (€)', '', `€ ${remNum.toFixed(2)}`, remNum, 'atualizar');
      } else if (Math.abs(parseFloat(atualR) - remNum) > 0.01) {
        push('vencimento_base', 'Vencimento Base (€)',
          `€ ${parseFloat(atualR).toFixed(2)}`, `€ ${remNum.toFixed(2)}`, remNum, 'conflito');
      }
    }
  }

  // ── Data início (só se app estiver vazia) ──
  const csvDataInicio = col(csvRow, 'Data início', 'Data de início', 'Data inicio', 'Data Inicio');
  if (csvDataInicio) {
    const dataISO = parsarData(csvDataInicio);
    if (dataISO && !worker.dataInicio) {
      push('dataInicio', 'Data de Início', '', csvDataInicio, dataISO, 'atualizar');
    }
  }

  // ── Admissão SS já comunicada (estes contratos constam na SS) ──
  if (!worker.ss_admissao_comunicada_em) {
    push('ss_admissao_comunicada_em', 'Admissão SS',
      'Não sincronizada', 'Consta na SS Direta',
      new Date().toISOString(), 'atualizar');
  }

  return alts;
}

// ─── Componente principal ────────────────────────────────────────────────────

export default function ImportarContratosSSDModal({ workers, onClose, onImportado }) {
  const supabase = window.supabaseInstance;

  const [passo,         setPasso]         = useState('upload');
  const [rows,          setRows]          = useState([]);        // { csvRow, worker, alteracoes }[]
  const [naoEncontr,    setNaoEncontr]    = useState([]);        // NISS sem match
  const [decisoes,      setDecisoes]      = useState({});        // {`wid_campo`: 'aplicar'|'ignorar'}
  const [salvando,      setSalvando]      = useState(false);
  const [resultado,     setResultado]     = useState(null);
  const [erro,          setErro]          = useState('');
  const fileRef = useRef();

  // ── Upload e parse ──

  const handleFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setErro('');
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const text = new TextDecoder('windows-1252').decode(ev.target.result);
        const csvRows = parsearCSV(text);
        if (!csvRows.length) {
          setErro('Não foram encontrados dados. Confirma que o ficheiro é o CSV exportado da SS Direta.');
          return;
        }
        const matched = [], naoMatch = [];
        for (const csvRow of csvRows) {
          const niss = col(csvRow, 'NISS', 'Niss').replace(/\D/g, '');
          if (!niss) continue;
          const worker = workers.find(w => (w.nis || '').replace(/\D/g, '') === niss);
          if (!worker) {
            naoMatch.push({ niss, nome: col(csvRow, 'Nome trabalhador', 'Nome') || niss });
          } else {
            matched.push({ csvRow, worker, alteracoes: computarAlteracoes(csvRow, worker) });
          }
        }
        setRows(matched);
        setNaoEncontr(naoMatch);
        setPasso('preview');
      } catch (err) {
        setErro('Erro ao ler o ficheiro: ' + err.message);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // ── Decisão por campo (conflitos) ──

  const getDecisao = (workerId, campo, acao) => {
    const key = `${workerId}_${campo}`;
    // atualizar → por defeito "aplicar"; conflito → por defeito "ignorar" (seguro)
    return decisoes[key] ?? (acao === 'atualizar' ? 'aplicar' : 'ignorar');
  };

  const setDecisao = (workerId, campo, valor) =>
    setDecisoes(prev => ({ ...prev, [`${workerId}_${campo}`]: valor }));

  // ── Contadores ──

  const totalAplicar = rows.reduce((acc, { worker, alteracoes }) =>
    acc + alteracoes.filter(a => a.acao !== 'sem_mapeamento' && getDecisao(worker.id, a.campo, a.acao) === 'aplicar').length
  , 0);

  const totalConflitos = rows.reduce((acc, { alteracoes }) =>
    acc + alteracoes.filter(a => a.acao === 'conflito').length
  , 0);

  // ── Guardar ──

  const handleGuardar = async () => {
    setSalvando(true);
    setErro('');
    let ok = 0, fail = 0;

    for (const { worker, alteracoes } of rows) {
      const updates = {};
      for (const alt of alteracoes) {
        if (alt.acao === 'sem_mapeamento') continue;
        if (getDecisao(worker.id, alt.campo, alt.acao) !== 'aplicar') continue;
        updates[alt.campo] = alt.novoValor;
        if (alt.campo === 'profissao_cnp' && alt._profissao) {
          updates.profissao = alt._profissao;
        }
      }
      if (Object.keys(updates).length === 0) continue;
      const { error } = await supabase.from('workers').update(updates).eq('id', worker.id);
      if (error) fail++; else ok++;
    }

    setSalvando(false);
    setResultado({ ok, fail });
    setPasso('done');
    if (ok > 0 && onImportado) onImportado();
  };

  // ── Render helpers ──

  const AcaoBadge = ({ alt, workerId }) => {
    if (alt.acao === 'sem_mapeamento') {
      return (
        <span className="flex items-center gap-1 text-amber-600 font-bold text-[10px]">
          <HelpCircle size={11} /> Sem mapeamento
        </span>
      );
    }
    if (alt.acao === 'atualizar') {
      return (
        <span className="flex items-center gap-1 font-bold text-[10px]" style={{ color: '#869AAF' }}>
          <ArrowRight size={11} /> Atualizar
        </span>
      );
    }
    // conflito
    const decisao = getDecisao(workerId, alt.campo, alt.acao);
    return (
      <div className="flex gap-1">
        <button
          onClick={() => setDecisao(workerId, alt.campo, 'aplicar')}
          className={`px-2 py-0.5 rounded text-[10px] font-black transition-all ${decisao === 'aplicar' ? 'text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
          style={decisao === 'aplicar' ? { backgroundColor: '#1B3A57' } : {}}
        >
          Usar CSV
        </button>
        <button
          onClick={() => setDecisao(workerId, alt.campo, 'ignorar')}
          className={`px-2 py-0.5 rounded text-[10px] font-black transition-all ${decisao === 'ignorar' ? 'bg-slate-600 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
        >
          Manter
        </button>
      </div>
    );
  };

  // ── JSX ──

  return (
    <ModalShell
      isOpen
      onClose={onClose}
      title="Importar Contratos da SS Direta"
      meta="Emprego → Vínculos de trabalhadores → Exportar CSV"
      icon={<FileSpreadsheet size={20} />}
      accent="brand"
      size="3xl"
      closeOnOverlay={false}
      footer={
        passo === 'preview' ? (
          <div className="px-5 py-4 flex items-center justify-between">
            <button
              onClick={() => { setPasso('upload'); setRows([]); setNaoEncontr([]); setDecisoes({}); }}
              className="text-sm font-bold text-slate-400 hover:text-slate-600 transition-colors"
            >
              ← Voltar
            </button>
            <div className="flex items-center gap-3">
              <p className="text-xs text-slate-400">
                {totalAplicar} campo{totalAplicar !== 1 ? 's' : ''} a atualizar
              </p>
              <button
                onClick={handleGuardar}
                disabled={salvando || totalAplicar === 0}
                className="flex items-center gap-2 px-5 py-2.5 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-2xl text-sm font-black uppercase tracking-widest transition-all"
                style={{ backgroundColor: '#EB8D00', color: '#1B3A57' }}
              >
                {salvando
                  ? <><Loader2 size={14} className="animate-spin" /> A guardar…</>
                  : 'Confirmar e Importar'
                }
              </button>
            </div>
          </div>
        ) : passo === 'done' ? (
          <div className="px-5 py-4">
            <button
              onClick={onClose}
              className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl text-sm font-black uppercase tracking-widest transition-all"
            >
              Fechar
            </button>
          </div>
        ) : null
      }
    >
      <>

          {/* ── Upload ── */}
          {passo === 'upload' && (
            <div className="px-8 py-14 flex flex-col items-center gap-5">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ backgroundColor: 'rgba(134,154,175,0.15)' }}>
                <Upload size={28} style={{ color: '#869AAF' }} />
              </div>
              <div className="text-center space-y-1.5">
                <p className="text-base font-bold text-slate-700">CSV exportado da Segurança Social Direta</p>
                <p className="text-sm text-slate-400">Emprego → Vínculos de trabalhadores → Exportar</p>
                <p className="text-xs text-slate-300">Encoding Windows-1252 · separador ponto-e-vírgula</p>
              </div>
              <button
                onClick={() => fileRef.current?.click()}
                className="px-7 py-3 text-white rounded-2xl text-sm font-black uppercase tracking-widest transition-all hover:opacity-90"
                style={{ backgroundColor: '#1B3A57' }}
              >
                Selecionar ficheiro .csv
              </button>
              <input ref={fileRef} type="file" accept=".csv,.txt" className="hidden" onChange={handleFile} />
              {erro && (
                <p className="text-sm text-rose-500 font-bold text-center max-w-sm bg-rose-50 border border-rose-200 rounded-xl px-4 py-3">
                  {erro}
                </p>
              )}
            </div>
          )}

          {/* ── Preview ── */}
          {passo === 'preview' && (
            <>
              {/* Stats bar */}
              <div className="px-5 py-2.5 border-b border-slate-100 bg-slate-50 flex items-center gap-4 text-xs">
                <span className="font-bold text-slate-500">
                  <span className="text-slate-800 font-black">{rows.length}</span> correspondências ·{' '}
                  <span className={totalConflitos ? 'text-amber-600 font-black' : 'text-slate-400'}>{totalConflitos}</span> conflitos ·{' '}
                  <span className={naoEncontr.length ? 'text-rose-500 font-black' : 'text-slate-400'}>{naoEncontr.length}</span> sem NISS na app
                </span>
                {totalConflitos > 0 && (
                  <span className="ml-auto text-amber-600 font-medium">
                    Conflitos mostram "Usar CSV" / "Manter" — por defeito mantém o valor da app
                  </span>
                )}
              </div>

              {/* Por trabalhador */}
              {rows.map(({ worker, alteracoes }) => {
                const comAlts = alteracoes.filter(a => a.acao !== undefined);
                const semAlts = comAlts.length === 0;
                return (
                  <div key={worker.id} className="border-b border-slate-100 last:border-0">
                    {/* Nome / NISS */}
                    <div className="px-5 py-2 bg-slate-50/70 flex items-center gap-2.5">
                      <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: '#1B3A57' }}>
                        <span className="text-[8px] font-black uppercase" style={{ color: '#EB8D00' }}>{worker.name.charAt(0)}</span>
                      </div>
                      <p className="text-xs font-black text-slate-700">{worker.name}</p>
                      <span className="text-[10px] text-slate-400 font-mono">· {worker.nis}</span>
                      {semAlts && (
                        <span className="ml-auto flex items-center gap-1 text-[10px] font-bold text-emerald-500">
                          <CheckCircle2 size={11} /> Já sincronizado
                        </span>
                      )}
                    </div>

                    {/* Tabela de alterações */}
                    {!semAlts && (
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b border-slate-50">
                              <th className="text-left px-5 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider" style={{width:'22%'}}>Campo</th>
                              <th className="text-left px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider" style={{width:'28%'}}>Valor Atual (App)</th>
                              <th className="text-left px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider" style={{width:'28%'}}>Valor SS Direta</th>
                              <th className="text-left px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Ação</th>
                            </tr>
                          </thead>
                          <tbody>
                            {comAlts.map(alt => (
                              <tr
                                key={alt.campo}
                                className={`border-b border-slate-50 last:border-0 ${alt.acao === 'sem_mapeamento' ? 'bg-amber-50/40' : alt.acao === 'conflito' ? 'bg-slate-50/60' : ''}`}
                              >
                                <td className="px-5 py-2 font-semibold text-slate-700">{alt.label}</td>
                                <td className="px-3 py-2 text-slate-400 text-[11px]">{alt.valorAtual}</td>
                                <td className="px-3 py-2 font-semibold text-slate-800 text-[11px]">{alt.valorCSV}</td>
                                <td className="px-3 py-2">
                                  <AcaoBadge alt={alt} workerId={worker.id} />
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Não encontrados */}
              {naoEncontr.length > 0 && (
                <div className="px-5 py-4 border-t border-slate-100 bg-rose-50/30">
                  <p className="text-[10px] font-black uppercase tracking-wider text-rose-500 mb-2 flex items-center gap-1.5">
                    <AlertTriangle size={11} /> Não encontrados na app — {naoEncontr.length} linha{naoEncontr.length !== 1 ? 's' : ''}
                  </p>
                  <p className="text-[10px] text-slate-400 mb-2">
                    NISS sem correspondência. Confirma que o campo NIS do trabalhador está preenchido corretamente.
                  </p>
                  <div className="space-y-1">
                    {naoEncontr.map(({ niss, nome }) => (
                      <div key={niss} className="flex items-center gap-3 text-xs text-slate-500">
                        <span className="font-mono text-[10px] text-slate-400 w-28 shrink-0">{niss}</span>
                        <span>{nome}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* ── Resultado ── */}
          {passo === 'done' && (
            <div className="px-8 py-14 flex flex-col items-center gap-5 text-center">
              {resultado?.fail === 0
                ? <CheckCircle2 size={48} className="text-emerald-500" />
                : <AlertTriangle size={48} className="text-amber-500" />
              }
              <div className="space-y-1">
                <p className="font-black text-slate-800 text-lg">
                  {resultado?.ok} trabalhador{resultado?.ok !== 1 ? 'es' : ''} atualizado{resultado?.ok !== 1 ? 's' : ''}
                </p>
                <p className="text-sm text-slate-400">Os dados de contrato foram sincronizados com o perfil de cada trabalhador.</p>
                {resultado?.fail > 0 && (
                  <p className="text-sm text-rose-500 font-bold mt-2">
                    {resultado.fail} erro{resultado.fail !== 1 ? 's' : ''} ao guardar — verifica a consola
                  </p>
                )}
              </div>
            </div>
          )}

      </>
    </ModalShell>
  );
}
