// Rateio proporcional partilhado entre a Fase 1 (percentagemHistorica.js —
// "Rateio Proporcional Histórico") e a Fase 2 (estimativaMensal.js —
// rateio da estimativa mensal por cliente). Extraído para um único
// ficheiro para nunca haver duas implementações da mesma divisão a
// divergir com o tempo (o problema que já existia com _calcReciboComMapa
// triplicado noutras partes do projeto).

/**
 * Distribui `total` pelos itens de `itens`, proporcionalmente ao respetivo
 * campo `valor`. Preserva todos os campos originais de cada item e adiciona
 * `valorRateado`.
 *
 * Se a soma dos valores for 0 (ou não houver itens), devolve todos os itens
 * com `valorRateado: 0` — nunca divide por zero.
 *
 * @param {number} total
 * @param {Array<{ valor: number, [key: string]: any }>} itens
 * @returns {Array<{ valor: number, valorRateado: number, [key: string]: any }>}
 */
export function ratearProporcional(total, itens) {
  const lista = itens || [];
  const totalValor = lista.reduce((s, it) => s + (Number(it.valor) || 0), 0);

  if (totalValor <= 0) {
    return lista.map(it => ({ ...it, valorRateado: 0 }));
  }

  return lista.map(it => {
    const valor = Number(it.valor) || 0;
    const pct = valor / totalValor;
    return { ...it, valorRateado: total * pct };
  });
}
