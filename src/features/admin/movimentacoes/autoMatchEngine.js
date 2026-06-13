import {
  txKey, normName, normWorker, workerScore, findBestReceipt, findSubsetSum,
  extractBankName, previousMonth, matchClientByTokens,
  BANCO_KEYWORDS, INTERNO_KEYWORDS, IMPOSTO_KEYWORDS,
} from './txUtils';

export async function runAutoMatchFaturas(debitos, fatsArr, rid, curFatLinks, setFatLinks, sb) {
  if (!debitos.length || !fatsArr.length) return { count: 0, insertedKeys: new Set() };
  const existingKeys = new Set(curFatLinks.map(f => f.tx_key));
  const usedFatIds = new Set(curFatLinks.map(f => f.fatura_id));
  const toInsert = [];

  for (const tx of debitos) {
    const key = txKey(tx);
    if (existingKeys.has(key)) continue;
    const valorTx = Math.abs(parseFloat(tx.valor) || 0);

    let bestFatura = null;
    let bestScore = 0;

    for (const f of fatsArr) {
      if (usedFatIds.has(f.id)) continue;
      const valorFat = parseFloat(f.dados?.valor_total) || 0;
      if (Math.abs(valorTx - valorFat) > 0.01) continue;
      const tokens = normName(f.dados?.fornecedor || '').split(' ').filter(w => w.length >= 3);
      if (tokens.length === 0) continue;
      const descNorm = normName(tx.descricao || '');
      const hits = tokens.filter(t => descNorm.includes(t)).length;
      if (hits >= 1 && hits > bestScore) {
        bestScore = hits;
        bestFatura = f;
      }
    }

    if (!bestFatura) continue;
    existingKeys.add(key);
    usedFatIds.add(bestFatura.id);
    toInsert.push({ fatura_id: bestFatura.id, run_id: rid, tx_key: key, auto_matched: true });
  }

  if (toInsert.length === 0) return { count: 0, insertedKeys: new Set() };
  const { data } = await sb.from('fatura_pagamento_links')
    .upsert(toInsert, { onConflict: 'run_id,tx_key' })
    .select('fatura_id, run_id, tx_key, auto_matched');
  if (data) setFatLinks(prev => [...prev, ...data.filter(d => !prev.some(p => p.tx_key === d.tx_key))]);
  return { count: data?.length || 0, insertedKeys: new Set(toInsert.map(r => r.tx_key)) };
}

