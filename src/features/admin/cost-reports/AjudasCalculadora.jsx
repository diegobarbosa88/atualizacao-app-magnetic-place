import React, { useState, useMemo } from 'react';
import { Loader2 } from 'lucide-react';
import FaturarClienteModal from '../toconline/FaturarClienteModal';
import { useAjudasData } from './ajudas/useAjudasData';
import { useAjudasCalculo } from './ajudas/useAjudasCalculo';
import PainelAnual from './ajudas/PainelAnual';
import TabelaEstimativa from './ajudas/TabelaEstimativa';
import PainelHistorico from './ajudas/PainelHistorico';

export default function AjudasCalculadora({ logs, clients, selectedMonth }) {
  const ano = selectedMonth.slice(0, 4);
  const numMes = parseInt(selectedMonth.slice(5, 7), 10);
  const mesesRestantes = 13 - numMes;

  const [faturarCliente, setFaturarCliente] = useState(null);

  // clientesMes calculado aqui para derivar semHoras antes de chamar os hooks
  const clientesMes = useMemo(() => {
    const logsDoMes = logs.filter(l => l.date?.startsWith(selectedMonth));
    const map = {};
    logsDoMes.forEach(l => {
      if (!l.clientId) return;
      if (!map[l.clientId]) map[l.clientId] = 0;
      map[l.clientId] += parseFloat(l.hours) || 0;
    });
    return Object.entries(map).map(([clientId, horas]) => {
      const client = clients.find(c => c.id === clientId);
      const valorFatura = horas * (parseFloat(client?.valorHora) || 0);
      return { clientId, dbClientId: clientId, nome: client?.name ?? clientId, horas, valorFatura };
    }).filter(c => c.valorFatura > 0).sort((a, b) => b.valorFatura - a.valorFatura);
  }, [logs, clients, selectedMonth]);

  const semHoras = clientesMes.length === 0;

  const dataHook = useAjudasData({ ano, selectedMonth, semHoras });
  const calculoHook = useAjudasCalculo({
    logs, clients, selectedMonth,
    semHoras, clientesMes,
    recibosAno: dataHook.recibosAno,
    recibosRef: dataHook.recibosRef,
    faturadosAno: dataHook.faturadosAno,
    faturasToC: dataHook.faturasToC,
  });

  // Coordena gravação na BD (dataHook) com limpeza do estado UI (calculoHook)
  const handleGuardarHist = async (mes) => {
    const linhasMes = await dataHook.guardarHistDb(mes, calculoHook.histOverrides);
    calculoHook.clearHistOverridesForMes(linhasMes);
  };

  if (dataHook.carregando) return (
    <div className="flex justify-center py-16"><Loader2 size={22} className="animate-spin text-indigo-400" /></div>
  );

  return (
    <div className="space-y-5">
      <PainelAnual
        ano={ano}
        orcamentoAnual={calculoHook.orcamentoAnual}
        jaFaturadoYTD={calculoHook.jaFaturadoYTD}
        saldoDisponivel={calculoHook.saldoDisponivel}
        mesesRestantes={mesesRestantes}
        ajudasEfetivoMes={calculoHook.ajudasEfetivoMes}
        eEstimativa={calculoHook.eEstimativa}
        semHoras={semHoras}
        progressoPct={calculoHook.progressoPct}
        regraCumprida={calculoHook.regraCumprida}
      />

      <TabelaEstimativa
        selectedMonth={selectedMonth}
        semHoras={semHoras}
        clientesMesFinal={calculoHook.clientesMesFinal}
        linhas={calculoHook.linhas}
        totalFaturaMes={calculoHook.totalFaturaMes}
        totalAjudasMes={calculoHook.totalAjudasMes}
        ajudasEfetivoMes={calculoHook.ajudasEfetivoMes}
        eEstimativa={calculoHook.eEstimativa}
        ajudasReciboMes={calculoHook.ajudasReciboMes}
        regraCumprida={calculoHook.regraCumprida}
        somaFixas={calculoHook.somaFixas}
        saldoRestante={calculoHook.saldoRestante}
        nVazias={calculoHook.nVazias}
        confirmado={dataHook.confirmado}
        confirmando={dataHook.confirmando}
        copiado={calculoHook.copiado}
        tocSemAuth={dataHook.tocSemAuth}
        carregandoToC={dataHook.carregandoToC}
        overrides={calculoHook.overrides}
        setOverrides={calculoHook.setOverrides}
        obsAplicados={calculoHook.obsAplicados}
        setObsAplicados={calculoHook.setObsAplicados}
        selecionados={calculoHook.selecionados}
        setSelecionados={calculoHook.setSelecionados}
        obsResult={calculoHook.obsResult}
        extraindoObs={calculoHook.extraindoObs}
        onExtrairObs={calculoHook.handleExtrairObs}
        onRedistribuir={calculoHook.handleRedistribuir}
        onCopiar={calculoHook.handleCopiar}
        onConfirmar={() => dataHook.handleConfirmar(calculoHook.linhas)}
        onFaturarCliente={setFaturarCliente}
      />

      <PainelHistorico
        ano={ano}
        selectedMonth={selectedMonth}
        historicoAnual={calculoHook.historicoAnual}
        faturadosAno={dataHook.faturadosAno}
        taxaAjudas={calculoHook.taxaAjudas}
        faturasHist={dataHook.faturasHist}
        histOverrides={calculoHook.histOverrides}
        setHistOverrides={calculoHook.setHistOverrides}
        expandidoHistMes={dataHook.expandidoHistMes}
        toggleExpandidoHist={dataHook.toggleExpandidoHist}
        gravandoHist={dataHook.gravandoHist}
        apagandoHist={dataHook.apagandoHist}
        carregandoFaturasHist={dataHook.carregandoFaturasHist}
        onGuardarHist={handleGuardarHist}
        onApagarHist={dataHook.handleApagarHist}
        clients={clients}
        logs={logs}
      />

      {faturarCliente && (
        <FaturarClienteModal
          clienteIdInicial={faturarCliente.clienteId}
          ajudasValorInicial={faturarCliente.ajudasValor}
          periodoInicial={selectedMonth}
          onClose={() => setFaturarCliente(null)}
          onFaturado={() => setFaturarCliente(null)}
        />
      )}
    </div>
  );
}
