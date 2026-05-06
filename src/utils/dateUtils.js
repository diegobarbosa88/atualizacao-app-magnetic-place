
/**
 * Retorna a data no formato YYYY-MM-DD ajustada para o fuso horário local.
 * @param {Date} date 
 * @returns {string}
 */
export const toISODateLocal = (date) => {
  if (!date) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Verifica se uma string de data (YYYY-MM-DD) pertence ao mesmo mês que o objeto Date alvo.
 * @param {string} dateStr 
 * @param {Date} targetDate 
 * @returns {boolean}
 */
export const isSameMonth = (dateStr, targetDate) => {
  if (!dateStr) return false;
  const [y, m] = dateStr.split('-').map(Number);
  return y === targetDate.getFullYear() && (m - 1) === targetDate.getMonth();
};

/**
 * Retorna o último dia útil (segunda a sexta) do mês de uma dada data.
 * @param {Date} date 
 * @returns {Date}
 */
export const getLastBusinessDayOfMonth = (date) => {
  let tempDate = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  while (tempDate.getDay() === 0 || tempDate.getDay() === 6) {
    tempDate.setDate(tempDate.getDate() - 1);
  }
  return tempDate;
};

/**
 * Formata uma data para exibição em pt-PT.
 * @param {string} dateStr 
 * @param {boolean} showTime 
 * @returns {string}
 */
export const formatDocDate = (dateStr, showTime = false) => {
  if (!dateStr) return '--/--/----';
  // Se for apenas data (YYYY-MM-DD), evita o shift de timezone convertendo manualmente
  if (dateStr.length === 10) {
    const [y, m, d] = dateStr.split('-');
    return `${d}/${m}/${y}`;
  }
  const d = new Date(dateStr);
  if (showTime) {
    return d.toLocaleString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString('pt-PT');
};

/**
 * Converte strings de mês (ex: "Janeiro 2024") ou formatos YYYY-MM para YYYY-MM.
 * @param {string} monthStr 
 * @returns {string|null}
 */
export const monthToYYYYMM = (monthStr) => {
  if (!monthStr) return null;
  if (monthStr.match(/^\d{4}-\d{2}$/)) return monthStr;
  const months = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  const lower = monthStr.toLowerCase();
  const monthIdx = months.findIndex(m => lower.includes(m));
  const yearMatch = monthStr.match(/\d{4}/);
  if (monthIdx >= 0 && yearMatch) {
    return `${yearMatch[0]}-${String(monthIdx + 1).padStart(2, '0')}`;
  }
  return monthStr;
};

/**
 * Retorna o número da semana ISO para uma dada data.
 * @param {Date} d 
 * @returns {number}
 */
export const getISOWeek = (d) => {
  if (!d || isNaN(d.getTime())) return 0;
  const date = new Date(d.getTime());
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + 3 - (date.getDay() + 6) % 7);
  const week1 = new Date(date.getFullYear(), 0, 4);
  return 1 + Math.round(((date.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
};
