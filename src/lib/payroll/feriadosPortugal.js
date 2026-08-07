// Algoritmo de Butcher para cálculo da data da Páscoa
function calcularPascoa(ano) {
  const a = ano % 19;
  const b = Math.floor(ano / 100);
  const c = ano % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(ano, month - 1, day);
}

function toStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function addDias(date, nDias) {
  const d = new Date(date);
  d.setDate(d.getDate() + nDias);
  return d;
}

/**
 * Retorna um Set<string> com os feriados nacionais obrigatórios de Portugal
 * para o ano indicado, mais o feriado municipal opcional.
 *
 * @param {number} ano
 * @param {string|null} feriadoMunicipal  'MM-DD' ou 'YYYY-MM-DD'
 * @returns {Set<string>}
 */
export function calcularFeriados(ano, feriadoMunicipal = null) {
  const pascoa = calcularPascoa(ano);

  const feriados = new Set([
    `${ano}-01-01`,               // Ano Novo
    toStr(addDias(pascoa, -2)),   // Sexta-feira Santa
    toStr(pascoa),                // Páscoa (Domingo)
    `${ano}-04-25`,               // Dia da Liberdade
    `${ano}-05-01`,               // Dia do Trabalhador
    toStr(addDias(pascoa, 60)),   // Corpo de Deus (Quinta-feira)
    `${ano}-06-10`,               // Dia de Portugal
    `${ano}-08-15`,               // Assunção de Nossa Senhora
    `${ano}-10-05`,               // Implantação da República
    `${ano}-11-01`,               // Dia de Todos os Santos
    `${ano}-12-01`,               // Restauração da Independência
    `${ano}-12-08`,               // Imaculada Conceição
    `${ano}-12-25`,               // Natal
  ]);

  if (feriadoMunicipal) {
    // Aceita 'MM-DD' (completa com o ano) ou 'YYYY-MM-DD'
    const fm = /^\d{2}-\d{2}$/.test(feriadoMunicipal)
      ? `${ano}-${feriadoMunicipal}`
      : feriadoMunicipal;
    feriados.add(fm);
  }

  return feriados;
}

/**
 * Calcula os dias úteis num mês, excluindo fins-de-semana, feriados nacionais
 * e, opcionalmente: feriado municipal, período antes da admissão, período após
 * cessação de contrato, e ausências aprovadas.
 *
 * Feriados que caem ao fim-de-semana não são descontados duas vezes.
 *
 * @param {number}   ano
 * @param {number}   mes              1–12
 * @param {Object}   [opcoes]
 * @param {string|null} [opcoes.feriadoMunicipal]  'MM-DD' ou 'YYYY-MM-DD'
 * @param {string|null} [opcoes.dataAdmissao]       'YYYY-MM-DD'
 * @param {string|null} [opcoes.dataCessacao]       'YYYY-MM-DD'
 * @param {string[]}    [opcoes.ausencias]           datas 'YYYY-MM-DD' aprovadas
 * @param {number}      [opcoes.horasSemana]         padrão 40 → 5 dias/semana
 * @returns {number}
 */
export function calcularDiasUteisNoMes(ano, mes, opcoes = {}) {
  const {
    feriadoMunicipal = null,
    dataAdmissao = null,
    dataCessacao = null,
    ausencias = [],
    horasSemana = 40,
  } = opcoes;

  // Dias úteis da semana: 40 h/sem → 5 dias (Seg–Sex); proporcional para horários reduzidos
  const numDiasSemana = Math.min(5, Math.max(1, Math.round(horasSemana / 8)));
  const diasSemana = [1, 2, 3, 4, 5].slice(0, numDiasSemana); // 1=Seg … 5=Sex

  const feriados = calcularFeriados(ano, feriadoMunicipal);
  const totalDias = new Date(ano, mes, 0).getDate();
  const mesStr = String(mes).padStart(2, '0');
  let count = 0;

  for (let d = 1; d <= totalDias; d++) {
    const dateStr = `${ano}-${mesStr}-${String(d).padStart(2, '0')}`;
    const dow = new Date(ano, mes - 1, d).getDay(); // 0=Dom … 6=Sáb

    if (!diasSemana.includes(dow)) continue;         // fim de semana / dia não útil
    if (feriados.has(dateStr)) continue;             // feriado (nacional ou municipal)
    if (dataAdmissao && dateStr < dataAdmissao) continue;
    if (dataCessacao && dateStr > dataCessacao) continue;
    if (ausencias.includes(dateStr)) continue;

    count++;
  }

  return count;
}
