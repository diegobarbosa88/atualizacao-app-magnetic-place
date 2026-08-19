// Novo método do numerador da % histórica (substitui a atribuição por
// horas em distribuicaoHoras.js — ver DECISIONS.md). Corre de forma
// contínua (passado e futuro), não só no saneamento inicial.
//
// Duplo desvio M→M-1 (validado com dados reais — faturas e recibos):
//   - Uma fatura DATADA de mesFatura (= mes+1) declara o trabalho de `mes`.
//   - Um receipt_validations com mes=mesFatura reporta, pela mesma razão,
//     o trabalho de `mes` (confirmado por estabilidade do rácio ajuda/hora
//     em 9/9 trabalhadores testados — SEMPRE mais estável com mes+1 do que
//     com o mesmo mês).
//   Por isso, para calcular os valores do mês de REFERÊNCIA `mes`, os dois
//   lados (faturas e recibos) vêm de mesFatura = mes+1 — nunca de `mes`
//   diretamente.
//
// Resíduo CUMULATIVO (mudança de desenho): o resíduo de um mês (total real
// de recibos − total declarado, ambos já desviados) já não é forçado a
// zero mês a mês — soma-se a saldoAcumuladoEntrada, e só é distribuído
// pelas faturas sem declaração desse mês se o saldo resultante for > 0 E
// houver faturas sem declaração para o receber. Nesse caso o saldo é todo
// alocado (volta a 0). Caso contrário, transporta-se inalterado para o mês
// seguinte — nunca se explica nem se força a zero um resíduo negativo
// isolado; ele é absorvido (ou não) pelos meses seguintes.
//
// O valor de ajuda de custo de cada fatura vem, por ordem de prioridade:
//   1. Do que estiver DECLARADO na própria observação da fatura
//      (extrairValorObs, já corrigido para os formatos PT reais).
//   2. Quando não há valor declarado, uma fatia do saldoAcumulado (ver
//      acima), rateada proporcionalmente ao valor de cada fatura sem
//      declaração — elegíveis e não elegíveis (decisão já tomada: o
//      universo de rateio é sempre todos os clientes; só o total final
//      filtra por elegibilidade, em consolidarTotalReal).
//
// Nunca depende de logs/elegibilidade.js/distribuicaoHoras.js — o total
// real (receipt_validations) é um número da empresa inteira, sem tentar
// decompor por trabalhador/cliente; é a própria fatura que diz a que lhe
// corresponde (ou herda uma fatia do saldo acumulado).
//
// Pura função de leitura — nunca escreve em ajudas_valores_por_cliente_mes;
// devolve as linhas para quem chamar decidir gravar (ação explícita).

import { buscarFaturasVendasPeriodo } from './faturasToConline.js';
import { extrairValorObs } from './valorObservacao.js';
import { ratearProporcional } from './rateio.js';

// Mesmos estados aceites em percentagemHistorica.js (ESTADOS_VALIDOS) — um
// recibo 'erro'/'invalido' não deve entrar no total real, aqui como lá.
const ESTADOS_VALIDOS = ['valido', 'pago', 'aviso'];

export function mesSeguinte(mes) {
  const [ano, m] = mes.split('-').map(Number);
  let novoMes = m + 1, novoAno = ano;
  if (novoMes > 12) { novoMes = 1; novoAno++; }
  return `${novoAno}-${String(novoMes).padStart(2, '0')}`;
}

// Mês corrente real ('YYYY-MM') — usado para detetar quando mesFatura cai
// no mês em curso (ou no futuro), cujos dados (faturas/recibos) ainda
// podem estar incompletos. Função à parte (não uma constante) para os
// testes poderem continuar determinísticos sem depender da data real.
export function mesAtualISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * @param {object} params
 * @param {string} params.mes  'YYYY-MM' — mês de REFERÊNCIA (do trabalho, não da fatura)
 * @param {object} params.dbClient
 * @param {function} [params.fetchVendasFn]  injetado nos testes
 * @param {number} [params.saldoAcumuladoEntrada]  saldo transportado do mês anterior (default 0 — início do período)
 * @returns {Promise<{
 *   mes: string,
 *   mesFatura: string,
 *   dadosInsuficientes: boolean,
 *   linhas: Array<{
 *     mes: string, client_id: string, fatura_id: string, valor_fatura: number,
 *     valor_declarado: number|null, valor_atribuido: number,
 *     origem: 'declarado'|'distribuido', elegivel_na_data: boolean|null,
 *   }>,
 *   totalRealRecibos: number,
 *   totalDeclarado: number,
 *   residuoBruto: number,
 *   saldoAcumuladoEntrada: number,
 *   saldoAcumuladoSaida: number,
 *   semClienteCorrespondente: Array,
 * }>}
 */
