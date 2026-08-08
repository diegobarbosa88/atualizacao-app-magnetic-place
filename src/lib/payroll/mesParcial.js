/**
 * Proporcionalidade por mês parcial — Código do Trabalho (Lei n.º 7/2009).
 * Convenção legal: mês de 30 dias para todos os cálculos de proporcionalidade.
 */

/**
 * Devolve os metadados de proporcionalidade do mês para um dado trabalhador.
 *
 * @param {string|null} dataInicio - Data de admissão 'YYYY-MM-DD'
 * @param {string|null} dataFim    - Data de cessação 'YYYY-MM-DD'
 * @param {number}      ano
 * @param {number}      mes        - 1–12
 * @returns {{ tipo, diaInicio, diaFim, diasTrabalhados, fator }}
 */
export function calcMesParcial(dataInicio, dataFim, ano, mes) {
  const mesStr = `${ano}-${String(mes).padStart(2, '0')}`;

  const isAdmissao = Boolean(dataInicio?.startsWith(mesStr));
  const isCessacao = Boolean(dataFim?.startsWith(mesStr));

  if (!isAdmissao && !isCessacao) {
    return { tipo: 'completo', diaInicio: 1, diaFim: 30, diasTrabalhados: 30, fator: 1 };
  }

  const diaInicio = isAdmissao ? parseInt(dataInicio.slice(8, 10), 10) : 1;
  // Convenção: dia 31 (em meses com 31 dias) conta como 30
  const diaFimRaw = isCessacao ? parseInt(dataFim.slice(8, 10), 10) : 30;
  const diaFim    = Math.min(diaFimRaw, 30);

  const diasTrabalhados = Math.max(0, diaFim - diaInicio + 1);

  return {
    tipo: isAdmissao && isCessacao ? 'ambos' : isAdmissao ? 'inicio' : 'fim',
    diaInicio,
    diaFim,
    diasTrabalhados,
    fator: diasTrabalhados / 30,
  };
}

/**
 * Calcula o total proporcional de subsídio de férias e natal para o ano civil.
 * Aplica-se no ano de admissão e/ou no ano de cessação.
 *
 * Para cada mês do ano civil em que o trabalhador esteve ativo:
 *   - Mês completo → soma 1 duodécimo
 *   - Mês parcial (admissão ou cessação) → soma dias/30 de um duodécimo
 *
 * @param {number}      vencimentoBase
 * @param {string|null} dataInicio
 * @param {string|null} dataFim
 * @param {number}      ano
 * @returns {{ fratorAno, subsFeriasTotalAno, subsNatalTotalAno, descricao }}
 */
export function calcSubsidiosAnoProportional(vencimentoBase, dataInicio, dataFim, ano) {
  const inicioStr = `${ano}-01-01`;
  const fimStr    = `${ano}-12-31`;

  // Data efetiva de início no ano civil
  const efInicio = (!dataInicio || dataInicio <= inicioStr) ? inicioStr : dataInicio;
  // Data efetiva de fim no ano civil
  const efFim    = (!dataFim    || dataFim    >= fimStr)    ? fimStr    : dataFim;

  const mesI    = parseInt(efInicio.slice(5, 7), 10);
  const diaI    = parseInt(efInicio.slice(8, 10), 10);
  const mesF    = parseInt(efFim.slice(5, 7), 10);
  const diaFRaw = parseInt(efFim.slice(8, 10), 10);
  const diaF    = Math.min(diaFRaw, 30);

  // Acumula frações (1.0 = mês completo, dias/30 = mês parcial)
  let fratorAno = 0;
  for (let m = mesI; m <= mesF; m++) {
    const startDay = m === mesI ? diaI : 1;
    const endDay   = m === mesF ? diaF : 30;
    fratorAno += Math.max(0, endDay - startDay + 1) / 30;
  }

  const subsPorMes = vencimentoBase / 12;
  const total      = subsPorMes * fratorAno;

  const mesesCompletos = Math.floor(fratorAno);
  const diasRestantes  = Math.round((fratorAno - mesesCompletos) * 30);
  const descricao =
    `${mesesCompletos} ${mesesCompletos === 1 ? 'mês completo' : 'meses completos'}` +
    (diasRestantes > 0 ? ` + ${diasRestantes} dias` : '');

  return { fratorAno, subsFeriasTotalAno: total, subsNatalTotalAno: total, descricao };
}

/**
 * Rubricas adicionais do acerto de contas na cessação de contrato.
 *
 * @param {number}      vencimentoBase
 * @param {string|null} dataInicio
 * @param {string|null} dataFim
 * @param {number}      ano
 * @param {number}      diasFeriasNaoGozadas
 * @returns {{ feriasNaoGozadasEur, subsidioSobreFeriasNaoGozadas, subsFeriasProp, subsNatalProp, fratorAno, descricao }}
 */
export function calcAcertoCessacao(vencimentoBase, dataInicio, dataFim, ano, diasFeriasNaoGozadas = 0) {
  const { subsFeriasTotalAno, subsNatalTotalAno, fratorAno, descricao } =
    calcSubsidiosAnoProportional(vencimentoBase, dataInicio, dataFim, ano);

  const valorDiario                   = vencimentoBase / 30;
  const feriasNaoGozadasEur           = Math.max(0, diasFeriasNaoGozadas) * valorDiario;
  const subsidioSobreFeriasNaoGozadas = feriasNaoGozadasEur;

  return {
    feriasNaoGozadasEur,
    subsidioSobreFeriasNaoGozadas,
    subsFeriasProp: subsFeriasTotalAno,
    subsNatalProp:  subsNatalTotalAno,
    fratorAno,
    descricao,
  };
}

/**
 * Dias de férias a que o trabalhador tem direito no ano de admissão.
 * Regra: 2 dias úteis por mês completo trabalhado, máximo 20 dias se ≥ 10 meses.
 *
 * @param {string}      dataInicio
 * @param {string|null} dataFim
 * @param {number}      ano
 * @returns {{ diasFerias, mesesCompletos, limitado } | null}  null se não é o ano de admissão
 */
export function calcDiasFeriasAnoAdmissao(dataInicio, dataFim, ano) {
  if (!dataInicio) return null;
  const anoAdmissao = parseInt(dataInicio.slice(0, 4), 10);
  if (anoAdmissao !== ano) return null;

  const mesI    = parseInt(dataInicio.slice(5, 7), 10);
  const diaI    = parseInt(dataInicio.slice(8, 10), 10);
  const mesF    = dataFim?.startsWith(String(ano)) ? parseInt(dataFim.slice(5, 7), 10) : 12;
  const diaFRaw = dataFim?.startsWith(String(ano)) ? parseInt(dataFim.slice(8, 10), 10) : 30;
  const diaF    = Math.min(diaFRaw, 30);

  let mesesCompletos = 0;
  for (let m = mesI; m <= mesF; m++) {
    const startDay = m === mesI ? diaI : 1;
    const endDay   = m === mesF ? diaF : 30;
    // Mês completo = trabalhado do dia 1 ao dia 30 (convenção)
    if (startDay === 1 && endDay >= 30) mesesCompletos++;
  }

  const diasSemLimite = mesesCompletos * 2;
  // Limite de 20 dias aplica-se quando a duração do contrato ≥ 6 meses no ano de admissão
  const limitado  = mesesCompletos >= 6 && diasSemLimite > 20;
  const diasFerias = limitado ? 20 : diasSemLimite;

  return { diasFerias, mesesCompletos, limitado };
}
