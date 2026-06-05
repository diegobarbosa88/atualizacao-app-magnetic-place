import React, { useState, useEffect, useRef } from 'react';
import {
  ChevronDown, ChevronUp,
  X, Loader2, Download, FileText, FileArchive, Undo2,
  Tag, Trash2, Zap, Plus,
  TrendingUp, TrendingDown,
  RefreshCw,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { STATUS_KEYS, STATUS_CFG, fmtEur, fmtMes, extractMonthYearName, statusTx } from './movimentacoes/txUtils';
import { useMovData } from './movimentacoes/useMovData';
import { useMovActions } from './movimentacoes/useMovActions';
import { useMovExport } from './movimentacoes/useMovExport';
import { useMovUpload } from './movimentacoes/useMovUpload';
import UploadPreviewZone, { UploadDropZone } from './movimentacoes/UploadPreviewZone';
import MovMesCard from './movimentacoes/MovMesCard';
import InternoModal from './movimentacoes/InternoModal';
import ImpostoModal from './movimentacoes/ImpostoModal';
import JustModal from './movimentacoes/JustModal';
import FaturaModal from './movimentacoes/FaturaModal';
import ReciboModal from './movimentacoes/ReciboModal';
import NcModal from './movimentacoes/NcModal';
import NcManualModal from './movimentacoes/NcManualModal';
import AddAliasModal from './movimentacoes/AddAliasModal';

export default function MovimentacoesTab() {
  const { supabase, clients } = useApp();

  // ── Dados e carregamento ──────────────────────────────────────────────────
  const data = useMovData({ supabase, clients });
  const {
    allTxs, pagamentos, setPagamentos, justificacoes, setJustificacoes,
    internos, setInternos, impostos, setImpostos, notasCredito, setNotasCredito,
    reciboLinks, setReciboLinks, faturaLinks, setFaturaLinks,
    faturasData, setFaturasData, receipts, aliases, setAliases,
    runId, runData, activeRunId, setActiveRunId, allRuns, runMonthYear,
    loading, autoMatching, autoMatchCount, setAutoMatchCount,
    loadRun, handleDeleteRun,
  } = data;

  // ── Upload ────────────────────────────────────────────────────────────────
  const upload = useMovUpload({
    supabase,
    onProcessed: (rid) => { setActiveRunId(rid); loadRun(rid); },
  });

  // ── Acções ────────────────────────────────────────────────────────────────
  const [faturaModal, setFaturaModal] = useState(null);
  const [reciboModal, setReciboModal] = useState(null);
  const [ncModal, setNcModal] = useState(null);
  const [ncManualModal, setNcManualModal] = useState(null);
  const [internoModal, setInternoModal] = useState(null);
  const [impostoModal, setImpostoModal] = useState(null);
  const [justModal, setJustModal] = useState(null);
  const [addAliasModal, setAddAliasModal] = useState(false);

  const actions = useMovActions({
    supabase, runId,
    pagamentos, setPagamentos,
    notasCredito, setNotasCredito,
    internos, setInternos,
    impostos, setImpostos,
    justificacoes, setJustificacoes,
    reciboLinks, setReciboLinks,
    faturaLinks, setFaturaLinks,
    aliases, setAliases,
    faturasData, setFaturasData,
    setNcManualModal,
  });

  // ── UI state ──────────────────────────────────────────────────────────────
  const [filter, setFilter] = useState('all');
  const [showAliases, setShowAliases] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const exportRef = useRef(null);

  useEffect(() => {
    const handleClick = (e) => {
      if (exportRef.current && !exportRef.current.contains(e.target)) setShowExportMenu(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // ── Dados derivados ───────────────────────────────────────────────────────
  const creditos = allTxs.filter(t => t.tipo === 'credito');
  const debitos  = allTxs.filter(t => t.tipo === 'debito');
  const filteredTxs = filter === 'entradas' ? creditos : filter === 'saidas' ? debitos : allTxs;

  const getStatus = tx => statusTx(tx, pagamentos, justificacoes, internos, notasCredito, reciboLinks, faturaLinks, impostos);

  const totalResolvido   = filteredTxs.filter(tx => getStatus(tx) !== STATUS_KEYS.SEM_CLIENTE).length;
  const semResolver      = filteredTxs.filter(tx => getStatus(tx) === STATUS_KEYS.SEM_CLIENTE).length;
  const totalEntradas    = creditos.reduce((s, tx) => s + Math.abs(parseFloat(tx.valor) || 0), 0);
  const totalSaidas      = debitos.reduce((s, tx) => s + Math.abs(parseFloat(tx.valor) || 0), 0);
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

  // ── Export ────────────────────────────────────────────────────────────────
  const { exportingZip, exportProgress, handleExportCsv, handleExportPdf, handleExportZip } = useMovExport({
    supabase, filteredTxs, allTxs, grupos, clients,
    pagamentos, justificacoes, internos, notasCredito, reciboLinks, faturaLinks, impostos,
    faturasData, runData,
    setShowExportMenu,
  });

  // ── Render: upload activo ─────────────────────────────────────────────────
  if (upload.isActive) {
    return <UploadPreviewZone upload={upload} />;
  }

  // ── Render: a carregar ────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3">
        <Loader2 size={24} className="animate-spin text-indigo-400" />
        <p className="text-[11px] text-slate-400">A carregar movimentações do extrato…</p>
      </div>
    );
  }

  // ── Render: principal ─────────────────────────────────────────────────────
  return (
    <div className="space-y-3">
      {/* Upload zone */}
      <UploadDropZone
        dragging={upload.dragging}
        onDragOver={upload.handleDragOver}
        onDragLeave={upload.handleDragLeave}
        onDrop={upload.handleDrop}
        onFiles={upload.handleFileChange}
      />

      {/* Filtros */}
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
              filter === key ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
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

        <button
          onClick={() => loadRun()}
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
                <button onClick={() => { setActiveRunId(r.id); loadRun(r.id); }} className="hover:underline">
                  {runMonthYear[r.id] || extractMonthYearName(r.transactions_json) || r.filename || 'Extrato'}
                </button>
                <button onClick={() => handleDeleteRun(r)} className="ml-1 text-rose-400 hover:text-rose-600" title="Apagar extrato">
                  <X size={10} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* KPIs + controlos */}
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
                <button onClick={handleExportCsv} className="w-full flex items-center gap-2 px-4 py-2.5 text-[11px] font-bold text-slate-700 hover:bg-slate-50 transition-colors">
                  <FileText size={13} className="text-emerald-600" /> CSV
                </button>
                <button onClick={handleExportPdf} className="w-full flex items-center gap-2 px-4 py-2.5 text-[11px] font-bold text-slate-700 hover:bg-slate-50 transition-colors">
                  <FileText size={13} className="text-rose-500" /> PDF
                </button>
                <button onClick={handleExportZip} disabled={exportingZip} className="w-full flex items-center gap-2 px-4 py-2.5 text-[11px] font-bold text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50">
                  {exportingZip ? <Loader2 size={13} className="animate-spin text-indigo-600" /> : <FileArchive size={13} className="text-indigo-600" />}
                  {exportingZip ? `ZIP ${exportProgress.current}/${exportProgress.total}` : 'ZIP'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Totais entradas/saídas */}
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

      {/* Breakdown resolvidos */}
      {totalResolvido > 0 && (
        <div className="flex flex-wrap gap-2 text-[9px] font-black uppercase tracking-widest text-slate-400">
          {comClienteCount  > 0 && <span className="text-emerald-600">{comClienteCount} Com Cliente/Fatura</span>}
          {comReciboCount   > 0 && <><span>·</span><span className="text-teal-600">{comReciboCount} Com Recibo</span></>}
          {comFaturaCount   > 0 && <><span>·</span><span className="text-orange-600">{comFaturaCount} Com Fatura Doc</span></>}
          {notaCreditoCount > 0 && <><span>·</span><span className="text-blue-600">{notaCreditoCount} Com Nota de Crédito</span></>}
          {internoCount     > 0 && <><span>·</span><span className="text-purple-600">{internoCount} Interno</span></>}
          {impostoCount     > 0 && <><span>·</span><span className="text-amber-600">{impostoCount} Imposto</span></>}
          {justCount        > 0 && <><span>·</span><span className="text-violet-600">{justCount} Justificados</span></>}
        </div>
      )}

      {/* Auto-match feedback */}
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
              onClick={() => setAddAliasModal(true)}
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
                      <Icon size={9} /> {a.resolucao === 'interno' ? 'Interno' : a.resolucao === 'com_cliente' ? 'Com Cliente' : 'NC'}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-bold text-slate-700 truncate" title={a.bank_name}>{a.bank_name}</p>
                      {clientName && <p className="text-[9px] text-slate-400">{clientName}</p>}
                    </div>
                    <button onClick={() => actions.handleApagarAlias(a.id)} className="text-slate-300 hover:text-rose-500 transition-colors flex-shrink-0">
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
              onJustificar={tx => setJustModal(tx)}
              onRemoverJustificacao={actions.handleRemoverJustificacao}
              onMarcarInterno={tx => setInternoModal(tx)}
              onDesfazerInterno={actions.handleDesfazerInterno}
              onMarcarImposto={tx => setImpostoModal(tx)}
              onDesfazerImposto={actions.handleDesfazerImposto}
              onAcaoCliente={tx => setNcModal(tx)}
              onDesfazerCliente={actions.handleDesfazerCliente}
              onOpenNcManual={actions.handleOpenNcManual}
              onAcaoRecibo={tx => setReciboModal(tx)}
              onDesfazerRecibo={actions.handleDesfazerRecibo}
              onAcaoFatura={tx => setFaturaModal(tx)}
              onDesfazerFatura={actions.handleDesfazerFatura}
              onSelectRun={id => { setActiveRunId(id); loadRun(id); }}
            />
          ))
      )}

      {/* Modais */}
      {internoModal   && <InternoModal   tx={internoModal}   onClose={() => setInternoModal(null)}   onSave={actions.handleConfirmarInterno} />}
      {impostoModal   && <ImpostoModal   tx={impostoModal}   onClose={() => setImpostoModal(null)}   onSave={actions.handleConfirmarImposto} />}
      {justModal      && <JustModal      tx={justModal}      onClose={() => setJustModal(null)}      onSave={actions.handleSaveJustificacao} />}
      {faturaModal    && <FaturaModal    tx={faturaModal}    faturasData={faturasData} faturaLinks={faturaLinks} onClose={() => setFaturaModal(null)} onSave={actions.handleSaveAcaoFatura} />}
      {reciboModal    && <ReciboModal    tx={reciboModal}    receipts={receipts}      onClose={() => setReciboModal(null)}    onSave={actions.handleSaveAcaoRecibo} />}
      {ncModal        && <NcModal        tx={ncModal}        clients={clients}        onClose={() => setNcModal(null)}        onSave={actions.handleSaveAcaoCliente} />}
      {ncManualModal  && <NcManualModal  tx={ncManualModal}  faturas={actions.ncManualFaturas} loading={actions.ncManualLoading} onClose={() => setNcManualModal(null)} onSave={actions.handleSaveNcManual} />}
      {addAliasModal  && <AddAliasModal  clients={clients}   onClose={() => setAddAliasModal(false)} onSave={actions.handleSaveNovoAlias} />}
    </div>
  );
}
