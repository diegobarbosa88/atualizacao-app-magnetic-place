/**
 * Busca combinatória para o Mapa de Ajudas de Custo (DL 106/98, art. 8º).
 *
 * Frações legais:
 *   Partida  — 100% (antes das 13h) | 75% (13h–21h) | 50% (a partir das 21h)
 *   Chegada  —  50% (a partir das 20h) | 25% (13h–20h) | 0% (antes das 13h)
 *   Intermédios — sempre 100%
 *
 * Fórmula: total = valorDiario × ((N − 2) + fP + fC)   (N ≥ 2)
 */

export const FRAC_PARTIDA = [1.00, 0.75, 0.50];
export const FRAC_CHEGADA = [0.50, 0.25, 0.00];

/** Hora de referência default para a linha de Partida, por fração legal. */
export function horaDefaultPartida(fP, override = null) {
  if (fP === 1.00) return override || '07:30';
  if (fP === 0.75) return '14:00';
  return '21:30'; // 0.50
}

/** Hora de referência default para a linha de Chegada, por fração legal. */
export function horaDefaultChegada(fC, override = null) {
  if (fC === 0.50) return override || '21:30';
  if (fC === 0.25) return '19:00';
  return '10:00'; // 0.00
}

/** pct para linha Partida a partir da hora introduzida pelo utilizador. */
export function pctFromHoraPartida(hora) {
  const [h = 7] = hora.split(':').map(Number);
  return h >= 21 ? 50 : h >= 13 ? 75 : 100;
}

/** pct para linha Chegada a partir da hora introduzida pelo utilizador. */
export function pctFromHoraChegada(hora) {
  const [h = 20] = hora.split(':').map(Number);
  return h < 13 ? 0 : h < 20 ? 25 : 50;
}

/**
 * Testa todas as combinações (N, fP, fC) e devolve a mais próxima de valorNec.
 *
 * Critérios de desempate (por ordem de prioridade):
 *   1. Menor |diff|  (diff = valorNec − total)
 *   2. diff ≥ 0  (mapa não ultrapassa o necessário)
 *   3. fP maior  (partida 100% é o padrão — evita viagens "tardias" desnecessárias)
 *   4. N maior   (viagem mais longa = mais plausível)
 *   5. fC maior  (chegada com fração mais alta)
 *
 * @param {number} valorNec    ajudaNecessaria + subsAlimMapa nesta iteração
 * @param {number} valorDiario limite diário de ajuda de custo (VDL)
 * @param {number} maxN        nº máximo de dias a testar (dias do mês, ex.: 30)
 * @returns {{ N, fP, fC, total, diff, absDiff } | null}
 */
export function findBestCombo(valorNec, valorDiario, maxN) {
  if (valorNec <= 0 || valorDiario <= 0 || maxN < 2) return null;

  let best = null;
  const eps = 0.01; // tolerância de centavo para considerar como "igual"

  for (let N = 2; N <= maxN; N++) {
    for (const fP of FRAC_PARTIDA) {
      for (const fC of FRAC_CHEGADA) {
        const total   = valorDiario * ((N - 2) + fP + fC);
        const diff    = valorNec - total;
        const absDiff = Math.abs(diff);

        if (!best) { best = { N, fP, fC, total, diff, absDiff }; continue; }

        const betterAbsDiff = absDiff < best.absDiff - eps;
        const tieAbsDiff    = absDiff <= best.absDiff + eps;

        if (betterAbsDiff) {
          best = { N, fP, fC, total, diff, absDiff };
        } else if (tieAbsDiff) {
          const thisPos = diff >= 0;
          const bestPos = best.diff >= 0;

          if (thisPos && !bestPos) {
            // Regra 2: diff≥0 bate diff<0
            best = { N, fP, fC, total, diff, absDiff };
          } else if (thisPos === bestPos) {
            if (fP > best.fP) {
              // Regra 3: partida mais alta (100% > 75% > 50%)
              best = { N, fP, fC, total, diff, absDiff };
            } else if (fP === best.fP) {
              if (N > best.N) {
                // Regra 4: viagem mais longa
                best = { N, fP, fC, total, diff, absDiff };
              } else if (N === best.N && fC > best.fC) {
                // Regra 5: chegada com fração mais alta
                best = { N, fP, fC, total, diff, absDiff };
              }
            }
          }
        }
      }
    }
  }

  return best;
}
