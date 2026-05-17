import React, { useState, useEffect } from 'react';
import { Upload, CheckCircle, XCircle, AlertCircle, Loader2, ReceiptText } from 'lucide-react';
import { validarReciboTOConline } from '../../utils/validarReciboTOConline';
import { useApp } from '../../context/AppContext';

const MESES_PT = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

const mesesDisponiveis = Array.from({ length: 12 }, (_, i) => {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - i);
  const value = d.toISOString().slice(0, 7);
  const label = `${MESES_PT[d.getMonth()]} ${d.getFullYear()}`;
  return { value, label };
});

const ValidarReciboAdmin = ({ workers = [] }) => {
  const { logs = [] } = useApp();
  const [workerId, setWorkerId] = useState('');
  const [mes, setMes] = useState(mesesDisponiveis[0].value);
  const [bruto, setBruto] = useState('');
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState(null);

  // Recalcular bruto sempre que trabalhador ou mês mudar — igual ao CostReports
  useEffect(() => {
    if (!workerId) { setBruto(''); return; }
    const logsDoMes = logs.filter(l => l.workerId === workerId && l.date?.startsWith(mes));
    const totalHoras = logsDoMes.reduce((s, l) => s + (parseFloat(l.hours) || 0), 0);
    const worker = workers.find(w => w.id === workerId);
    const custo = totalHoras * (worker?.valorHora || 0);
    setBruto(custo > 0 ? custo.toFixed(2) : '');
    setResultado(null);
  }, [workerId, mes, logs]);

  const handleFile = (e) => {
    const f = e.target.files[0];
    if (f && f.type === 'application/pdf') {
      setFile(f);
      setResultado(null);
    }
  };

  const handleValidar = async () => {
    if (!file || !bruto || !workerId) return;
    setLoading(true);
    setResultado(null);
    const res = await validarReciboTOConline(file, parseFloat(bruto.replace(',', '.')));
    setResultado(res);
    setLoading(false);
  };

  const podeValidar = !!file && !!bruto && !!workerId && !loading;

  return (
    <div className="max-w-lg mx-auto space-y-5">
      {/* Trabalhador */}
      <div>
        <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1.5 block">
          Trabalhador
        </label>
        <select
          value={workerId}
          onChange={e => { setWorkerId(e.target.value); setResultado(null); }}
          className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">Selecionar trabalhador...</option>
          {workers
            .filter(w => !w.isAdmin)
            .sort((a, b) => a.name.localeCompare(b.name))
            .map(w => (
              <option key={w.id} value={w.id}>{w.name}</option>
            ))}
        </select>
      </div>

      {/* Mês */}
      <div>
        <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1.5 block">
          Mês do Recibo
        </label>
        <select
          value={mes}
          onChange={e => { setMes(e.target.value); setResultado(null); }}
          className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500"
        >
          {mesesDisponiveis.map(m => (
            <option key={m.value} value={m.value}>{m.label}</option>
          ))}
        </select>
      </div>

      {/* Bruto — calculado a partir dos logs, editável */}
      <div>
        <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1.5 block">
          Total Bruto da Plataforma (€)
        </label>
        <input
          type="number"
          min="0"
          step="0.01"
          placeholder="ex: 3249.00"
          value={bruto}
          onChange={e => { setBruto(e.target.value); setResultado(null); }}
          className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500"
        />
        {bruto && (
          <p className="text-[10px] text-slate-400 mt-1 ml-1">Calculado a partir dos registos de horas · editável</p>
        )}
      </div>

      {/* Upload PDF */}
      <div>
        <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1.5 block">
          Recibo TOConline (PDF)
        </label>
        <label className="flex items-center gap-3 p-3 bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl cursor-pointer hover:border-indigo-400 hover:bg-indigo-50 transition-all">
          <Upload size={18} className="text-slate-400 shrink-0" />
          <span className="text-sm text-slate-500 truncate">
            {file ? file.name : 'Clique para selecionar o PDF...'}
          </span>
          <input type="file" accept=".pdf" className="hidden" onChange={handleFile} />
        </label>
      </div>

      {/* Botão */}
      <button
        onClick={handleValidar}
        disabled={!podeValidar}
        className="w-full py-3 bg-indigo-600 text-white rounded-xl text-sm font-black uppercase tracking-widest hover:bg-slate-900 transition-all shadow-md shadow-indigo-200 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {loading ? <Loader2 size={16} className="animate-spin" /> : <ReceiptText size={16} />}
        {loading ? 'A validar...' : 'Validar Recibo'}
      </button>

      {/* Resultado */}
      {resultado && (
        <div className={`rounded-2xl border p-5 space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300 ${
          !resultado.sucesso
            ? 'bg-amber-50 border-amber-200'
            : resultado.valido
            ? 'bg-emerald-50 border-emerald-200'
            : 'bg-red-50 border-red-200'
        }`}>
          <div className="flex items-center gap-2">
            {!resultado.sucesso ? (
              <AlertCircle size={20} className="text-amber-500 shrink-0" />
            ) : resultado.valido ? (
              <CheckCircle size={20} className="text-emerald-600 shrink-0" />
            ) : (
              <XCircle size={20} className="text-red-500 shrink-0" />
            )}
            <p className="text-sm font-bold text-slate-800">{resultado.mensagem}</p>
          </div>

          {resultado.sucesso && (
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-white rounded-xl p-3 text-center border border-slate-100">
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Abonos</p>
                <p className="text-sm font-black text-slate-800">{resultado.abonosExtraidos?.toFixed(2)}€</p>
              </div>
              <div className="bg-white rounded-xl p-3 text-center border border-slate-100">
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Descontos</p>
                <p className="text-sm font-black text-slate-800">{resultado.descontosExtraidos?.toFixed(2)}€</p>
              </div>
              <div className="bg-white rounded-xl p-3 text-center border border-slate-100">
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Líquido</p>
                <p className="text-sm font-black text-slate-800">{resultado.liquidoExtraido?.toFixed(2)}€</p>
              </div>
            </div>
          )}

          {resultado.sucesso && !resultado.valido && (
            <div className="bg-white rounded-xl p-3 flex items-center justify-between border border-red-100">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Divergência</span>
              <span className="text-sm font-black text-red-600">{resultado.divergencia?.toFixed(2)}€</span>
            </div>
          )}

          {!resultado.sucesso && resultado._textoExtraido && (
            <details className="mt-2">
              <summary className="text-[10px] font-black uppercase tracking-widest text-slate-400 cursor-pointer select-none">
                Texto extraído do PDF (debug)
              </summary>
              <pre className="mt-2 text-[10px] text-slate-600 bg-white border border-slate-200 rounded-xl p-3 overflow-auto max-h-60 whitespace-pre-wrap break-all">
                {resultado._textoExtraido}
              </pre>
            </details>
          )}
        </div>
      )}
    </div>
  );
};

export default ValidarReciboAdmin;
