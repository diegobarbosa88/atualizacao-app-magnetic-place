import { useState, useEffect } from 'react';

export function useReconciliationBadges(supabase, currentMonth) {
  const [badgeTotals, setBadgeTotals] = useState({
    cliente: 0, recibo: 0, fatura: 0, imposto: 0, justificado: 0, receitas: 0, despesas: 0,
  });
  const [ytdTotals, setYtdTotals] = useState({ receitas: 0, despesas: 0 });
  const [badgeDetails, setBadgeDetails] = useState([]);

  useEffect(() => {
    if (!supabase) return;

    const monthStr = currentMonth.getFullYear() + '-' + String(currentMonth.getMonth() + 1).padStart(2, '0');

    supabase
      .from('reconciliation_runs')
      .select('id, transactions_json')
      .then(async ({ data: runs }) => {
        if (!runs?.length) {
          setBadgeTotals({ cliente: 0, recibo: 0, fatura: 0, imposto: 0, justificado: 0, receitas: 0, despesas: 0 });
          setBadgeDetails([]);
          return;
        }

        const runIds = runs.map(r => r.id);

        const [pags, rls, fatLinks, ints, imps, justs, allClients] = await Promise.all([
          supabase.from('faturacao_clientes_pagamentos').select('tx_key, valor_pago, client_id').in('run_id', runIds),
          supabase.from('movimentacao_recibo_links').select('tx_key, worker_name').in('run_id', runIds),
          supabase.from('fatura_pagamento_links').select('tx_key, fatura_id').in('run_id', runIds),
          supabase.from('entrada_internos').select('tx_key').in('run_id', runIds),
          supabase.from('entrada_impostos').select('tx_key').in('run_id', runIds),
          supabase.from('entrada_justifications').select('tx_key, justification').in('run_id', runIds),
          supabase.from('clients').select('id, name'),
        ]);

        const faturaIds = (fatLinks.data || []).map(f => f.fatura_id).filter(Boolean);
        let allFaturas = { data: [] };
        if (faturaIds.length > 0 && faturaIds.length <= 100) {
          try {
            allFaturas = await supabase.from('faturas').select('id, dados').in('id', faturaIds);
          } catch (e) {
            console.warn('Erro ao carregar faturas:', e);
          }
        }

        const mapCliente = {};
        const mapClienteNome = {};
        (pags.data || []).forEach(p => {
          mapCliente[p.tx_key] = Number(p.valor_pago) || 0;
          mapClienteNome[p.tx_key] = p.client_id;
        });

        const mapReciboNome = {};
        (rls.data || []).forEach(r => { mapReciboNome[r.tx_key] = r.worker_name; });

        const mapFaturaId = {};
        (fatLinks.data || []).forEach(f => { mapFaturaId[f.tx_key] = f.fatura_id; });

        const mapFaturaDetails = {};
        (allFaturas.data || []).forEach(fat => {
          mapFaturaDetails[fat.id] = { fornecedor: fat.dados?.fornecedor || fat.dados?.entidade || '—' };
        });

        const mapJustificacao = {};
        (justs.data || []).forEach(j => { mapJustificacao[j.tx_key] = j.justification; });

        const clientNames = {};
        (allClients.data || []).forEach(c => { clientNames[c.id] = c.name; });

        const setRecibo = new Set((rls.data || []).map(r => r.tx_key));
        const setFatura = new Set((fatLinks.data || []).map(f => f.tx_key));
        const setInterno = new Set((ints.data || []).map(i => i.tx_key));
        const setImposto = new Set((imps.data || []).map(i => i.tx_key));
        const setJustificado = new Set((justs.data || []).map(j => j.tx_key));

        const totals = { cliente: 0, recibo: 0, fatura: 0, imposto: 0, justificado: 0, receitas: 0, despesas: 0 };
        const details = [];

        runs.forEach(run => {
          let txs = run.transactions_json;
          if (typeof txs === 'string') { try { txs = JSON.parse(txs || '[]'); } catch { txs = []; } }
          if (!Array.isArray(txs)) txs = [];

          txs.forEach(tx => {
            if (!tx.data?.startsWith(monthStr)) return;

            const key = `${tx.data}|${tx.descricao}|${tx.valor}`;
            const valor = Math.abs(Number(tx.valor) || 0);

            if (setInterno.has(key)) return;

            let badge = null;
            if (mapCliente[key]) { badge = 'cliente'; totals.cliente += valor; }
            else if (setRecibo.has(key)) { badge = 'recibo'; totals.recibo += valor; }
            else if (setFatura.has(key)) { badge = 'fatura'; totals.fatura += valor; }
            else if (setImposto.has(key)) { badge = 'imposto'; totals.imposto += valor; }
            else if (setJustificado.has(key)) { badge = 'justificado'; totals.justificado += valor; }

            if (tx.tipo === 'credito') { totals.receitas += valor; } else { totals.despesas += valor; }

            if (badge) {
              details.push({
                date: tx.data,
                descricao: tx.descricao || '',
                valor,
                tipo: tx.tipo,
                badge,
                clienteNome: mapClienteNome[key] ? clientNames[mapClienteNome[key]] || mapClienteNome[key] : null,
                workerName: mapReciboNome[key] || null,
                faturaFornecedor: mapFaturaDetails[mapFaturaId[key]]?.fornecedor || null,
                justificacao: mapJustificacao[key] || null,
              });
            }
          });
        });

        setBadgeTotals(totals);
        setBadgeDetails(details);

        const yearStr = currentMonth.getFullYear().toString();
        const ytd = { receitas: 0, despesas: 0 };
        runs.forEach(run => {
          let txs = run.transactions_json;
          if (typeof txs === 'string') { try { txs = JSON.parse(txs || '[]'); } catch { txs = []; } }
          if (!Array.isArray(txs)) txs = [];

          txs.forEach(tx => {
            if (!tx.data?.startsWith(yearStr)) return;
            if (setInterno.has(`${tx.data}|${tx.descricao}|${tx.valor}`)) return;
            const valor = Math.abs(Number(tx.valor) || 0);
            if (tx.tipo === 'credito') { ytd.receitas += valor; } else { ytd.despesas += valor; }
          });
        });
        setYtdTotals(ytd);
      });
  }, [supabase, currentMonth]);

  return { badgeTotals, badgeDetails, ytdTotals };
}
