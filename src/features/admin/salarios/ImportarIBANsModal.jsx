import React, { useState, useRef } from 'react';
import { Landmark, Upload, X, CheckCircle2, AlertCircle, HelpCircle } from 'lucide-react';

function normalizar(str = '') {
  return str
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function parsearXLS(xmlText) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, 'text/xml');
  const ns = 'urn:schemas-microsoft-com:office:spreadsheet';

  const worksheets = Array.from(doc.getElementsByTagNameNS(ns, 'Worksheet'));
  const folha = worksheets.find(ws =>
    ws.getAttributeNS(ns, 'Name') === 'Empregados'
  );
  if (!folha) return [];

  const rows = Array.from(folha.getElementsByTagNameNS(ns, 'Row'));
  const resultado = [];

  // Primeira linha é cabeçalho — encontrar índice da coluna "Conta"
  const cabecalho = rows[0];
  const headerCells = Array.from(cabecalho.getElementsByTagNameNS(ns, 'Cell'));
  let idxConta = -1;
  headerCells.forEach((cell, i) => {
    const data = cell.getElementsByTagNameNS(ns, 'Data')[0];
    const txt = data?.textContent?.trim() || '';
    if (txt === 'Conta') idxConta = i;
  });
  if (idxConta < 0) idxConta = 5; // fallback: coluna 6 (0-based 5)

  for (let r = 1; r < rows.length; r++) {
    const cells = Array.from(rows[r].getElementsByTagNameNS(ns, 'Cell'));
    const getCellValue = idx => {
      // Cells podem ter atributo ss:Index para colunas esparsas
      // Reconstruir array completo por Index
      const cellsByIndex = {};
      cells.forEach(c => {
        const idxAttr = c.getAttributeNS(ns, 'Index');
        const pos = idxAttr ? parseInt(idxAttr, 10) - 1 : null;
        if (pos !== null) cellsByIndex[pos] = c;
      });
      // Preencher posições sem Index com ordem sequencial
      let cursor = 0;
      const ordered = [];
      cells.forEach(c => {
        const idxAttr = c.getAttributeNS(ns, 'Index');
        if (idxAttr) cursor = parseInt(idxAttr, 10) - 1;
        ordered[cursor] = c;
        cursor++;
      });
      return ordered[idx]?.getElementsByTagNameNS(ns, 'Data')[0]?.textContent?.trim() || '';
    };

    const nome = getCellValue(0);
    const iban = getCellValue(idxConta).replace(/\s/g, '').toUpperCase();
    if (nome && iban) resultado.push({ nome, iban });
  }
  return resultado;
}

function matchWorkers(entradas, workers) {
  return entradas.map(entrada => {
    const normEntrada = normalizar(entrada.nome);
    // Exacto
    let worker = workers.find(w => normalizar(w.name) === normEntrada);
    // Parcial: todos os tokens do ficheiro presentes no nome do worker
    if (!worker) {
      const tokens = normEntrada.split(' ').filter(Boolean);
      worker = workers.find(w => {
        const normW = normalizar(w.name);
        return tokens.every(t => normW.includes(t));
      });
    }
    // Parcial inverso: todos os tokens do worker no nome do ficheiro
    if (!worker) {
      worker = workers.find(w => {
        const tokens = normalizar(w.name).split(' ').filter(Boolean);
        return tokens.length >= 2 && tokens.every(t => normEntrada.includes(t));
      });
    }
    const jaTemIban = worker?.iban?.replace(/\s/g, '').toUpperCase() === entrada.iban;
    return { ...entrada, workerId: worker?.id || null, workerName: worker?.name || null, jaTemIban };
  });
}

