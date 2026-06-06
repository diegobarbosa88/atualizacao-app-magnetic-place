import { jsPDF } from 'jspdf';

export async function gerarRelatorioFaturasPDF({ lista, filtroStatus, systemSettings }) {
  const soReconciliadas = filtroStatus === 'pagas';
  const hoje = new Date().toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const empresa = systemSettings?.companyName || 'Magnetic Place';
  const totalValor = lista.reduce((s, f) => s + (f.dados?.valor_total ?? 0), 0);
  const totalIva = lista.reduce((s, f) => s + (f.dados?.iva ?? 0), 0);

  let logoDataUrl = null;
  try {
    const logoSrc = systemSettings?.companyLogo || '/MAGNETIC (3).png';
    const res = await fetch(logoSrc);
    if (res.ok) {
      const blob = await res.blob();
      logoDataUrl = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.readAsDataURL(blob);
      });
    }
  } catch { /* logo opcional */ }

  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const M = 14;
  const pW = 210;
  const pH = 297;
  const cW = pW - M * 2;

  const cols = [
    ['Nº Fatura', 30, 'left'],
    ['Fornecedor', 50, 'left'],
    ['Data', 20, 'center'],
    ['Total (€)', 22, 'right'],
    ['IVA (€)', 18, 'right'],
    ['Estado', 18, 'center'],
    ['Ficheiro', 24, 'left'],
  ];

  const rowH = 7;
  let y = M;

  const headerH = 14;
  if (logoDataUrl) {
    try { pdf.addImage(logoDataUrl, M, y + 1, 12, 12); } catch { /* ignora */ }
  }

  const textX = logoDataUrl ? M + 14 : M;
  pdf.setTextColor(30, 41, 59);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(12);
  pdf.text(empresa.toUpperCase(), textX, y + 7);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(7.5);
  pdf.setTextColor(100, 116, 139);
  pdf.text(soReconciliadas ? 'Relatório de Faturas Reconciliadas' : 'Relatório de Faturas', textX, y + 12);

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(7);
  pdf.setTextColor(30, 41, 59);
  pdf.text(`Emitido em ${hoje}`, pW - M, y + 7, { align: 'right' });
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(100, 116, 139);
  pdf.text(`${lista.length} fatura(s)`, pW - M, y + 12, { align: 'right' });

  y += headerH + 2;
  pdf.setDrawColor(226, 232, 240);
  pdf.line(M, y, M + cW, y);
  y += 4;

  pdf.setFillColor(241, 245, 249);
  pdf.rect(M, y, cW, rowH, 'F');
  pdf.setDrawColor(203, 213, 225);
  pdf.line(M, y + rowH, M + cW, y + rowH);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(6.5);
  pdf.setTextColor(100, 116, 139);

  let cx = M;
  for (const [label, w, align] of cols) {
    if (align === 'right') pdf.text(label, cx + w - 2, y + rowH - 2, { align: 'right' });
    else if (align === 'center') pdf.text(label, cx + w / 2, y + rowH - 2, { align: 'center' });
    else pdf.text(label, cx + 2, y + rowH - 2);
    cx += w;
  }
  y += rowH;

  const truncate = (text, maxW) => {
    let t = String(text ?? '—');
    while (t.length > 1 && pdf.getTextWidth(t) > maxW) t = t.slice(0, -1);
    return t.length < String(text ?? '—').length ? t.slice(0, -1) + '…' : t;
  };

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(7.5);

  for (let i = 0; i < lista.length; i++) {
    if (y + rowH > pH - M - 10) { pdf.addPage(); y = M; }
    const d = lista[i].dados || {};
    if (i % 2 === 1) { pdf.setFillColor(248, 250, 252); pdf.rect(M, y, cW, rowH, 'F'); }
    pdf.setDrawColor(226, 232, 240);
    pdf.line(M, y + rowH, M + cW, y + rowH);

    const values = [
      d.numero_fatura, d.fornecedor, d.data_fatura,
      d.valor_total != null ? Number(d.valor_total).toFixed(2) + ' €' : '—',
      d.iva != null ? Number(d.iva).toFixed(2) + ' €' : '—',
      lista[i].status === 'PAGO' ? '✓ Pago' : 'Pendente',
      lista[i].filename,
    ];

    cx = M;
    pdf.setTextColor(30, 41, 59);
    for (let c = 0; c < cols.length; c++) {
      const [, w, align] = cols[c];
      const cell = truncate(values[c], w - 4);
      const ty = y + rowH - 2;
      if (align === 'right') pdf.text(cell, cx + w - 2, ty, { align: 'right' });
      else if (align === 'center') pdf.text(cell, cx + w / 2, ty, { align: 'center' });
      else pdf.text(cell, cx + 2, ty);
      cx += w;
    }
    y += rowH;
  }

  y += 1;
  pdf.setFillColor(79, 70, 229);
  pdf.rect(M, y, cW, rowH + 1, 'F');
  pdf.setTextColor(255, 255, 255);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(8);
  pdf.text('TOTAL', M + 3, y + rowH - 1);

  cx = M;
  for (const [, w] of cols.slice(0, 3)) { cx += w; }
  pdf.text(totalValor.toFixed(2) + ' €', cx + cols[3][1] - 2, y + rowH - 1, { align: 'right' });
  cx += cols[3][1];
  pdf.setTextColor(199, 210, 254);
  pdf.text(totalIva.toFixed(2) + ' €', cx + cols[4][1] - 2, y + rowH - 1, { align: 'right' });

  pdf.save(`${soReconciliadas ? 'reconciliadas' : 'faturas'}_${hoje.replace(/\//g, '-')}.pdf`);
}
