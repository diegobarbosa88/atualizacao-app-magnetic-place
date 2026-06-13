import { useState } from 'react';
import { txKey, previousMonth } from './txUtils';

export function useMovActions({
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
}) {
  const [ncManualLoading, setNcManualLoading] = useState(false);
  const [ncManualFaturas, setNcManualFaturas] = useState([]);

  const handleConfirmarInterno = async (tx, { saveAlias, aliasName }) => {
    const effectiveRunId = tx.run_id || runId;
    if (!effectiveRunId) return;
    const key = txKey(tx);
    await supabase.from('entrada_internos').upsert({ run_id: effectiveRunId, tx_key: key }, { onConflict: 'run_id,tx_key' });
    setInternos(prev => [...prev.filter(i => i.tx_key !== key), { tx_key: key }]);
    if (saveAlias && aliasName.trim()) {
      const { data: newAlias } = await supabase
        .from('movimentacoes_aliases')
        .upsert({ bank_name: aliasName.trim(), resolucao: 'interno', client_id: null }, { onConflict: 'bank_name' })
        .select('id, bank_name, resolucao, client_id').single();
      if (newAlias) setAliases(prev => [newAlias, ...prev.filter(a => a.bank_name !== aliasName.trim())]);
    }
  };

  const handleDesfazerInterno = async (tx) => {
    const effectiveRunId = tx.run_id || runId;
    if (!effectiveRunId) return;
    const key = txKey(tx);
    await supabase.from('entrada_internos').delete().eq('run_id', effectiveRunId).eq('tx_key', key);
    setInternos(prev => prev.filter(i => i.tx_key !== key));
  };

  const handleConfirmarImposto = async (tx, { saveAlias, aliasName }) => {
    const effectiveRunId = tx.run_id || runId;
    if (!effectiveRunId) return;
    const key = txKey(tx);
    await supabase.from('entrada_impostos').upsert({ run_id: effectiveRunId, tx_key: key }, { onConflict: 'run_id,tx_key' });
    setImpostos(prev => [...prev.filter(i => i.tx_key !== key), { tx_key: key }]);
    if (saveAlias && aliasName.trim()) {
      const { data: newAlias } = await supabase
        .from('movimentacoes_aliases')
        .upsert({ bank_name: aliasName.trim(), resolucao: 'imposto', client_id: null }, { onConflict: 'bank_name' })
        .select('id, bank_name, resolucao, client_id').single();
      if (newAlias) setAliases(prev => [newAlias, ...prev.filter(a => a.bank_name !== aliasName.trim())]);
    }
  };

  const handleDesfazerImposto = async (tx) => {
    const effectiveRunId = tx.run_id || runId;
    if (!effectiveRunId) return;
    const key = txKey(tx);
    await supabase.from('entrada_impostos').delete().eq('run_id', effectiveRunId).eq('tx_key', key);
    setImpostos(prev => prev.filter(i => i.tx_key !== key));
  };

  const handleSaveAcaoCliente = async (tx, { clientId, period, notas, saveAlias, aliasName }) => {
    const effectiveRunId = tx.run_id || runId;
    if (!effectiveRunId) return;
    const key = txKey(tx);
    const existing = pagamentos.find(p => p.tx_key === key);
    if (existing) {
      await supabase.from('faturacao_clientes_pagamentos').update({ client_id: clientId, period }).eq('id', existing.id);
    } else {
      await supabase.from('faturacao_clientes_pagamentos').insert({ run_id: effectiveRunId, tx_key: key, client_id: clientId, period });
    }
    const { data: refreshed } = await supabase
      .from('faturacao_clientes_pagamentos').select('tx_key, client_id, period, run_id').eq('run_id', effectiveRunId);
    setPagamentos(refreshed || []);
    if (saveAlias && aliasName.trim()) {
      const { data: newAlias } = await supabase
        .from('movimentacoes_aliases')
        .upsert({ bank_name: aliasName.trim(), resolucao: 'com_cliente', client_id: clientId }, { onConflict: 'bank_name' })
        .select('id, bank_name, resolucao, client_id').single();
      if (newAlias) setAliases(prev => [newAlias, ...prev.filter(a => a.bank_name !== aliasName.trim())]);
    }
  };

  const handleDesfazerCliente = async (tx) => {
    const key = txKey(tx);
    const existingPag = pagamentos.find(p => p.tx_key === key);
    if (existingPag) {
      await supabase.from('faturacao_clientes_pagamentos').delete().eq('id', existingPag.id);
      setPagamentos(prev => prev.filter(p => p.id !== existingPag.id));
      return;
    }
    const existingNc = notasCredito.find(n => n.tx_key === key);
    if (existingNc) {
      await supabase.from('entrada_nota_credito_links').delete().eq('id', existingNc.id);
      setNotasCredito(prev => prev.filter(n => n.id !== existingNc.id));
    }
  };

  const handleOpenNcManual = async (tx) => {
    setNcManualLoading(true);
    setNcManualModal(tx);
    const { data } = await supabase.from('faturas').select('id, dados').order('importado_em', { ascending: false });
    const ncFaturas = (data || []).filter(f => f.dados?.numero_fatura?.startsWith('NC'));
    setNcManualFaturas(ncFaturas);
    setNcManualLoading(false);
  };

  const handleSaveNcManual = async (tx, faturaId) => {
    const effectiveRunId = tx.run_id || runId;
    if (!effectiveRunId) return;
    const key = txKey(tx);
    const existing = notasCredito.find(n => n.tx_key === key);
    if (existing) {
      await supabase.from('entrada_nota_credito_links').update({ client_id: faturaId }).eq('id', existing.id);
    } else {
      const { error: ncError } = await supabase.from('entrada_nota_credito_links').upsert({
        run_id: effectiveRunId, tx_key: key, client_id: faturaId, period: previousMonth(tx.data),
      }, { onConflict: 'run_id,tx_key' });
      if (ncError && ncError.code !== '23505') console.error('[handleSaveNcManual] nc insert failed:', ncError);
    }
    const { error: faturaError } = await supabase.from('faturas').update({ status: 'PAGO' }).eq('id', faturaId);
    if (faturaError) {
      console.error('[handleSaveNcManual] fatura update failed:', faturaError);
    } else {
      setFaturasData(prev => prev.map(f => f.id === faturaId ? { ...f, status: 'PAGO' } : f));
    }
    const { data: refreshed } = await supabase
      .from('entrada_nota_credito_links').select('id, tx_key, client_id, period').eq('run_id', effectiveRunId);
    setNotasCredito(refreshed || []);
  };

  const handleSaveJustificacao = async (tx, justText) => {
    const effectiveRunId = tx.run_id || runId;
    if (!effectiveRunId) return;
    const key = txKey(tx);
    const { data, error } = await supabase
      .from('entrada_justifications')
      .upsert({ run_id: effectiveRunId, tx_key: key, justification: justText.trim() }, { onConflict: 'run_id,tx_key' })
      .select('tx_key, justification').single();
    if (!error && data) setJustificacoes(prev => [...prev.filter(j => j.tx_key !== data.tx_key), data]);
  };

  const handleRemoverJustificacao = async (tx) => {
    const effectiveRunId = tx.run_id || runId;
    if (!effectiveRunId) return;
    const key = txKey(tx);
    await supabase.from('entrada_justifications').delete().eq('run_id', effectiveRunId).eq('tx_key', key);
    setJustificacoes(prev => prev.filter(j => j.tx_key !== key));
  };

  const handleApagarAlias = async (id) => {
    await supabase.from('movimentacoes_aliases').delete().eq('id', id);
    setAliases(prev => prev.filter(a => a.id !== id));
  };

  const handleSaveAcaoRecibo = async (tx, { workerName, workerId, mes }) => {
    const effectiveRunId = tx.run_id || runId;
    if (!effectiveRunId) return;
    const key = txKey(tx);
    const tipo = (() => {
      const txDay = parseInt(tx.data.split('-')[2]);
      return (txDay >= 1 && txDay <= 6) || txDay >= 16 ? 'Adiantamento' : 'Liquidação';
    })();
    const { data, error } = await supabase
      .from('movimentacao_recibo_links')
      .upsert({ run_id: effectiveRunId, tx_key: key, worker_id: workerId || null, worker_name: workerName, mes, tipo, auto_matched: false }, { onConflict: 'run_id,tx_key' })
      .select('tx_key, worker_id, worker_name, mes, tipo, auto_matched').single();
    if (!error && data) setReciboLinks(prev => [...prev.filter(r => r.tx_key !== data.tx_key), data]);
  };

  const handleDesfazerRecibo = async (tx) => {
    const effectiveRunId = tx.run_id || runId;
    if (!effectiveRunId) return;
    const key = txKey(tx);
    await supabase.from('movimentacao_recibo_links').delete().eq('run_id', effectiveRunId).eq('tx_key', key);
    setReciboLinks(prev => prev.filter(r => r.tx_key !== key));
  };

  const handleSaveAcaoFatura = async (tx, faturaSelId) => {
    const effectiveRunId = tx.run_id || runId;
    if (!effectiveRunId) return;
    const key = txKey(tx);
    await supabase.from('fatura_pagamento_links').delete().eq('tx_key', key);
    const { data, error } = await supabase
      .from('fatura_pagamento_links')
      .insert({ fatura_id: faturaSelId, run_id: effectiveRunId, tx_key: key, auto_matched: false })
      .select('fatura_id, run_id, tx_key, auto_matched').single();
    if (!error && data) setFaturaLinks(prev => [...prev.filter(f => f.tx_key !== data.tx_key && f.fatura_id !== data.fatura_id), data]);
  };

  const handleDesfazerFatura = async (tx) => {
    const effectiveRunId = tx.run_id || runId;
    if (!effectiveRunId) return;
    const key = txKey(tx);
    const link = faturaLinks.find(f => f.tx_key === key);
    if (link?.fatura_id) await supabase.from('faturas').update({ status: 'PENDENTE' }).eq('id', link.fatura_id);
    await supabase.from('fatura_pagamento_links').delete().eq('run_id', effectiveRunId).eq('tx_key', key);
    setFaturaLinks(prev => prev.filter(f => f.tx_key !== key));
  };

  const handleSaveNovoAlias = async ({ aliasName, resolucao, clientId }) => {
    const { data: newAlias } = await supabase
      .from('movimentacoes_aliases')
      .upsert({ bank_name: aliasName.trim(), resolucao, client_id: resolucao === 'nota_credito' ? clientId : null }, { onConflict: 'bank_name' })
      .select('id, bank_name, resolucao, client_id').single();
    if (newAlias) setAliases(prev => [newAlias, ...prev.filter(a => a.bank_name !== aliasName.trim())]);
  };

  return {
    ncManualLoading,
    ncManualFaturas,
    handleConfirmarInterno, handleDesfazerInterno,
    handleConfirmarImposto, handleDesfazerImposto,
    handleSaveAcaoCliente, handleDesfazerCliente,
    handleOpenNcManual, handleSaveNcManual,
    handleSaveJustificacao, handleRemoverJustificacao,
    handleApagarAlias,
    handleSaveAcaoRecibo, handleDesfazerRecibo,
    handleSaveAcaoFatura, handleDesfazerFatura,
    handleSaveNovoAlias,
  };
}
