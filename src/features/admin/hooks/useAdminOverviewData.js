import { useState, useEffect, useMemo, useCallback } from 'react'
import { useAdminData } from '../context/AdminDataProvider'
import { formatCurrency } from '../../../utils/formatUtils'

export function useAdminOverviewData() {
  const {
    supabase,
    logs,
    workers,
    clients,
    adminStats,
    currentMonth,
    workers: allWorkers
  } = useAdminData()

  const [badgeTotals, setBadgeTotals] = useState({
    cliente: 0, recibo: 0, fatura: 0, imposto: 0, justificado: 0, receitas: 0, despesas: 0
  })
  const [prevBadgeTotals, setPrevBadgeTotals] = useState({
    cliente: 0, recibo: 0, fatura: 0, imposto: 0, justificado: 0, receitas: 0, despesas: 0
  })
  const [ytdTotals, setYtdTotals] = useState({ receitas: 0, despesas: 0 })
  const [badgeDetails, setBadgeDetails] = useState([])

  useEffect(() => {
    if (!supabase) return

    const monthStr = currentMonth.getFullYear() + '-' + String(currentMonth.getMonth() + 1).padStart(2, '0')

    supabase
      .from('reconciliation_runs')
      .select('id, transactions_json')
      .then(async ({ data: runs }) => {
        if (!runs?.length) {
          setBadgeTotals({ cliente: 0, recibo: 0, fatura: 0, imposto: 0, justificado: 0, receitas: 0, despesas: 0 })
          setBadgeDetails([])
          return
        }

        const runIds = runs.map(r => r.id)

        const [pags, rls, fatLinks, ints, imps, justs, allClients] = await Promise.all([
          supabase.from('faturacao_clientes_pagamentos').select('tx_key, valor_pago, client_id').in('run_id', runIds),
          supabase.from('movimentacao_recibo_links').select('tx_key, worker_name').in('run_id', runIds),
          supabase.from('fatura_pagamento_links').select('tx_key, fatura_id').in('run_id', runIds),
          supabase.from('entrada_internos').select('tx_key').in('run_id', runIds),
          supabase.from('entrada_impostos').select('tx_key').in('run_id', runIds),
          supabase.from('entrada_justifications').select('tx_key, justification').in('run_id', runIds),
          supabase.from('clients').select('id, name')
        ])

        const faturaIds = (fatLinks.data || []).map(f => f.fatura_id).filter(Boolean)
        let allFaturas = { data: [] }
        if (faturaIds.length > 0 && faturaIds.length <= 100) {
          try {
            allFaturas = await supabase.from('faturas').select('id, dados').in('id', faturaIds)
          } catch (e) {
            console.warn('Erro ao carregar faturas:', e)
          }
        }

        const mapCliente = {}
        const mapClienteNome = {}
        ;(pags.data || []).forEach(p => {
          mapCliente[p.tx_key] = Number(p.valor_pago) || 0
          mapClienteNome[p.tx_key] = p.client_id
        })

        const mapReciboNome = {}
        ;(rls.data || []).forEach(r => { mapReciboNome[r.tx_key] = r.worker_name })

        const mapFaturaId = {}
        ;(fatLinks.data || []).forEach(f => { mapFaturaId[f.tx_key] = f.fatura_id })

        const mapFaturaDetails = {}
        ;(allFaturas.data || []).forEach(fat => {
          mapFaturaDetails[fat.id] = {
            fornecedor: fat.dados?.fornecedor || fat.dados?.entidade || '—'
          }
        })

        const mapJustificacao = {}
        ;(justs.data || []).forEach(j => { mapJustificacao[j.tx_key] = j.justification })

        const clientNames = {}
        ;(allClients.data || []).forEach(c => { clientNames[c.id] = c.name })

        const setRecibo = new Set((rls.data || []).map(r => r.tx_key))
        const setFatura = new Set((fatLinks.data || []).map(f => f.tx_key))
        const setInterno = new Set((ints.data || []).map(i => i.tx_key))
        const setImposto = new Set((imps.data || []).map(i => i.tx_key))
        const setJustificado = new Set((justs.data || []).map(j => j.tx_key))

        const totals = { cliente: 0, recibo: 0, fatura: 0, imposto: 0, justificado: 0, receitas: 0, despesas: 0 }
        const details = []

        runs.forEach(run => {
          let txs = run.transactions_json
          if (typeof txs === 'string') {
            try { txs = JSON.parse(txs || '[]') } catch { txs = [] }
          }
          if (!Array.isArray(txs)) txs = []

          txs.forEach(tx => {
            if (!tx.data?.startsWith(monthStr)) return

            const key = `${tx.data}|${tx.descricao}|${tx.valor}`
            const valor = Math.abs(Number(tx.valor) || 0)

            if (setInterno.has(key)) return

            let badge = null
            if (mapCliente[key]) {
              badge = 'cliente'
              totals.cliente += valor
            } else if (setRecibo.has(key)) {
              badge = 'recibo'
              totals.recibo += valor
            } else if (setFatura.has(key)) {
              badge = 'fatura'
              totals.fatura += valor
            } else if (setImposto.has(key)) {
              badge = 'imposto'
              totals.imposto += valor
            } else if (setJustificado.has(key)) {
              badge = 'justificado'
              totals.justificado += valor
            }

            if (tx.tipo === 'credito') {
              totals.receitas += valor
            } else {
              totals.despesas += valor
            }

            const detail = {
              date: tx.data,
              descricao: tx.descricao || '',
              valor,
              tipo: tx.tipo,
              badge,
              clienteNome: mapClienteNome[key] ? clientNames[mapClienteNome[key]] || mapClienteNome[key] : null,
              workerName: mapReciboNome[key] || null,
              faturaFornecedor: mapFaturaDetails[mapFaturaId[key]]?.fornecedor || null,
              justificacao: mapJustificacao[key] || null
            }

            if (badge) details.push(detail)
          })
        })

        setBadgeTotals(totals)
        setBadgeDetails(details)

        const yearStr = currentMonth.getFullYear().toString()
        const ytd = { receitas: 0, despesas: 0 }
        runs.forEach(run => {
          let txs = run.transactions_json
          if (typeof txs === 'string') {
            try { txs = JSON.parse(txs || '[]') } catch { txs = [] }
          }
          if (!Array.isArray(txs)) txs = []

          txs.forEach(tx => {
            if (!tx.data?.startsWith(yearStr)) return
            if (setInterno.has(`${tx.data}|${tx.descricao}|${tx.valor}`)) return

            const valor = Math.abs(Number(tx.valor) || 0)
            if (tx.tipo === 'credito') {
              ytd.receitas += valor
            } else {
              ytd.despesas += valor
            }
          })
        })
        setYtdTotals(ytd)
      })
  }, [supabase, currentMonth])

  const areaData = useMemo(() => {
    if (!logs?.length || !adminStats?.totalHours) return []
    const byDay = {}
    logs.forEach(l => {
      if (l.date && l.hours) {
        const day = l.date.split('T')[0]
        byDay[day] = (byDay[day] || 0) + l.hours
      }
    })
    return Object.entries(byDay)
      .map(([date, hours]) => ({
        date: date.slice(5).replace('-', '/'),
        horas: Number(hours.toFixed(1)),
        valor: adminStats.totalHours > 0
          ? Number(((hours / adminStats.totalHours) * (adminStats.expectedRevenue || 0)).toFixed(2))
          : 0
      }))
      .sort((a, b) => a.date.localeCompare(b.date))
  }, [logs, adminStats])

  const pieData = useMemo(() => [
    { name: 'R. Cliente', tipo: 'credito', badgeKey: 'cliente', color: '#22c55e' },
    { name: 'R. Recibo', tipo: 'credito', badgeKey: 'recibo', color: '#16a34a' },
    { name: 'R. Fatura', tipo: 'credito', badgeKey: 'fatura', color: '#15803d' },
    { name: 'R. Justif.', tipo: 'credito', badgeKey: 'justificado', color: '#166534' },
    { name: 'D. Cliente', tipo: 'debito', badgeKey: 'cliente', color: '#ef4444' },
    { name: 'D. Recibo', tipo: 'debito', badgeKey: 'recibo', color: '#dc2626' },
    { name: 'D. Fatura', tipo: 'debito', badgeKey: 'fatura', color: '#b91c1c' },
    { name: 'D. Imposto', tipo: 'debito', badgeKey: 'imposto', color: '#991b1b' },
    { name: 'D. Justif.', tipo: 'debito', badgeKey: 'justificado', color: '#7f1d1d' }
  ].map(item => {
    const items = badgeDetails.filter(t => t.badge === item.badgeKey && t.tipo === item.tipo)
    const value = items.reduce((sum, t) => sum + t.valor, 0)
    return { ...item, value }
  }).filter(p => p.value > 0), [badgeDetails])

  const subCategoriasCredito = [
    { name: 'Com Cliente', badgeKey: 'cliente', color: '#f43f5e' },
    { name: 'Com Recibo', badgeKey: 'recibo', color: '#14b8a6' },
    { name: 'Com Fatura', badgeKey: 'fatura', color: '#a855f7' },
    { name: 'Justificado', badgeKey: 'justificado', color: '#8b5cf6' }
  ]

  const subCategoriasDebito = [
    { name: 'Com Cliente', badgeKey: 'cliente', color: '#f43f5e' },
    { name: 'Com Recibo', badgeKey: 'recibo', color: '#14b8a6' },
    { name: 'Com Fatura', badgeKey: 'fatura', color: '#a855f7' },
    { name: 'Imposto', badgeKey: 'imposto', color: '#ef4444' },
    { name: 'Justificado', badgeKey: 'justificado', color: '#8b5cf6' }
  ]

  const resultado = badgeTotals.receitas - badgeTotals.despesas

  const vsLastMonth = useMemo(() => {
    const pct = (curr, prev) => {
      if (prev === 0) return null
      return Number(((curr - prev) / Math.abs(prev) * 100).toFixed(1))
    }
    return {
      hours: null,
      revenue: null,
      costs: null,
      profit: pct(badgeTotals.receitas - badgeTotals.despesas, prevBadgeTotals.receitas - prevBadgeTotals.despesas)
    }
  }, [badgeTotals, prevBadgeTotals])

  return {
    badgeTotals,
    prevBadgeTotals,
    ytdTotals,
    badgeDetails,
    areaData,
    pieData,
    subCategoriasCredito,
    subCategoriasDebito,
    resultado,
    vsLastMonth,
    formatCurrency
  }
}