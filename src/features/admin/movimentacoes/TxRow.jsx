import React from 'react';
import {
  CheckCircle, Undo2, Zap, ArrowLeftRight, MessageSquare,
  Link, FileText, UserCheck, FileMinus, Receipt, Percent,
} from 'lucide-react';
import {
  STATUS_KEYS, STATUS_CFG,
  txKey, clienteLink, statusTx, labelStatus, fmtEur, fmtMes,
} from './txUtils';

export default function TxRow({ tx, pagamentos, justificacoes, internos, notasCredito, reciboLinks, faturaLinks, impostos, faturasData, clients, onJustificar, onRemoverJustificacao, onMarcarInterno, onDesfazerInterno, onMarcarImposto, onDesfazerImposto, onAcaoCliente, onDesfazerCliente, onOpenNcManual, onAcaoRecibo, onDesfazerRecibo, onAcaoFatura, onDesfazerFatura }) {
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

            {status === STATUS_KEYS.COM_CLIENTE && (
              (() => {
                const link = clienteLink(tx, pagamentos);
                const linkClientName = link ? (clients?.find(c => c.id === link.client_id)?.name || link.client_id) : null;
                const linkPeriod = link?.period ? fmtMes(link.period) : null;
                return linkClientName && (
                  <span className="text-[9px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
                    {linkClientName}{linkPeriod ? ` - ${linkPeriod}` : ''}
                  </span>
                );
              })()
            )}
            {status === STATUS_KEYS.COM_CLIENTE && (
              <button onClick={() => onDesfazerCliente(tx)}
                className="flex items-center gap-0.5 px-2 py-0.5 rounded-xl text-[9px] font-black uppercase tracking-widest bg-slate-100 text-slate-500 hover:bg-rose-100 hover:text-rose-600 transition-colors">
                <Undo2 size={9} /> Desfazer
              </button>
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
                  <Link size={9} /> CLIENTE
                </button>
              )}
              {tipo === 'credito' && (
                <button onClick={() => onOpenNcManual(tx)}
                  className="flex items-center gap-1 px-2 py-1 rounded-xl text-[9px] font-black uppercase tracking-widest bg-indigo-100 text-indigo-700 hover:bg-indigo-200 transition-colors">
                  <FileText size={9} /> NC
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