export async function runAutoMatchFaturasSplit(debitos, fatsArr, rid, curFatLinks, setFatLinks, sb) {
  if (!debitos.length || !fatsArr.length) return { count: 0, insertedKeys: new Set() };
  const usedFatIds = new Set(curFatLinks.map(f => f.fatura_id));
  const usedTxKeys = new Set(curFatLinks.map(f => f.tx_key));

  const unmatchedDebitos = debitos.filter(tx => !usedTxKeys.has(txKey(tx)));
  const unmatchedFaturas = fatsArr.filter(f => !usedFatIds.has(f.id));

  if (unmatchedDebitos.length === 0 || unmatchedFaturas.length === 0) {
    return { count: 0, insertedKeys: new Set() };
  }

  const debitosPorFornecedor = {};
  for (const tx of unmatchedDebitos) {
    const descNorm = normName(tx.descricao || '');
    const valor = Math.abs(parseFloat(tx.valor) || 0);
    if (!debitosPorFornecedor[descNorm]) debitosPorFornecedor[descNorm] = [];
    debitosPorFornecedor[descNorm].push({ ...tx, _valor: valor });
  }

  const toInsert = [];
  const insertedFatIds = new Set();
  const insertedTxKeys = new Set();

  for (const fatura of unmatchedFaturas) {
    if (insertedFatIds.has(fatura.id)) continue;
    const tokens = normName(fatura.dados?.fornecedor || '').split(' ').filter(w => w.length >= 3);
    if (tokens.length === 0) continue;

    const matchingDebitos = [];
    for (const [descNorm, txs] of Object.entries(debitosPorFornecedor)) {
      const hits = tokens.filter(t => descNorm.includes(t)).length;
      if (hits >= 1) {
        for (const tx of txs) {
          if (!insertedTxKeys.has(txKey(tx))) {
            matchingDebitos.push(tx);
          }
        }
      }
    }

    if (matchingDebitos.length < 2) continue;

    const valorFat = parseFloat(fatura.dados?.valor_total) || 0;
    if (valorFat <= 0) continue;

    const subset = findSubsetSum(matchingDebitos, valorFat);
    if (subset.length > 0) {
      for (const tx of subset) {
        toInsert.push({ fatura_id: fatura.id, run_id: rid, tx_key: txKey(tx), auto_matched: true });
        insertedTxKeys.add(txKey(tx));
      }
      insertedFatIds.add(fatura.id);
    }
  }

  if (toInsert.length === 0) return { count: 0, insertedKeys: new Set() };
  const { data } = await sb.from('fatura_pagamento_links')
    .upsert(toInsert, { onConflict: 'run_id,tx_key' })
    .select('fatura_id, run_id, tx_key, auto_matched');
  if (data) setFatLinks(prev => [...prev, ...data.filter(d => !prev.some(p => p.tx_key === d.tx_key))]);
  return { count: data?.length || 0, insertedKeys: new Set(toInsert.map(r => r.tx_key)) };
}