export default function ImportarIBANsModal({ workers, supabase, onClose, onImportado }) {
  const [passo, setPasso] = useState('upload'); // upload | preview | done
  const [entradas, setEntradas] = useState([]);
  const [overrides, setOverrides] = useState({}); // idx → workerId
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [resultado, setResultado] = useState(null);
  const fileRef = useRef();

  const handleFile = e => {
    const file = e.target.files[0];
    if (!file) return;
    setErro('');
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const text = ev.target.result;
        const parsed = parsearXLS(text);
        if (parsed.length === 0) {
          setErro('Não foram encontrados dados na folha "Empregados". Verifica o ficheiro.');
          return;
        }
        const matched = matchWorkers(parsed, workers);
        setEntradas(matched);
        setPasso('preview');
      } catch (err) {
        setErro('Erro ao ler o ficheiro: ' + err.message);
      }
    };
    reader.readAsText(file, 'iso-8859-1');
  };

  const getWorkerId = idx => overrides[idx] ?? entradas[idx]?.workerId;

  const seleccionados = entradas.filter((_, idx) => {
    const wid = getWorkerId(idx);
    if (!wid) return false;
    if (entradas[idx].jaTemIban && !overrides[idx]) return false; // já tem este IBAN — skip
    return true;
  });

  const handleGuardar = async () => {
    setSalvando(true);
    setErro('');
    let ok = 0, fail = 0;
    for (let idx = 0; idx < entradas.length; idx++) {
      const wid = getWorkerId(idx);
      if (!wid) continue;
      const entrada = entradas[idx];
      if (entrada.jaTemIban && !overrides[idx]) continue;
      const { error } = await supabase
        .from('workers')
        .update({ iban: entrada.iban })
        .eq('id', wid);
      if (error) fail++;
      else ok++;
    }
    setSalvando(false);
    setResultado({ ok, fail });
    setPasso('done');
    if (ok > 0 && onImportado) onImportado();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Landmark size={15} className="text-indigo-500" />
            <p className="text-[12px] font-black uppercase tracking-widest text-slate-700">Importar IBANs</p>
          </div>
          <button onClick={onClose} className="text-slate-300 hover:text-slate-600 transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Corpo */}
        <div className="flex-1 overflow-y-auto">

          {passo === 'upload' && (
            <div className="px-5 py-8 flex flex-col items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-indigo-50 flex items-center justify-center">
                <Upload size={28} className="text-indigo-400" />
              </div>
              <div className="text-center">
                <p className="text-sm font-bold text-slate-700">Lista de Beneficiários (.xls)</p>
                <p className="text-[11px] text-slate-400 mt-1">Exportado do novobanco — folha "Empregados"</p>
              </div>
              <button
                onClick={() => fileRef.current?.click()}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all"
              >
                Seleccionar ficheiro
              </button>
              <input ref={fileRef} type="file" accept=".xls,.xml" className="hidden" onChange={handleFile} />
              {erro && <p className="text-[11px] text-rose-500 font-bold text-center">{erro}</p>}
            </div>
          )}

          {passo === 'preview' && (
            <>
              <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between flex-shrink-0">
                <p className="text-[10px] text-slate-400">
                  <span className="font-black text-slate-700">{entradas.length}</span> registos encontrados ·{' '}
                  <span className="font-black text-indigo-600">{seleccionados.length}</span> a actualizar
                </p>
                <p className="text-[9px] text-slate-400 uppercase tracking-widest font-bold">Folha: Empregados</p>
              </div>

              <div className="divide-y divide-slate-50">
                {entradas.map((entrada, idx) => {
                  const wid = getWorkerId(idx);
                  const workerActual = workers.find(w => w.id === wid);
                  const semMatch = !wid;
                  const jaIgual = entrada.jaTemIban && !overrides[idx];

                  return (
                    <div key={idx} className={`px-5 py-3 ${jaIgual ? 'opacity-40' : ''}`}>
                      <div className="flex items-start gap-2">
                        <div className="mt-0.5">
                          {jaIgual
                            ? <CheckCircle2 size={13} className="text-emerald-400" />
                            : semMatch
                            ? <HelpCircle size={13} className="text-amber-400" />
                            : <CheckCircle2 size={13} className="text-indigo-500" />
                          }
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] font-bold text-slate-700 truncate">{entrada.nome}</p>
                          <p className="text-[10px] font-mono text-slate-400">{entrada.iban}</p>
                          {jaIgual && (
                            <p className="text-[9px] text-emerald-500 font-bold mt-0.5">IBAN já registado — sem alteração</p>
                          )}
                          {!jaIgual && (
                            <select
                              value={wid || ''}
                              onChange={e => setOverrides(prev => ({ ...prev, [idx]: e.target.value || null }))}
                              className="mt-1.5 w-full border border-slate-200 rounded-xl px-2 py-1 text-[10px] text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
                            >
                              <option value="">— sem correspondência —</option>
                              {workers
                                .filter(w => w.status === 'ativo' || w.status === 'inativo')
                                .sort((a, b) => a.name.localeCompare(b.name))
                                .map(w => (
                                  <option key={w.id} value={w.id}>
                                    {w.name}{w.iban ? ` (${w.iban.slice(0, 8)}…)` : ' (sem IBAN)'}
                                  </option>
                                ))
                              }
                            </select>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {passo === 'done' && (
            <div className="px-5 py-10 flex flex-col items-center gap-4 text-center">
              {resultado.fail === 0
                ? <CheckCircle2 size={40} className="text-emerald-500" />
                : <AlertCircle size={40} className="text-amber-500" />
              }
              <div>
                <p className="font-black text-slate-700 text-sm">
                  {resultado.ok} IBAN{resultado.ok !== 1 ? 's' : ''} guardado{resultado.ok !== 1 ? 's' : ''} com sucesso
                </p>
                {resultado.fail > 0 && (
                  <p className="text-[11px] text-rose-500 mt-1">{resultado.fail} erro{resultado.fail !== 1 ? 's' : ''} ao guardar</p>
                )}
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        {passo === 'preview' && (
          <div className="px-5 py-4 border-t border-slate-100 flex items-center justify-between flex-shrink-0">
            <button
              onClick={() => { setPasso('upload'); setEntradas([]); setOverrides({}); }}
              className="text-[11px] font-bold text-slate-400 hover:text-slate-600 transition-colors"
            >
              Voltar
            </button>
            <button
              onClick={handleGuardar}
              disabled={salvando || seleccionados.length === 0}
              className="flex items-center gap-1.5 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all"
            >
              {salvando ? 'A guardar…' : `Guardar ${seleccionados.length} IBAN${seleccionados.length !== 1 ? 's' : ''}`}
            </button>
          </div>
        )}

        {passo === 'done' && (
          <div className="px-5 py-4 border-t border-slate-100 flex-shrink-0">
            <button
              onClick={onClose}
              className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all"
            >
              Fechar
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
