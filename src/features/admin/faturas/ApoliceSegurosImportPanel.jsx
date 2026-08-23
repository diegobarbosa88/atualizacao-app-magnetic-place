import React, { useState } from 'react';
import { ShieldCheck, Loader2, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { authFetch } from '../../../utils/authFetch';
import { FT } from '../../../styles/designTokens';

// Importa emails da Allianz (allianz.pt) recebidos em 88diegobarbosa@gmail.com
// com o "Quadro de Pessoal Seguro" anexado, extrai a lista de segurados e compara
// automaticamente contra worker_apolice_seguro (comparar_apolice_seguros) —
// só comparação, não escreve em workers/worker_apolice_seguro. Discrepâncias
// aparecem na pendência discrepancias_apolice do resumo diário do
// Trabalhador Virtual.
export default function ApoliceSegurosImportPanel() {
  const [importando, setImportando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [erro, setErro] = useState(null);

  const importar = async () => {
    setImportando(true);
    setErro(null);
    setResultado(null);
    try {
      const res = await authFetch('/api/gmail/import-faturas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'apolice_seguros' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Falha ao importar.');
      setResultado(data);
    } catch (e) {
      setErro(e.message);
    } finally {
      setImportando(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <ShieldCheck size={18} style={{ color: 'var(--navy)' }} />
          <h3 className="text-sm font-black uppercase tracking-wide" style={{ color: 'var(--navy)' }}>
            Apólice de Seguros (Allianz)
          </h3>
        </div>
        <button
          onClick={importar}
          disabled={importando}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all disabled:opacity-50 text-white hover:opacity-90"
          style={{ backgroundColor: FT.navy }}
        >
          {importando ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
          Importar do Gmail
        </button>
      </div>
      <p className="text-xs text-slate-400 font-semibold mt-2">
        Procura emails da Allianz (allianz.pt) em 88diegobarbosa@gmail.com, extrai o Quadro de Pessoal Seguro e compara com o sistema.
      </p>

      {erro && (
        <div className="mt-3 bg-rose-50 border border-rose-200 text-rose-700 px-3 py-2 rounded-xl text-xs font-semibold flex items-start gap-2">
          <AlertTriangle size={14} className="shrink-0 mt-0.5" />
          <span>{erro}</span>
        </div>
      )}

      {resultado && (
        <div className="mt-3 bg-emerald-50 border border-emerald-200 text-emerald-700 px-3 py-2 rounded-xl text-xs font-semibold flex items-start gap-2">
          <CheckCircle2 size={14} className="shrink-0 mt-0.5" />
          <span>
            {resultado.processados} email(s) processado(s), {resultado.skipped} já importado(s) antes.
            {resultado.erros?.length > 0 && ` ${resultado.erros.length} erro(s) — ver consola.`}
          </span>
        </div>
      )}
    </div>
  );
}
