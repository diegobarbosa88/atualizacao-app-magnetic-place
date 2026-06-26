import { useState, useEffect, useCallback } from 'react';
import { formatarMes } from '../../../../utils/validacaoHelpers';
import { mesSeguinte, agruparPorCliente, histKey, getHistInvoiceKeys } from './ajudasUtils';
import { fetchVendasMes } from './tocFetch';

export function useAjudasData({ ano, selectedMonth, semHoras }) {
  const [carregando, setCarregando] = useState(false);
  const [recibosAno, setRecibosAno] = useState([]);
  const [faturadosAno, setFaturadosAno] = useState([]);
  const [recibosRef, setRecibosRef] = useState([]);
  const [confirmando, setConfirmando] = useState(false);
  const [confirmado, setConfirmado] = useState(false);
  const [gravandoHist, setGravandoHist] = useState(null);
  const [apagandoHist, setApagandoHist] = useState(null);
  const [faturasHist, setFaturasHist] = useState({});
  const [carregandoFaturasHist, setCarregandoFaturasHist] = useState(null);
  const [faturasToC, setFaturasToC] = useState([]);
  const [carregandoToC, setCarregandoToC] = useState(false);
  const [tocSemAuth, setTocSemAuth] = useState(false);
  const [expandidoHistMes, setExpandidoHistMes] = useState(null);

  const carregar = useCallback(async (silencioso = false) => {
    const db = window.supabaseInstance;
    if (!db) return;
    if (!silencioso) setCarregando(true);
    const [{ data: rv }, { data: af }] = await Promise.all([
      db.from('receipt_validations').select('mes, ajudas_custo_extraidas').like('mes', `${ano}-%`),
      db.from('ajudas_faturadas_clientes').select('*').like('mes', `${ano}-%`),
    ]);
    setRecibosAno(rv ?? []);
    setFaturadosAno(af ?? []);
    if (!silencioso) setCarregando(false);
    setConfirmado((af ?? []).some(r => r.mes === selectedMonth && r.confirmado));
  }, [ano, selectedMonth]);

  // Polling para supabaseInstance
  useEffect(() => {
    if (window.supabaseInstance) { carregar(); return; }
    let tries = 0;
    const id = setInterval(() => {
      tries++;
      if (window.supabaseInstance) { clearInterval(id); carregar(); }
      else if (tries >= 20) clearInterval(id);
    }, 250);
    return () => clearInterval(id);
  }, [carregar]);

  // Reset confirmado ao mudar mês
  useEffect(() => { setConfirmado(false); }, [selectedMonth]);

  // Carrega meses anteriores para estimar quando o mês atual não tem recibos
  useEffect(() => {
    const db = window.supabaseInstance;
    if (!db) return;
    const temDados = recibosAno.some(r => r.mes === selectedMonth && parseFloat(r.ajudas_custo_extraidas) > 0);
    if (temDados) { setRecibosRef([]); return; }
    const [y, m] = selectedMonth.split('-').map(Number);
    const limite = new Date(y, m - 7, 1);
    const limiteStr = `${limite.getFullYear()}-${String(limite.getMonth() + 1).padStart(2, '0')}`;
    db.from('receipt_validations')
      .select('mes, ajudas_custo_extraidas')
      .lte('mes', selectedMonth)
      .gte('mes', limiteStr)
      .gt('ajudas_custo_extraidas', 0)
      .order('mes', { ascending: false })
      .then(({ data }) => setRecibosRef(data || []));
  }, [selectedMonth, recibosAno]);

  // Busca faturas TOConline do mês seguinte quando não há horas registadas
  useEffect(() => {
    setFaturasToC([]);
    if (!semHoras) return;
    let cancelled = false;
    (async () => {
      setCarregandoToC(true);
      setTocSemAuth(false);
      const result = await fetchVendasMes(mesSeguinte(selectedMonth));
      if (cancelled) return;
      if (result.status === 401) { setTocSemAuth(true); setCarregandoToC(false); return; }
      if (!result.ok) { setCarregandoToC(false); return; }
      if (!Array.isArray(result.data)) { setCarregandoToC(false); return; }
      setFaturasToC(result.data);
      setCarregandoToC(false);
    })();
    return () => { cancelled = true; };
  }, [selectedMonth, semHoras]);

  const handleConfirmar = useCallback(async (linhas) => {
    const db = window.supabaseInstance;
    console.log('[handleConfirmar] inicio — linhas:', linhas.length, 'db:', !!db);
    if (!db || !linhas.length) return;
    setConfirmando(true);
    const porCliente = agruparPorCliente(linhas);
    const rows = Object.entries(porCliente).map(([clientId, v]) => ({
      mes: selectedMonth,
      client_id: clientId,
      valor_ajudas: Math.round(v.valor * 100) / 100,
      total_fatura: Math.round(v.fatura * 100) / 100,
      confirmado: true,
    }));
    console.log('[handleConfirmar] rows a inserir:', JSON.stringify(rows));
    const { error: erroDel, data: dataDel } = await db.from('ajudas_faturadas_clientes').delete().eq('mes', selectedMonth).select();
    console.log('[handleConfirmar] DELETE result — error:', erroDel, 'data:', dataDel);
    const { error: erroIns, data: dataIns } = await db.from('ajudas_faturadas_clientes').insert(rows).select();
    console.log('[handleConfirmar] INSERT result — error:', erroIns, 'data:', dataIns);
    await carregar(true);
    setConfirmando(false);
    if (!erroIns) setConfirmado(true);
  }, [selectedMonth, carregar]);

  // Grava edições do histórico na BD. Retorna as linhas guardadas para o
  // chamador poder limpar os overrides correspondentes no estado de UI.
  const guardarHistDb = useCallback(async (mes, histOverrides) => {
    const db = window.supabaseInstance;
    if (!db) return [];
    setGravandoHist(mes);
    const linhasMes = faturadosAno.filter(r => r.mes === mes);
    const rowsHist = linhasMes.map(r => {
      const invoiceKeys = getHistInvoiceKeys(histOverrides, mes, r.client_id);
      const val = invoiceKeys.length > 0
        ? invoiceKeys.reduce((s, k) => s + (parseFloat(String(histOverrides[k]).replace(',', '.')) || 0), 0)
        : histOverrides[histKey(mes, r.client_id)] !== undefined
          ? parseFloat(String(histOverrides[histKey(mes, r.client_id)]).replace(',', '.')) || 0
          : parseFloat(r.valor_ajudas) || 0;
      return { mes, client_id: r.client_id, valor_ajudas: Math.round(val * 100) / 100, total_fatura: parseFloat(r.total_fatura) || 0, confirmado: true };
    });
    const { error: erroDelHist } = await db.from('ajudas_faturadas_clientes').delete().eq('mes', mes);
    if (erroDelHist) console.error('guardarHistDb DELETE error:', erroDelHist.message);
    const { error: erroInsHist } = await db.from('ajudas_faturadas_clientes').insert(rowsHist);
    if (erroInsHist) console.error('guardarHistDb INSERT error:', erroInsHist.message);
    await carregar(true);
    setGravandoHist(null);
    return linhasMes;
  }, [faturadosAno, carregar]);

  const handleApagarHist = useCallback(async (mes) => {
    const db = window.supabaseInstance;
    if (!db) return;
    if (!confirm(`Apagar as ajudas faturadas de ${formatarMes(mes)}? Esta ação não pode ser desfeita.`)) return;
    setApagandoHist(mes);
    await db.from('ajudas_faturadas_clientes').delete().eq('mes', mes);
    await carregar(true);
    setExpandidoHistMes(prev => (prev === mes ? null : prev));
    setFaturasHist(prev => { const n = { ...prev }; delete n[mes]; return n; });
    if (mes === selectedMonth) setConfirmado(false);
    setApagandoHist(null);
  }, [carregar, selectedMonth]);

  const buscarFaturasMes = useCallback(async (mes) => {
    if (faturasHist[mes] !== undefined) return;
    setCarregandoFaturasHist(mes);
    // Faturas do mês de trabalho estão datadas do mês seguinte (faturação do mês anterior)
    const result = await fetchVendasMes(mesSeguinte(mes));
    setFaturasHist(prev => ({ ...prev, [mes]: result.data }));
    setCarregandoFaturasHist(null);
  }, [faturasHist]);

  const toggleExpandidoHist = useCallback((mes) => {
    setExpandidoHistMes(prev => {
      const novo = prev === mes ? null : mes;
      if (novo) buscarFaturasMes(novo);
      return novo;
    });
  }, [buscarFaturasMes]);

  return {
    recibosAno, faturadosAno, recibosRef,
    faturasToC, faturasHist,
    carregando, confirmando, confirmado,
    carregandoToC, tocSemAuth,
    gravandoHist, apagandoHist, carregandoFaturasHist,
    expandidoHistMes, toggleExpandidoHist,
    handleConfirmar, guardarHistDb, handleApagarHist,
  };
}
