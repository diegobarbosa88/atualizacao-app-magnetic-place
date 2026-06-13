import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import TxRow from './TxRow';
import { STATUS_KEYS, statusTx, fmtEur, fmtMes } from './txUtils';

export default function MovMesCard({ mes, txs, pagamentos, justificacoes, internos, notasCredito, reciboLinks, faturaLinks, impostos, faturasData, clients, onJustificar, onRemoverJustificacao, onMarcarInterno, onDesfazerInterno, onMarcarImposto, onDesfazerImposto, onAcaoCliente, onDesfazerCliente, onOpenNcManual, onAcaoRecibo, onDesfazerRecibo, onAcaoFatura, onDesfazerFatura, onSelectRun }) {
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
          <div className="flex-1 min-w-0">
            {/* linha principal */}
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${allOk ? 'bg-emerald-500' : 'bg-amber-400'}`} />
              <span
                onClick={e => { e.stopPropagation(); onSelectRun && txs[0]?.run_id && onSelectRun(txs[0].run_id); }}
                className="text-sm font-bold text-indigo-600 hover:text-indigo-800 hover:underline cursor-pointer"
                title="Clique para ver este mês num extrato específico"
                role="button"
                tabIndex={0}
                onKeyDown={e => e.key === 'Enter' && onSelectRun && txs[0]?.run_id && onSelectRun(txs[0].run_id)}
              >{fmtMes(mes)}</span>
            </div>
            {/* linha secundária */}
            <div className="flex items-center gap-2 mt-0.5 pl-4">
              <span className="text-[10px] text-slate-400">{txs.length} transacção(ões)</span>
              {!allOk && (
                <span className="text-[10px] font-black uppercase tracking-widest text-amber-600">
                  · {semCliente} s/ resolver
                </span>
              )}
              {allOk && (
                <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600">· Tudo Ok</span>
              )}
            </div>
          </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className={`text-[11px] font-black ${totalMes < 0 ? 'text-rose-600' : 'text-slate-600'}`}>
            {totalMes < 0 ? '-' : ''}{fmtEur(Math.abs(totalMes))}
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
              onOpenNcManual={onOpenNcManual}
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