export async function calcularValoresPorClienteMes({ mes, dbClient, fetchVendasFn, saldoAcumuladoEntrada = 0 }) {
  const mesFatura = mesSeguinte(mes);

  // Mês em curso (ou futuro) — as faturas/recibos de mesFatura ainda podem
  // estar incompletos (o mês não fechou). Nunca se trata como resíduo=0
  // silencioso: fica sinalizado, e quem chamar (consolidarTotalReal) decide
  // excluir este mês do fecho normal, sem tocar no saldoAcumulado.
  if (mesFatura >= mesAtualISO()) {
    return {
      mes,
      mesFatura,
      dadosInsuficientes: true,
      linhas: [],
      totalRealRecibos: 0,
      totalDeclarado: 0,
      residuoBruto: 0,
      saldoAcumuladoEntrada,
      saldoAcumuladoSaida: saldoAcumuladoEntrada,
      semClienteCorrespondente: [],
    };
  }

  const { faturas, semClienteCorrespondente } = await buscarFaturasVendasPeriodo({
    periodoInicio: mesFatura, periodoFim: mesFatura, dbClient, fetchVendasFn,
  });

  const faturasComDeclarado = faturas.map(f => ({ ...f, valorDeclarado: extrairValorObs(f.observacao) }));

  const { data: validations, error: errV } = await dbClient
    .from('receipt_validations')
    .select('ajudas_custo_extraidas, estado')
    .eq('mes', mesFatura);
  if (errV) throw errV;

  const totalRealRecibos = (validations || [])
    .filter(v => ESTADOS_VALIDOS.includes(v.estado))
    .reduce((s, v) => s + (Number(v.ajudas_custo_extraidas) || 0), 0);

  const comDeclarado = faturasComDeclarado.filter(f => (f.valorDeclarado || 0) > 0);
  const semDeclarado = faturasComDeclarado.filter(f => !((f.valorDeclarado || 0) > 0));

  const totalDeclarado = comDeclarado.reduce((s, f) => s + f.valorDeclarado, 0);
  const residuoBruto = totalRealRecibos - totalDeclarado;
  const saldoAntes = saldoAcumuladoEntrada + residuoBruto;

  let semDeclaradoRateadas;
  let saldoAcumuladoSaida;
  if (saldoAntes > 0 && semDeclarado.length > 0) {
    semDeclaradoRateadas = ratearProporcional(saldoAntes, semDeclarado);
    saldoAcumuladoSaida = 0;
  } else {
    // Ou saldoAntes <= 0 (nada para distribuir este mês), ou não há
    // faturas sem declaração para o receber — em ambos os casos o saldo
    // transporta-se inalterado, nunca se força a zero.
    semDeclaradoRateadas = semDeclarado.map(f => ({ ...f, valorRateado: 0 }));
    saldoAcumuladoSaida = saldoAntes;
  }

  const linhas = [
    ...comDeclarado.map(f => ({
      mes,
      client_id: f.clientId,
      fatura_id: f.faturaId,
      valor_fatura: f.valor,
      valor_declarado: f.valorDeclarado,
      valor_atribuido: f.valorDeclarado,
      origem: 'declarado',
      elegivel_na_data: f.elegivel,
    })),
    ...semDeclaradoRateadas.map(f => ({
      mes,
      client_id: f.clientId,
      fatura_id: f.faturaId,
      valor_fatura: f.valor,
      valor_declarado: null,
      valor_atribuido: f.valorRateado,
      origem: 'distribuido',
      elegivel_na_data: f.elegivel,
    })),
  ];

  return {
    mes,
    mesFatura,
    dadosInsuficientes: false,
    linhas,
    totalRealRecibos,
    totalDeclarado,
    residuoBruto,
    saldoAcumuladoEntrada,
    saldoAcumuladoSaida,
    semClienteCorrespondente,
  };
}
