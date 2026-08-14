export const formatCurrency = (value) =>
  new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(value);

export const formatDate = (date) =>
  new Date(date).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric' });

export const getMonthLabel = (selectedMonth) => {
  const [year, month] = selectedMonth.split('-');
  return new Date(year, month - 1)
    .toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' })
    .toUpperCase();
};

export const getLogoBase64 = async () => {
  try {
    const response = await fetch('/MAGNETIC (3).png');
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
};

// f.valor e dados.valor_total vêm quase sempre como número puro do Supabase
// (confirmado nos dados reais: dados.valor_total nunca é string). O parsing
// de formato PT ("1.234,56") só se aplica se o valor vier mesmo como string
// — nunca a um número já correto, para não apagar o ponto decimal.
const toNumeroValor = (v) => {
  if (v == null) return 0;
  if (typeof v === 'number') return v;
  return parseFloat(String(v).replace(/\./g, '').replace(',', '.')) || 0;
};

export const parseFaturaValor = (f) => {
  if (!f) return 0;
  const v = toNumeroValor(f.valor);
  const v2 = toNumeroValor(f.dados?.valor_total);
  return (v > 0 ? v : v2) || 0;
};

export const generateMonthOptions = () => {
  const options = [];
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth();
  for (let i = 0; i < 12; i++) {
    const d = new Date(currentYear, currentMonth - i, 1);
    const val = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
    const label = d.toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' });
    options.push({ val, label: label.charAt(0).toUpperCase() + label.slice(1) });
  }
  return options;
};