export async function runAutoMatchRecibos(debitos, rid, salAlsArr, recsArr, curRls, setRls, sb) {
  if (!debitos.length || !recsArr.length) return 0;
  const existingKeys = new Set(curRls.map(r => r.tx_key));
  const toInsert = [];

  const descUpper = (s) => (s || '').toUpperCase();
  const isBancoTx = (tx) => BANCO_KEYWORDS.some(k => descUpper(tx.descricao || '').includes(k));
  const isInternoTx = (tx) => INTERNO_KEYWORDS.some(k => descUpper(tx.descricao || '').includes(k));
  const isImpostoTx = (tx) => IMPOSTO_KEYWORDS.some(k => descUpper(tx.descricao || '').includes(k));

  for (const tx of debitos) {
    const key = txKey(tx);
    if (existingKeys.has(key)) continue;
    if (isBancoTx(tx)) continue;
    if (isInternoTx(tx)) continue;
    if (isImpostoTx(tx)) continue;

    let matchedWorkerName = null;

    for (const alias of salAlsArr) {
      if (!alias.pattern) continue;
      const patternNorm = normWorker(alias.pattern);
      const descNorm = normWorker(tx.descricao);
      if (descNorm.includes(patternNorm)) {
        matchedWorkerName = alias.worker_name;
        break;
      }
    }

    if (!matchedWorkerName) {
      const descClean = normWorker(tx.descricao)
        .replace(/\bp\/\s*/gi, '')
        .replace(/\bapp\s*\d*/gi, '')
        .replace(/\bapp\b/gi, '')
        .replace(/\d+/g, '')
        .replace(/[-&]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      const uniqueWorkers = [...new Map(recsArr.map(r => [normWorker(r.worker_name), r])).values()];
      let bestScore = 0;
      for (const receipt of uniqueWorkers) {
        const score = workerScore(descClean, receipt.worker_name);
        if (score >= 1 && score > bestScore) {
          bestScore = score;
          matchedWorkerName = receipt.worker_name;
        }
      }
    }

    if (!matchedWorkerName) continue;

    const bestReceipt = findBestReceipt(matchedWorkerName, tx.data, recsArr);
    if (!bestReceipt) continue;

    const txDay = parseInt(tx.data.split('-')[2]);
    const txYear = parseInt(tx.data.substring(0, 4));
    const txMonth = parseInt(tx.data.substring(5, 7));
    let linkMes;
    if (txDay >= 16) {
      linkMes = tx.data.substring(0, 7);
    } else {
      const prevMonth = txMonth === 1 ? 12 : txMonth - 1;
      const prevYear = txMonth === 1 ? txYear - 1 : txYear;
      linkMes = `${prevYear}-${String(prevMonth).padStart(2, '0')}`;
    }

    toInsert.push({
      run_id: rid,
      tx_key: key,
      worker_id: bestReceipt.worker_id || null,
      worker_name: bestReceipt.worker_name,
      mes: linkMes,
      auto_matched: true,
    });
    existingKeys.add(key);
  }

  if (toInsert.length === 0) return 0;
  const { data } = await sb.from('movimentacao_recibo_links').upsert(toInsert, { onConflict: 'run_id,tx_key' }).select('tx_key, worker_id, worker_name, mes, auto_matched');
  if (data) setRls(prev => [...prev, ...data.filter(d => !prev.some(p => p.tx_key === d.tx_key))]);
  return data?.length || 0;
}

export async function runVirtualLinkStep(sb, rid, txs, fatsArr, ncsArr, curFatLinks, setFatLinks) {
  let count = 0;

  const creditWithClient = txs.filter(tx =>
    tx.tipo === 'credito' &&
    ncsArr.some(n => n.tx_key === txKey(tx))
  );

  for (const tx of creditWithClient) {
    const key = txKey(tx);
    const clientNc = ncsArr.find(n => n.tx_key === key);
    if (!clientNc) continue;

    const valorTx = Math.abs(parseFloat(tx.valor) || 0);

    const clienteFatura = fatsArr.find(f =>
      f.tipo === 'cliente' &&
      f.status === 'PENDENTE' &&
      Number(f.dados?.valor_total) > valorTx + 0.01
    );

    if (!clienteFatura) continue;

    const valorFaturaCliente = Math.abs(parseFloat(clienteFatura.dados?.valor_total) || 0);
    const diferenca = valorFaturaCliente - valorTx;

    if (diferenca > 0.01 && diferenca <= 500.00) {
      const comissaoFatura = fatsArr.find(f =>
        (!f.tipo || f.tipo === 'fornecedor') &&
        f.status === 'PENDENTE' &&
        Math.abs(parseFloat(f.dados?.valor_total || 0) - diferenca) <= 0.01
      );

      if (comissaoFatura) {
        const jaLinkado = curFatLinks.some(fl => fl.fatura_id === clienteFatura.id && fl.tx_key === key);
        if (!jaLinkado) {
          await sb.from('fatura_pagamento_links').upsert({
            fatura_id: clienteFatura.id,
            run_id: rid,
            tx_key: key,
            auto_matched: true,
          }, { onConflict: 'fatura_id,tx_key' });
        }

        await sb.from('faturas').update({ status: 'PAGO' }).eq('id', clienteFatura.id);
        await sb.from('faturas').update({ status: 'PAGO' }).eq('id', comissaoFatura.id);
        count++;

        setFatLinks(prev => [...prev, { fatura_id: clienteFatura.id, run_id: rid, tx_key: key, auto_matched: true }]);
      }
    }
  }

  return count;
}

export async function runAutoMatch(unresolved, rid, alsArr, clientList, curInternos, curImpostos, curNcs, setInts, setImpostos, setNcs, setFatLinks, setPags, sb, extraExcludeKeys = new Set(), fatsArr = []) {
  const toInsertInternos = [];
  const toInsertImpostos = [];
  const toInsertNcs = [];
  const toInsertClientes = [];
  const toInsertFaturas = [];
  const existingIntKeys = new Set(curInternos.map(i => i.tx_key));
  const existingImpKeys = new Set(curImpostos.map(i => i.tx_key));
  const existingNcKeys = new Set(curNcs.map(n => n.tx_key));
  const existingPagKeys = new Set();

  for (const tx of unresolved) {
    const key = txKey(tx);
    if (existingIntKeys.has(key) || existingImpKeys.has(key) || existingNcKeys.has(key) || extraExcludeKeys.has(key)) continue;

    const bankName = extractBankName(tx.descricao);
    const bankNorm = normName(bankName);
    const descUpper = String(tx.descricao || '').toUpperCase();

    const alias = alsArr.find(a => {
      const aNorm = normName(a.bank_name);
      return bankNorm.includes(aNorm) || aNorm.includes(bankNorm);
    });
    if (alias) {
      if (alias.resolucao === 'interno') {
        toInsertInternos.push({ run_id: rid, tx_key: key });
        existingIntKeys.add(key);
        continue;
      }
      if (alias.resolucao === 'imposto') {
        toInsertImpostos.push({ run_id: rid, tx_key: key });
        existingImpKeys.add(key);
        continue;
      }
      if (alias.resolucao === 'com_cliente' && alias.client_id && tx.tipo === 'credito') {
        const val = parseFloat(tx.valor) || 0;
        toInsertClientes.push({ run_id: rid, tx_key: key, client_id: alias.client_id, period: previousMonth(tx.data), valor_faturado: val, valor_pago: val });
        existingPagKeys.add(key);
        continue;
      }
      if (alias.resolucao === 'nota_credito' && alias.client_id && tx.tipo === 'credito') {
        toInsertNcs.push({ run_id: rid, tx_key: key, client_id: alias.client_id, period: previousMonth(tx.data) });
        existingNcKeys.add(key);
        continue;
      }
    }

    if (!alias && tx.tipo === 'credito') {
      const matched = matchClientByTokens(tx.descricao, clientList);
      if (matched?.id) {
        const val = parseFloat(tx.valor) || 0;
        toInsertClientes.push({ run_id: rid, tx_key: key, client_id: matched.id, period: previousMonth(tx.data), valor_faturado: val, valor_pago: val });
        existingPagKeys.add(key);
        continue;
      }
    }

    if (INTERNO_KEYWORDS.some(k => descUpper.includes(k))) {
      toInsertInternos.push({ run_id: rid, tx_key: key });
      existingIntKeys.add(key);
      continue;
    }

    if (IMPOSTO_KEYWORDS.some(k => descUpper.includes(k))) {
      toInsertImpostos.push({ run_id: rid, tx_key: key });
      existingImpKeys.add(key);
      continue;
    }

    if (tx.tipo === 'debito' && BANCO_KEYWORDS.some(k => descUpper.includes(k))) {
      const faturaBanco = fatsArr.find(f =>
        f.dados?.fornecedor === 'Novo Banco, S.A.' &&
        String(f.dados?.numero_fatura) === '4314117912'
      );
      if (faturaBanco) {
        toInsertFaturas.push({ fatura_id: faturaBanco.id, run_id: rid, tx_key: key, auto_matched: true });
        existingIntKeys.add(key);
        continue;
      }
      toInsertInternos.push({ run_id: rid, tx_key: key });
      existingIntKeys.add(key);
      continue;
    }

    if (tx.tipo === 'credito' && !existingNcKeys.has(key)) {
      const valorTx = Math.abs(parseFloat(tx.valor) || 0);
      const descNorm = normName(tx.descricao || '');
      for (const f of fatsArr) {
        if (!f.dados?.numero_fatura?.startsWith('NC')) continue;
        const valorFat = Math.abs(parseFloat(f.dados?.valor_total) || 0);
        if (Math.abs(valorTx - valorFat) > 0.01) continue;
        const tokens = normName(f.dados?.fornecedor || '').split(' ').filter(w => w.length >= 3);
        if (tokens.length === 0) continue;
        const hits = tokens.filter(t => descNorm.includes(t)).length;
        if (hits >= 1) {
          toInsertNcs.push({ run_id: rid, tx_key: key, client_id: f.id, period: tx.data.substring(0, 7) });
          existingNcKeys.add(key);
          break;
        }
      }
    }

    if (tx.tipo === 'credito' && !toInsertFaturas.some(f => f.tx_key === key)) {
      const valorTx = Math.abs(parseFloat(tx.valor) || 0);
      const clienteFatura = fatsArr.find(f =>
        f.tipo === 'cliente' &&
        f.status === 'PENDENTE' &&
        Number(f.dados?.valor_total) > valorTx + 0.01
      );
      if (clienteFatura) {
        const valorFaturaCliente = Math.abs(parseFloat(clienteFatura.dados?.valor_total) || 0);
        const diferenca = valorFaturaCliente - valorTx;
        if (diferenca > 0.01 && diferenca <= 500.00) {
          const fornecedorFatura = fatsArr.find(f =>
            (!f.tipo || f.tipo === 'fornecedor') &&
            f.status === 'PENDENTE' &&
            Math.abs(parseFloat(f.dados?.valor_total || 0) - diferenca) <= 0.01
          );
          if (fornecedorFatura) {
            toInsertFaturas.push({ fatura_id: clienteFatura.id, run_id: rid, tx_key: key, auto_matched: true });
            sb.from('faturas').update({ status: 'PAGO' }).eq('id', clienteFatura.id).then(() => {});
            sb.from('faturas').update({ status: 'PAGO' }).eq('id', fornecedorFatura.id).then(() => {});
          }
        }
      }
    }
  }

  let count = 0;
  if (toInsertInternos.length > 0) {
    const { data } = await sb.from('entrada_internos').upsert(toInsertInternos, { onConflict: 'run_id,tx_key' }).select('tx_key');
    if (data) {
      const tagged = data.map(d => ({ ...d, auto_matched: true }));
      setInts(prev => [...prev, ...tagged.filter(d => !prev.some(p => p.tx_key === d.tx_key))]);
      count += data.length;
    }
  }
  if (toInsertImpostos.length > 0) {
    const { data } = await sb.from('entrada_impostos').upsert(toInsertImpostos, { onConflict: 'run_id,tx_key' }).select('tx_key');
    if (data) {
      const tagged = data.map(d => ({ ...d, auto_matched: true }));
      setImpostos(prev => [...prev, ...tagged.filter(d => !prev.some(p => p.tx_key === d.tx_key))]);
      count += data.length;
    }
  }
  if (toInsertNcs.length > 0) {
    const { data } = await sb.from('entrada_nota_credito_links').upsert(toInsertNcs, { onConflict: 'run_id,tx_key' }).select('tx_key, client_id, period, notas');
    if (data) {
      for (const nc of data) {
        await sb.from('faturas').update({ status: 'PAGO' }).eq('id', nc.client_id);
      }
      const tagged = data.map(d => ({ ...d, auto_matched: true }));
      setNcs(prev => [...prev, ...data.filter(d => !prev.some(p => p.tx_key === d.tx_key))]);
      count += data.length;
    }
  }
  if (toInsertClientes.length > 0) {
    const { data } = await sb.from('faturacao_clientes_pagamentos').upsert(toInsertClientes, { onConflict: 'run_id,tx_key' }).select('tx_key, client_id, period');
    if (data) {
      setPags(prev => [...prev, ...data.filter(d => !prev.some(p => p.tx_key === d.tx_key))]);
      count += data.length;
    }
  }
  if (toInsertFaturas.length > 0) {
    const { data } = await sb.from('fatura_pagamento_links').upsert(toInsertFaturas, { onConflict: 'run_id,tx_key' }).select('fatura_id, run_id, tx_key, auto_matched');
    if (data) {
      setFatLinks(prev => [...prev, ...data.filter(d => !prev.some(p => p.tx_key === d.tx_key))]);
      count += data.length;
    }
  }
  return count;
}
