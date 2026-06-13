export const MESES_PT_SAL = {
  '01': 'Jan', '02': 'Fev', '03': 'Mar', '04': 'Abr',
  '05': 'Mai', '06': 'Jun', '07': 'Jul', '08': 'Ago',
  '09': 'Set', '10': 'Out', '11': 'Nov', '12': 'Dez',
};

export function fmtEur(v) {
  return (parseFloat(v) || 0).toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}

export function fmtMes(month) {
  const [ano, mm] = month.split('-');
  return `${MESES_PT_SAL[mm]} ${ano}`;
}
