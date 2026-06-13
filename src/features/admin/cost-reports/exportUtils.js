import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatCurrency, formatDate, getMonthLabel, getLogoBase64 } from './costReportsUtils';

export const exportToXLS = async ({
  activeTab,
  workerCosts,
  clientCosts,
  clientMargins,
  allExpensesSorted,
  totalAllExpenses,
  selectedMonth,
}) => {
  const today = formatDate(new Date());
  const monthLabel = getMonthLabel(selectedMonth);
  const filename = `relatorio-${activeTab}-${selectedMonth}.xls`;
  const logoBase64 = await getLogoBase64();

  const getReportTitle = () => {
    if (activeTab === 'workers') return 'CUSTOS POR TRABALHADOR';
    if (activeTab === 'clients') return 'FATURAÇÃO POR CLIENTE';
    if (activeTab === 'margins') return 'MARGEM BRUTA POR CLIENTE';
    if (activeTab === 'expenses') return 'DESPESAS';
    return 'RELATÓRIO';
  };

  let tableRows = '';
  let totalSection = '';
  let headers = '';
  let colgroup = '';

  if (activeTab === 'workers') {
    colgroup = '<colgroup><col style="width: 280px"><col style="width: 120px"><col style="width: 140px"></colgroup>';
    headers = '<th style="background:#4F46E5;color:white;padding:12px 16px;text-align:left;font-weight:bold;border-bottom:2px solid #3730A3;">Nome</th><th style="background:#4F46E5;color:white;padding:12px 16px;text-align:right;font-weight:bold;border-bottom:2px solid #3730A3;">Total Horas</th><th style="background:#4F46E5;color:white;padding:12px 16px;text-align:right;font-weight:bold;border-bottom:2px solid #3730A3;">Custo (€)</th>';
    workerCosts.forEach((item, idx) => {
      const bgColor = idx % 2 === 0 ? '#ffffff' : '#F8FAFC';
      tableRows += `<tr style="background:${bgColor};"><td style="padding:10px 16px;font-weight:600;border-bottom:1px solid #E2E8F0;">${item.name}</td><td style="padding:10px 16px;text-align:right;border-bottom:1px solid #E2E8F0;">${item.totalHours.toFixed(2)}h</td><td style="padding:10px 16px;text-align:right;font-weight:600;color:#4F46E5;border-bottom:1px solid #E2E8F0;">${formatCurrency(item.cost)}</td></tr>`;
    });
    const totalHours = workerCosts.reduce((a, i) => a + i.totalHours, 0);
    const totalCost = workerCosts.reduce((a, i) => a + i.cost, 0);
    totalSection = `<tr style="background:#EEF2FF;"><td style="padding:14px 16px;font-weight:800;text-transform:uppercase;border-top:2px solid #4F46E5;">Total</td><td style="padding:14px 16px;text-align:right;font-weight:800;border-top:2px solid #4F46E5;">${totalHours.toFixed(2)}h</td><td style="padding:14px 16px;text-align:right;font-weight:800;font-size:16px;color:#4F46E5;border-top:2px solid #4F46E5;">${formatCurrency(totalCost)}</td></tr>`;
  }

  if (activeTab === 'clients') {
    colgroup = '<colgroup><col style="width: 280px"><col style="width: 120px"><col style="width: 140px"></colgroup>';
    headers = '<th style="background:#4F46E5;color:white;padding:12px 16px;text-align:left;font-weight:bold;border-bottom:2px solid #3730A3;">Nome</th><th style="background:#4F46E5;color:white;padding:12px 16px;text-align:right;font-weight:bold;border-bottom:2px solid #3730A3;">Total Horas</th><th style="background:#4F46E5;color:white;padding:12px 16px;text-align:right;font-weight:bold;border-bottom:2px solid #3730A3;">Faturação (€)</th>';
    clientCosts.forEach((item, idx) => {
      const bgColor = idx % 2 === 0 ? '#ffffff' : '#F8FAFC';
      tableRows += `<tr style="background:${bgColor};"><td style="padding:10px 16px;font-weight:600;border-bottom:1px solid #E2E8F0;">${item.name}</td><td style="padding:10px 16px;text-align:right;border-bottom:1px solid #E2E8F0;">${item.totalHours.toFixed(2)}h</td><td style="padding:10px 16px;text-align:right;font-weight:600;color:#059669;border-bottom:1px solid #E2E8F0;">${formatCurrency(item.cost)}</td></tr>`;
    });
    const totalHours = clientCosts.reduce((a, i) => a + i.totalHours, 0);
    const total = clientCosts.reduce((a, i) => a + i.cost, 0);
    totalSection = `<tr style="background:#ECFDF5;"><td style="padding:14px 16px;font-weight:800;text-transform:uppercase;border-top:2px solid #059669;">Total</td><td style="padding:14px 16px;text-align:right;font-weight:800;border-top:2px solid #059669;">${totalHours.toFixed(2)}h</td><td style="padding:14px 16px;text-align:right;font-weight:800;font-size:16px;color:#059669;border-top:2px solid #059669;">${formatCurrency(total)}</td></tr>`;
  }

  if (activeTab === 'margins') {
    colgroup = '<colgroup><col style="width: 220px"><col style="width: 100px"><col style="width: 130px"><col style="width: 130px"><col style="width: 130px"></colgroup>';
    headers = '<th style="background:#4F46E5;color:white;padding:12px 16px;text-align:left;font-weight:bold;border-bottom:2px solid #3730A3;">Cliente</th><th style="background:#4F46E5;color:white;padding:12px 16px;text-align:right;font-weight:bold;border-bottom:2px solid #3730A3;">Horas</th><th style="background:#4F46E5;color:white;padding:12px 16px;text-align:right;font-weight:bold;border-bottom:2px solid #3730A3;">Faturação (€)</th><th style="background:#4F46E5;color:white;padding:12px 16px;text-align:right;font-weight:bold;border-bottom:2px solid #3730A3;">Custo (€)</th><th style="background:#4F46E5;color:white;padding:12px 16px;text-align:right;font-weight:bold;border-bottom:2px solid #3730A3;">Margem (€)</th>';
    clientMargins.forEach((item, idx) => {
      const bgColor = idx % 2 === 0 ? '#ffffff' : '#F8FAFC';
      const marginColor = item.margin >= 0 ? '#059669' : '#DC2626';
      const marginSign = item.margin >= 0 ? '+' : '';
      tableRows += `<tr style="background:${bgColor};"><td style="padding:10px 16px;font-weight:600;border-bottom:1px solid #E2E8F0;">${item.name}</td><td style="padding:10px 16px;text-align:right;border-bottom:1px solid #E2E8F0;">${item.totalHours.toFixed(2)}h</td><td style="padding:10px 16px;text-align:right;color:#4F46E5;border-bottom:1px solid #E2E8F0;">${formatCurrency(item.faturation)}</td><td style="padding:10px 16px;text-align:right;color:#DC2626;border-bottom:1px solid #E2E8F0;">${formatCurrency(item.cost)}</td><td style="padding:10px 16px;text-align:right;font-weight:700;color:${marginColor};border-bottom:1px solid #E2E8F0;">${marginSign}${formatCurrency(item.margin)}</td></tr>`;
    });
    const totalF = clientMargins.reduce((a, i) => a + i.faturation, 0);
    const totalC = clientMargins.reduce((a, i) => a + i.cost, 0);
    const totalM = clientMargins.reduce((a, i) => a + i.margin, 0);
    const totalH = clientMargins.reduce((a, i) => a + i.totalHours, 0);
    const marginTotalColor = totalM >= 0 ? '#059669' : '#DC2626';
    const marginSign = totalM >= 0 ? '+' : '';
    totalSection = `<tr style="background:#EEF2FF;"><td style="padding:14px 16px;font-weight:800;text-transform:uppercase;border-top:2px solid #4F46E5;">Total</td><td style="padding:14px 16px;text-align:right;font-weight:800;border-top:2px solid #4F46E5;">${totalH.toFixed(2)}h</td><td style="padding:14px 16px;text-align:right;font-weight:800;color:#4F46E5;border-top:2px solid #4F46E5;">${formatCurrency(totalF)}</td><td style="padding:14px 16px;text-align:right;font-weight:800;color:#DC2626;border-top:2px solid #4F46E5;">${formatCurrency(totalC)}</td><td style="padding:14px 16px;text-align:right;font-weight:800;font-size:16px;color:${marginTotalColor};border-top:2px solid #4F46E5;">${marginSign}${formatCurrency(totalM)}</td></tr>`;
  }

  if (activeTab === 'expenses') {
    colgroup = '<colgroup><col style="width: 120px"><col style="width: 250px"><col style="width: 100px"><col style="width: 130px"></colgroup>';
    headers = '<th style="background:#4F46E5;color:white;padding:12px 16px;text-align:left;font-weight:bold;border-bottom:2px solid #3730A3;">Data</th><th style="background:#4F46E5;color:white;padding:12px 16px;text-align:left;font-weight:bold;border-bottom:2px solid #3730A3;">Descrição</th><th style="background:#4F46E5;color:white;padding:12px 16px;text-align:center;font-weight:bold;border-bottom:2px solid #3730A3;">Tipo</th><th style="background:#4F46E5;color:white;padding:12px 16px;text-align:right;font-weight:bold;border-bottom:2px solid #3730A3;">Valor</th>';
    allExpensesSorted.forEach((exp, idx) => {
      const bgColor = idx % 2 === 0 ? '#ffffff' : '#F8FAFC';
      const typeBg = exp.type === 'fatura' ? '#EDE9FE' : exp.type === 'fixo' ? '#DBEAFE' : '#FEF3C7';
      const typeColor = exp.type === 'fatura' ? '#7C3AED' : exp.type === 'fixo' ? '#1D4ED8' : '#D97706';
      tableRows += `<tr style="background:${bgColor};"><td style="padding:10px 16px;border-bottom:1px solid #E2E8F0;">${formatDate(exp.date)}</td><td style="padding:10px 16px;font-weight:600;border-bottom:1px solid #E2E8F0;">${exp.name}</td><td style="padding:10px 16px;text-align:center;"><span style="background:${typeBg};color:${typeColor};padding:4px 12px;border-radius:20px;font-size:11px;font-weight:700;text-transform:uppercase;">${exp.type}</span></td><td style="padding:10px 16px;text-align:right;font-weight:600;color:#DC2626;border-bottom:1px solid #E2E8F0;">-${formatCurrency(exp.amount)}</td></tr>`;
    });
    totalSection = `<tr style="background:#FEF2F2;"><td colspan="3" style="padding:14px 16px;font-weight:800;text-transform:uppercase;border-top:2px solid #DC2626;">Total</td><td style="padding:14px 16px;text-align:right;font-weight:800;font-size:16px;color:#DC2626;border-top:2px solid #DC2626;">-${formatCurrency(totalAllExpenses)}</td></tr>`;
  }

  const totalRecords = activeTab === 'workers' ? workerCosts.length
    : activeTab === 'clients' ? clientCosts.length
    : activeTab === 'margins' ? clientMargins.length
    : allExpensesSorted.length;

  const logoHtml = logoBase64
    ? `<img src="${logoBase64}" alt="Logo" style="height:60px;width:60px;border-radius:12px;margin-right:16px;" />`
    : '';

  const html = `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 40px; background: #f8fafc; }
    .header { background: linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%); color: white; padding: 30px 40px; border-radius: 16px 16px 0 0; display: flex; align-items: center; }
    .logo-container { display: flex; align-items: center; }
    .company { font-size: 24px; font-weight: 800; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 4px; }
    .title { font-size: 16px; font-weight: 500; opacity: 0.9; }
    .info-bar { background: white; padding: 20px 40px; display: flex; gap: 40px; border-bottom: 1px solid #e2e8f0; }
    .info-item { display: flex; flex-direction: column; }
    .info-label { font-size: 10px; text-transform: uppercase; color: #94a3b8; font-weight: 700; letter-spacing: 1px; }
    .info-value { font-size: 14px; font-weight: 600; color: #334155; }
    .content { background: white; border-radius: 0 0 16px 16px; padding: 0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); }
    table { width: 100%; border-collapse: collapse; margin: 0; table-layout: fixed; }
    th { background: #4F46E5; color: white; padding: 12px 16px; text-align: left; font-weight: 700; font-size: 12px; }
    td { overflow: hidden; text-overflow: ellipsis; }
    .footer { margin-top: 20px; padding: 20px; text-align: center; color: #94a3b8; font-size: 12px; }
  </style>
</head>
<body>
  <div class="header">
    <div class="logo-container">
      ${logoHtml}
      <div>
        <div class="company">Magnetic Place</div>
        <div class="title">${getReportTitle()}</div>
      </div>
    </div>
  </div>
  <div class="info-bar">
    <div class="info-item"><span class="info-label">Período</span><span class="info-value">${monthLabel}</span></div>
    <div class="info-item"><span class="info-label">Gerado em</span><span class="info-value">${today}</span></div>
    <div class="info-item"><span class="info-label">Total Registos</span><span class="info-value">${totalRecords}</span></div>
  </div>
  <div class="content">
    <table>${colgroup}<thead><tr>${headers}</tr></thead><tbody>${tableRows}</tbody><tfoot>${totalSection}</tfoot></table>
  </div>
  <div class="footer">Sistema de Gestão de Horas - Magnetic Place</div>
</body>
</html>`;

  const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export const exportRelatorioGeralPDF = async ({
  workerCosts,
  clientCosts,
  allExpensesSorted,
  totalAllExpenses,
  selectedMonth,
}) => {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const monthLabel = getMonthLabel(selectedMonth);
  const today = new Date().toLocaleDateString('pt-PT');
  const totalReceitas = clientCosts.reduce((a, i) => a + i.cost, 0);
  const totalEquipa = workerCosts.reduce((a, i) => a + i.cost, 0);
  const totalCustos = totalEquipa + totalAllExpenses;
  const resultado = totalReceitas - totalCustos;
  const logoBase64 = await getLogoBase64();

  doc.setFillColor(79, 70, 229);
  doc.rect(0, 0, 210, 32, 'F');
  if (logoBase64) doc.addImage(logoBase64, 'PNG', 14, 4, 22, 22);

  const textX = logoBase64 ? 42 : 14;
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('MAGNETIC PLACE', textX, 14);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('RELATÓRIO GERAL DE CONTABILIDADE', textX, 21);
  doc.text(`${monthLabel}  ·  Gerado em ${today}`, textX, 27);
  doc.setTextColor(0, 0, 0);

  let y = 40;

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('RESUMO EXECUTIVO', 14, y);
  y += 2;
  autoTable(doc, {
    startY: y,
    head: [['Indicador', 'Valor']],
    body: [
      ['Faturação Total (Receitas)', formatCurrency(totalReceitas)],
      ['Custos de Equipa', `-${formatCurrency(totalEquipa)}`],
      ['Outras Despesas', `-${formatCurrency(totalAllExpenses)}`],
      ['Total Custos', `-${formatCurrency(totalCustos)}`],
      ['Resultado Líquido', (resultado >= 0 ? '+' : '') + formatCurrency(resultado)],
    ],
    styles: { fontSize: 9 },
    headStyles: { fillColor: [79, 70, 229] },
    bodyStyles: { halign: 'right' },
    columnStyles: { 0: { halign: 'left', fontStyle: 'bold' } },
    didParseCell: (data) => {
      if (data.row.index === 4) {
        data.cell.styles.textColor = resultado >= 0 ? [5, 150, 105] : [220, 38, 38];
        data.cell.styles.fontStyle = 'bold';
      }
    },
  });
  y = doc.lastAutoTable.finalY + 8;

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('FATURAÇÃO POR CLIENTE', 14, y);
  y += 2;
  autoTable(doc, {
    startY: y,
    head: [['Cliente', 'Horas', 'Faturação']],
    body: [
      ...clientCosts.map(i => [i.name, `${i.totalHours.toFixed(1)}h`, formatCurrency(i.cost)]),
      ['TOTAL', `${clientCosts.reduce((a, i) => a + i.totalHours, 0).toFixed(1)}h`, formatCurrency(totalReceitas)],
    ],
    styles: { fontSize: 9 },
    headStyles: { fillColor: [79, 70, 229] },
    columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' } },
    didParseCell: (data) => {
      if (data.row.index === clientCosts.length) data.cell.styles.fontStyle = 'bold';
    },
  });
  y = doc.lastAutoTable.finalY + 8;

  if (y > 220) { doc.addPage(); y = 16; }

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('CUSTOS DE EQUIPA', 14, y);
  y += 2;
  autoTable(doc, {
    startY: y,
    head: [['Trabalhador', 'Horas', 'Custo']],
    body: [
      ...workerCosts.map(i => [i.name, `${i.totalHours.toFixed(1)}h`, formatCurrency(i.cost)]),
      ['TOTAL', `${workerCosts.reduce((a, i) => a + i.totalHours, 0).toFixed(1)}h`, formatCurrency(totalEquipa)],
    ],
    styles: { fontSize: 9 },
    headStyles: { fillColor: [79, 70, 229] },
    columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' } },
    didParseCell: (data) => {
      if (data.row.index === workerCosts.length) data.cell.styles.fontStyle = 'bold';
    },
  });
  y = doc.lastAutoTable.finalY + 8;

  if (y > 220) { doc.addPage(); y = 16; }

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('DESPESAS', 14, y);
  y += 2;
  autoTable(doc, {
    startY: y,
    head: [['Data', 'Descrição', 'Tipo', 'Valor']],
    body: [
      ...allExpensesSorted.map(e => [
        e.date ? new Date(e.date).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '—',
        e.name,
        e.type,
        formatCurrency(e.amount),
      ]),
      ['', 'TOTAL', '', formatCurrency(totalAllExpenses)],
    ],
    styles: { fontSize: 9 },
    headStyles: { fillColor: [79, 70, 229] },
    columnStyles: { 3: { halign: 'right' } },
    didParseCell: (data) => {
      if (data.row.index === allExpensesSorted.length) data.cell.styles.fontStyle = 'bold';
    },
  });

  doc.save(`relatorio-geral-${selectedMonth}.pdf`);
};

export const exportRelatorioGeralXLS = async ({
  workerCosts,
  clientCosts,
  allExpensesSorted,
  totalAllExpenses,
  selectedMonth,
}) => {
  const monthLabel = getMonthLabel(selectedMonth);
  const today = new Date().toLocaleDateString('pt-PT');
  const totalReceitas = clientCosts.reduce((a, i) => a + i.cost, 0);
  const totalEquipa = workerCosts.reduce((a, i) => a + i.cost, 0);
  const totalCustos = totalEquipa + totalAllExpenses;
  const resultado = totalReceitas - totalCustos;
  const logoBase64 = await getLogoBase64();
  const logoHtml = logoBase64 ? `<img src="${logoBase64}" alt="Logo" style="height:50px;border-radius:10px;margin-right:14px;" />` : '';

  const section = (title, color) => `<tr><td colspan="4" style="padding:14px 16px 6px;font-size:13px;font-weight:800;text-transform:uppercase;letter-spacing:1px;color:${color};border-bottom:2px solid ${color};">${title}</td></tr>`;
  const headerRow = (cols, bg = '#4F46E5') => `<tr>${cols.map(c => `<th style="background:${bg};color:white;padding:10px 14px;text-align:left;font-size:11px;font-weight:700;">${c}</th>`).join('')}</tr>`;
  const dataRow = (cols, bg = '#fff', bold = false) => `<tr style="background:${bg};">${cols.map((c, i) => `<td style="padding:9px 14px;border-bottom:1px solid #e2e8f0;font-size:11px;${bold ? 'font-weight:800;' : ''}${i > 0 ? 'text-align:right;' : ''}">${c}</td>`).join('')}</tr>`;

  const resumoRows = [
    dataRow(['Faturação Total (Receitas)', formatCurrency(totalReceitas)], '#f0fdf4'),
    dataRow(['Custos de Equipa', `-${formatCurrency(totalEquipa)}`], '#fef2f2'),
    dataRow(['Outras Despesas', `-${formatCurrency(totalAllExpenses)}`], '#fef2f2'),
    dataRow(['Total Custos', `-${formatCurrency(totalCustos)}`], '#fef2f2', true),
    dataRow(['Resultado Líquido', (resultado >= 0 ? '+' : '') + formatCurrency(resultado)], resultado >= 0 ? '#f0fdf4' : '#fef2f2', true),
  ].join('');

  const clientesRows = [
    ...clientCosts.map((i, idx) => dataRow([i.name, `${i.totalHours.toFixed(1)}h`, formatCurrency(i.cost)], idx % 2 ? '#f8fafc' : '#fff')),
    dataRow(['TOTAL', `${clientCosts.reduce((a, i) => a + i.totalHours, 0).toFixed(1)}h`, formatCurrency(totalReceitas)], '#eef2ff', true),
  ].join('');

  const equipaRows = [
    ...workerCosts.map((i, idx) => dataRow([i.name, `${i.totalHours.toFixed(1)}h`, formatCurrency(i.cost)], idx % 2 ? '#f8fafc' : '#fff')),
    dataRow(['TOTAL', `${workerCosts.reduce((a, i) => a + i.totalHours, 0).toFixed(1)}h`, formatCurrency(totalEquipa)], '#eef2ff', true),
  ].join('');

  const despesasRows = [
    ...allExpensesSorted.map((e, idx) => dataRow([
      e.date ? new Date(e.date).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '—',
      e.name, e.type, formatCurrency(e.amount),
    ], idx % 2 ? '#f8fafc' : '#fff')),
    dataRow(['', 'TOTAL', '', formatCurrency(totalAllExpenses)], '#fef2f2', true),
  ].join('');

  const html = `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8"><style>
body{font-family:'Segoe UI',Arial,sans-serif;margin:0;padding:30px;background:#f8fafc;}
.header{background:linear-gradient(135deg,#4F46E5,#7C3AED);color:white;padding:24px 32px;border-radius:16px 16px 0 0;display:flex;align-items:center;}
.info-bar{background:white;padding:16px 32px;display:flex;gap:32px;border-bottom:1px solid #e2e8f0;}
.info-label{font-size:9px;text-transform:uppercase;color:#94a3b8;font-weight:700;letter-spacing:1px;}
.info-value{font-size:13px;font-weight:600;color:#334155;}
.content{background:white;border-radius:0 0 16px 16px;padding:24px 32px;box-shadow:0 4px 6px -1px rgba(0,0,0,.1);}
table{width:100%;border-collapse:collapse;margin-bottom:24px;}
</style></head>
<body>
<div class="header">${logoHtml}<div><div style="font-size:20px;font-weight:800;text-transform:uppercase;letter-spacing:2px;">Magnetic Place</div><div style="font-size:12px;opacity:.9;">Relatório Geral de Contabilidade</div></div></div>
<div class="info-bar">
  <div><div class="info-label">Período</div><div class="info-value">${monthLabel}</div></div>
  <div><div class="info-label">Resultado</div><div class="info-value" style="color:${resultado >= 0 ? '#059669' : '#dc2626'}">${(resultado >= 0 ? '+' : '') + formatCurrency(resultado)}</div></div>
  <div><div class="info-label">Gerado em</div><div class="info-value">${today}</div></div>
</div>
<div class="content">
  <table>${section('Resumo Executivo', '#4F46E5')}${headerRow(['Indicador', 'Valor'])}${resumoRows}</table>
  <table>${section('Faturação por Cliente', '#059669')}${headerRow(['Cliente', 'Horas', 'Faturação'])}${clientesRows}</table>
  <table>${section('Custos de Equipa', '#4F46E5')}${headerRow(['Trabalhador', 'Horas', 'Custo'])}${equipaRows}</table>
  <table>${section('Despesas', '#DC2626')}${headerRow(['Data', 'Descrição', 'Tipo', 'Valor'])}${despesasRows}</table>
</div></body></html>`;

  const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `relatorio-geral-${selectedMonth}.xls`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
