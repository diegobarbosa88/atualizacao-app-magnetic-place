import { useState } from 'react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { txKey, clienteLink, fmtEur, fmtMes, labelStatus, STATUS_KEYS, statusTx } from './txUtils';

const ROW_COLORS = {
  'Com Cliente':   [227, 252, 239],
  'Com Recibo':    [207, 250, 254],
  'Com Fatura':   [254, 235, 222],
  'Nota Crédito': [219, 234, 254],
  'Interno':       [233, 213, 244],
  'Imposto':      [254, 243, 199],
  'Justificado':  [238, 238, 238],
  'Sem Cliente':   [255, 255, 255],
};

export function useMovExport({
  supabase, filteredTxs, allTxs, grupos, clients,
  pagamentos, justificacoes, internos, notasCredito, reciboLinks, faturaLinks, impostos,
  faturasData, runData,
  setShowExportMenu,
}) {
  const [exportingZip, setExportingZip] = useState(false);
  const [exportProgress, setExportProgress] = useState({ current: 0, total: 0 });

  const getStatus = tx => statusTx(tx, pagamentos, justificacoes, internos, notasCredito, reciboLinks, faturaLinks, impostos);

  const buildRowsForTx = (tx) => {
    const status = getStatus(tx);
    const key = txKey(tx);
    const link = clienteLink(tx, pagamentos);
    const ncEntry = notasCredito.find(n => n.tx_key === key);
    const clientName = link ? (clients?.find(c => c.id === link.client_id)?.name || '') : '';
    const justEntry = justificacoes.find(j => j.tx_key === key);
    const detalhe = status === STATUS_KEYS.COM_CLIENTE ? clientName
      : status === STATUS_KEYS.NOTA_CREDITO ? `${clientName || ncEntry?.client_id || ''} · ${fmtMes(ncEntry?.period || '')}`
      : status === STATUS_KEYS.JUSTIFICADO ? (justEntry?.justification || '')
      : '';
    const valor = tx.tipo === 'debito' ? `-${fmtEur(Math.abs(parseFloat(tx.valor) || 0))}` : fmtEur(tx.valor);
    return {
      status,
      row: [tx.data, tx.tipo === 'debito' ? 'Saída' : 'Entrada', tx.descricao || '', valor, labelStatus(status, tx.tipo, ncEntry, faturasData, tx.descricao), detalhe],
    };
  };

  const buildRows = () => filteredTxs.map(tx => buildRowsForTx(tx).row);

  const calcTotals = (txs) => {
    const totCredito = txs.filter(t => t.tipo === 'credito').reduce((s, t) => s + parseFloat(t.valor || 0), 0);
    const totDebito = txs.filter(t => t.tipo === 'debito').reduce((s, t) => s + parseFloat(t.valor || 0), 0);
    const totImposto = txs.filter(t => impostos?.some(i => i.tx_key === txKey(t))).reduce((s, t) => s + parseFloat(t.valor || 0), 0);
    const totInterno = txs.filter(t => internos?.some(i => i.tx_key === txKey(t))).reduce((s, t) => s + parseFloat(t.valor || 0), 0);
    const totFatura = txs.filter(t => faturaLinks?.some(f => f.tx_key === txKey(t))).reduce((s, t) => s + parseFloat(t.valor || 0), 0);
    const totRecibo = txs.filter(t => reciboLinks?.some(r => r.tx_key === txKey(t)) && !faturaLinks?.some(f => f.tx_key === txKey(t))).reduce((s, t) => s + parseFloat(t.valor || 0), 0);
    const totCliente = txs.filter(t => clienteLink(t, pagamentos)).reduce((s, t) => s + parseFloat(t.valor || 0), 0);
    const totNotaCredito = txs.filter(t => notasCredito?.some(n => n.tx_key === txKey(t))).reduce((s, t) => s + parseFloat(t.valor || 0), 0);
    const totJustificado = txs.filter(t => justificacoes?.some(j => j.tx_key === txKey(t))).reduce((s, t) => s + parseFloat(t.valor || 0), 0);
    const totSemCliente = txs.filter(t => {
      const k = txKey(t);
      return !impostos?.some(i => i.tx_key === k)
        && !internos?.some(i => i.tx_key === k)
        && !faturaLinks?.some(f => f.tx_key === k)
        && !reciboLinks?.some(r => r.tx_key === k)
        && !clienteLink(t, pagamentos)
        && !notasCredito?.some(n => n.tx_key === k)
        && !justificacoes?.some(j => j.tx_key === k);
    }).reduce((s, t) => s + parseFloat(t.valor || 0), 0);
    return { totCredito, totDebito, totImposto, totInterno, totFatura, totRecibo, totCliente, totNotaCredito, totSemCliente, totJustificado };
  };

  const renderPdfSummary = (doc, y, txs) => {
    const t = calcTotals(txs);
    const linha = (label, valor, r, g, b) => {
      doc.setFillColor(r, g, b);
      doc.rect(14, y, 277, 7, 'F');
      doc.setFontSize(9); doc.setTextColor(30);
      doc.text(label, 16, y + 5);
      doc.setTextColor(0);
      doc.text(fmtEur(valor), 291, y + 5, { align: 'right' });
      y += 8;
    };
    doc.setFontSize(11); doc.setTextColor(30); doc.setFont('helvetica', 'bold');
    doc.text('Resumo', 14, y); y += 6;
    doc.setFont('helvetica', 'normal');
    linha('Total Créditos', t.totCredito, 227, 252, 239);
    linha('Total Débitos', t.totDebito, 254, 235, 222);
    linha(`Com Cliente (${txs.filter(tx => clienteLink(tx, pagamentos)).length} transações)`, t.totCliente, 227, 252, 239);
    linha(`Nota Crédito (${txs.filter(tx => notasCredito?.some(n => n.tx_key === txKey(tx))).length} transações)`, t.totNotaCredito, 219, 234, 254);
    linha(`Com Fatura (${txs.filter(tx => faturaLinks?.some(f => f.tx_key === txKey(tx))).length} transações)`, t.totFatura, 254, 235, 222);
    linha(`Com Recibo (${txs.filter(tx => reciboLinks?.some(r => r.tx_key === txKey(tx))).length} transações)`, t.totRecibo, 207, 250, 254);
    linha(`Imposto (${txs.filter(tx => impostos?.some(i => i.tx_key === txKey(tx))).length} transações)`, t.totImposto, 254, 243, 199);
    linha(`Justificado (${txs.filter(tx => justificacoes?.some(j => j.tx_key === txKey(tx))).length} transações)`, t.totJustificado, 238, 238, 238);
    linha(`Sem Cliente (${txs.filter(tx => { const k = txKey(tx); return !impostos?.some(i => i.tx_key === k) && !internos?.some(i => i.tx_key === k) && !faturaLinks?.some(f => f.tx_key === k) && !reciboLinks?.some(r => r.tx_key === k) && !clienteLink(tx, pagamentos) && !notasCredito?.some(n => n.tx_key === k) && !justificacoes?.some(j => j.tx_key === k); }).length} transações)`, t.totSemCliente, 255, 255, 255);
    return y;
  };

  const renderPdfBalance = (doc, y, gruposMap) => {
    doc.setFontSize(11); doc.setTextColor(30); doc.setFont('helvetica', 'bold');
    doc.text('Balanço Mensal', 14, y); y += 6;
    doc.setFont('helvetica', 'normal');
    const sortedMeses = Object.keys(gruposMap).sort((a, b) => b.localeCompare(a));
    let acumulado = 0;
    for (const mes of sortedMeses) {
      const mesCred = gruposMap[mes].filter(t => t.tipo === 'credito').reduce((s, t) => s + parseFloat(t.valor || 0), 0);
      const mesDeb = gruposMap[mes].filter(t => t.tipo === 'debito').reduce((s, t) => s + parseFloat(t.valor || 0), 0);
      const saldoMes = mesCred - mesDeb;
      acumulado += saldoMes;
      const cor = saldoMes >= 0 ? [227, 252, 239] : [254, 235, 222];
      doc.setFillColor(...cor);
      doc.rect(14, y, 277, 7, 'F');
      doc.setFontSize(9); doc.setTextColor(30);
      doc.text(fmtMes(mes), 16, y + 5);
      doc.setTextColor(saldoMes >= 0 ? 0 : 180);
      doc.text(`+${fmtEur(mesCred)} | -${fmtEur(mesDeb)} | Saldo: ${saldoMes >= 0 ? '+' : ''}${fmtEur(saldoMes)} | Acum: ${acumulado >= 0 ? '+' : ''}${fmtEur(acumulado)}`, 291, y + 5, { align: 'right' });
      y += 8;
    }
    return y;
  };

  const getLogoBase64 = async () => {
    try {
      const response = await fetch('/MAGNETIC (3).png');
      const blob = await response.blob();
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.readAsDataURL(blob);
      });
    } catch { return null; }
  };

  const handleExportCsv = () => {
    const esc = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const header = ['Data', 'Tipo', 'Descrição', 'Valor (€)', 'Status', 'Detalhe'].map(esc).join(';');
    const rows = buildRows().map(r => r.map(esc).join(';'));
    const blob = new Blob(['﻿' + [header, ...rows].join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'movimentacoes_validacao.csv'; a.click();
    URL.revokeObjectURL(url);
    setShowExportMenu(false);
  };

  const handleExportPdf = async () => {
    const logoBase64 = await getLogoBase64();
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    if (logoBase64) doc.addImage(logoBase64, 'PNG', 14, 4, 22, 22);
    doc.setFontSize(14); doc.setTextColor(30);
    doc.text('Relatório de Movimentações', logoBase64 ? 42 : 14, 18);
    doc.setFontSize(8); doc.setTextColor(120);
    doc.text(`Gerado em ${new Date().toLocaleDateString('pt-PT')} · Extrato: ${runData?.created_at ? new Date(runData.created_at).toLocaleDateString('pt-PT') : '—'}`, logoBase64 ? 42 : 14, 24);

    let currentY = logoBase64 ? 30 : 28;
    const sortedMeses = Object.keys(grupos).sort((a, b) => b.localeCompare(a));

    for (const mes of sortedMeses) {
      const mesTxs = grupos[mes];
      doc.setFontSize(11); doc.setTextColor(30);
      doc.setFillColor(240, 242, 245);
      doc.rect(14, currentY, 277, 7, 'F');
      doc.text(fmtMes(mes), 16, currentY + 5);
      currentY += 10;

      const mesData = mesTxs.map(tx => buildRowsForTx(tx));
      autoTable(doc, {
        startY: currentY,
        head: [['Data', 'Tipo', 'Descrição', 'Valor (€)', 'Status', 'Detalhe']],
        body: mesData.map(d => d.row),
        styles: { fontSize: 6.5, cellPadding: 1.5, lineHeight: 1.2 },
        headStyles: { fillColor: [99, 102, 241], textColor: 255, fontStyle: 'bold' },
        didParseCell: (data) => {
          if (data.section === 'body') {
            const status = mesData[data.row.index]?.status;
            if (status && ROW_COLORS[status]) {
              const [r, g, b] = ROW_COLORS[status];
              data.cell.styles.fillColor = [r, g, b];
            }
          }
        },
        columnStyles: {
          0: { cellWidth: 22 }, 1: { cellWidth: 16 },
          2: { cellWidth: 60, cellStyles: { overflow: 'linebreak' } },
          3: { cellWidth: 22 }, 4: { cellWidth: 28 }, 5: { cellWidth: 50 },
        },
        margin: { left: 14, right: 14 },
        showHead: 'firstPage',
      });

      currentY = doc.lastAutoTable.finalY + 6;
      if (currentY > 180) { doc.addPage(); currentY = 20; }
    }

    doc.addPage();
    doc.setFontSize(16); doc.setTextColor(30);
    doc.text('Resumo Financeiro', 14, 20);
    renderPdfSummary(doc, 28, filteredTxs);
    doc.addPage();
    doc.setFontSize(16); doc.setTextColor(30);
    doc.text('Balanço Mensal', 14, 20);
    renderPdfBalance(doc, 28, grupos);
    doc.save('movimentacoes_validacao.pdf');
    setShowExportMenu(false);
  };

  const handleExportZip = async () => {
    setExportingZip(true);
    setExportProgress({ current: 0, total: 0 });
    setShowExportMenu(false);
    try {
      const JSZipLib = (await import('jszip')).default;
      const { jsPDF: jsPDFLazy } = await import('jspdf');
      const autoTableLazy = (await import('jspdf-autotable')).default;
      const logoBase64 = await getLogoBase64();

      const monthLabel = runData
        ? new Date(runData.created_at).toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' })
        : 'todos';
      const safeMonth = monthLabel.replace(/[^a-zA-Z0-9]/g, '');

      const zip = new JSZipLib();
      const relatorioFolder = zip.folder('relatorio');
      const extratoFolder = zip.folder('extrato');
      const faturasFolder = zip.folder('faturas');
      const mesesFolder = zip.folder('meses');

      const doc = new jsPDFLazy({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      doc.setFontSize(14); doc.setTextColor(30);
      doc.text('Relatório de Movimentações', 14, 18);
      doc.setFontSize(8); doc.setTextColor(120);
      doc.text(`Gerado em ${new Date().toLocaleDateString('pt-PT')} · Extrato: ${runData?.created_at ? new Date(runData.created_at).toLocaleDateString('pt-PT') : 'Todos'}`, 14, 24);
      autoTableLazy(doc, {
        startY: 30,
        head: [['Data', 'Tipo', 'Descrição', 'Valor (€)', 'Status', 'Detalhe']],
        body: buildRows(),
        styles: { fontSize: 6.5, cellPadding: 1.3 },
        headStyles: { fillColor: [99, 102, 241], textColor: 255, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        columnStyles: { 2: { cellWidth: 55 }, 5: { cellWidth: 45 } },
      });
      relatorioFolder.file('Relatorio_Movimentacoes.pdf', doc.output('blob'));

      const sortedMeses = Object.keys(grupos).sort((a, b) => b.localeCompare(a));
      for (const mes of sortedMeses) {
        const mesTxs = grupos[mes];
        const mesLabel = fmtMes(mes).replace(/[^a-zA-Z0-9]/g, '_');
        const docMes = new jsPDFLazy({ orientation: 'landscape', unit: 'mm', format: 'a4' });
        if (logoBase64) docMes.addImage(logoBase64, 'PNG', 14, 4, 22, 22);
        docMes.setFontSize(14); docMes.setTextColor(30);
        docMes.text(`Relatório de Movimentações — ${fmtMes(mes)}`, logoBase64 ? 42 : 14, 18);
        docMes.setFontSize(8); docMes.setTextColor(120);
        docMes.text(`Gerado em ${new Date().toLocaleDateString('pt-PT')} · Extrato: ${runData?.created_at ? new Date(runData.created_at).toLocaleDateString('pt-PT') : 'Todos'}`, logoBase64 ? 42 : 14, 24);
        const mesData = mesTxs.map(tx => buildRowsForTx(tx));
        autoTableLazy(docMes, {
          startY: logoBase64 ? 30 : 28,
          head: [['Data', 'Tipo', 'Descrição', 'Valor (€)', 'Status', 'Detalhe']],
          body: mesData.map(d => d.row),
          styles: { fontSize: 6.5, cellPadding: 1.5, lineHeight: 1.2 },
          headStyles: { fillColor: [99, 102, 241], textColor: 255, fontStyle: 'bold' },
          didParseCell: (data) => {
            if (data.section === 'body') {
              const status = mesData[data.row.index]?.status;
              if (status && ROW_COLORS[status]) {
                const [r, g, b] = ROW_COLORS[status];
                data.cell.styles.fillColor = [r, g, b];
              }
            }
          },
          columnStyles: {
            0: { cellWidth: 22 }, 1: { cellWidth: 16 },
            2: { cellWidth: 60, cellStyles: { overflow: 'linebreak' } },
            3: { cellWidth: 22 }, 4: { cellWidth: 28 }, 5: { cellWidth: 50 },
          },
          margin: { left: 14, right: 14 },
          showHead: 'firstPage',
        });
        docMes.addPage();
        docMes.setFontSize(16); docMes.setTextColor(30);
        docMes.text(`Resumo — ${fmtMes(mes)}`, 14, 20);
        renderPdfSummary(docMes, 28, mesTxs);
        mesesFolder.file(`Relatorio_${mesLabel}.pdf`, docMes.output('blob'));
      }

      const csvLines = ['Data,Tipo,Descrição,Valor (€),Status'];
      for (const tx of allTxs) {
        const status = getStatus(tx);
        csvLines.push(`"${tx.data}","${tx.tipo}","${(tx.descricao || '').replace(/"/g, '""')}","${tx.valor}","${status}"`);
      }
      extratoFolder.file('extrato_bancario.csv', new Blob([csvLines.join('\n')], { type: 'text/csv;charset=utf-8;' }));

      const docExtrato = new jsPDFLazy({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      docExtrato.setFontSize(16); docExtrato.setTextColor(30);
      docExtrato.text('Extrato Bancário', 14, 18);
      docExtrato.setFontSize(9); docExtrato.setTextColor(120);
      const monthLabelFull = runData ? new Date(runData.created_at).toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' }) : 'todos';
      docExtrato.text(`Ficheiro: ${runData?.filename || 'N/A'}  ·  Período: ${monthLabelFull}  ·  ${allTxs.length} movimentos`, 14, 25);
      autoTableLazy(docExtrato, {
        startY: 30,
        head: [['Data', 'Tipo', 'Descrição', 'Valor (€)']],
        body: allTxs.map(tx => [tx.data, tx.tipo === 'credito' ? 'Crédito' : 'Débito', tx.descricao || '', `${tx.tipo === 'credito' ? '+' : '-'}${tx.valor}`]),
        styles: { fontSize: 7, cellPadding: 1.5 },
        headStyles: { fillColor: [30, 60, 100], textColor: 255, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [245, 247, 250] },
        columnStyles: { 0: { cellWidth: 25 }, 1: { cellWidth: 20 }, 2: { cellWidth: 180 }, 3: { cellWidth: 30 } },
      });
      extratoFolder.file('extrato_bancario.pdf', docExtrato.output('blob'));

      const linkedFatIds = [...new Set(faturaLinks.map(l => l.fatura_id).filter(Boolean))];
      const faturasNoZip = faturasData.filter(f => linkedFatIds.includes(f.id) && f.storage_path);
      if (faturasNoZip.length > 0) {
        for (let i = 0; i < faturasNoZip.length; i++) {
          const fat = faturasNoZip[i];
          setExportProgress({ current: i + 1, total: faturasNoZip.length });
          const fornecedor = (fat.dados?.fornecedor || 'SEM_FORNECEDOR').replace(/[^a-zA-Z0-9]/g, '_');
          const numero = (fat.dados?.numero_fatura || fat.id).replace(/[^a-zA-Z0-9]/g, '_');
          try {
            const { data: pdfBlob, error } = await supabase.storage.from('faturas').download(fat.storage_path);
            if (!error && pdfBlob) faturasFolder.file(`FAT_${fornecedor}_${numero}.pdf`, pdfBlob);
          } catch (e) {
            console.warn(`Erro ao baixar fatura ${fat.id}:`, e.message);
          }
        }
      }

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `movimentacoes_Extrato_${safeMonth}.zip`;
      document.body.appendChild(a);
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Erro ao gerar ZIP:', err);
      alert('Ocorreu um erro ao gerar o ZIP. Tente novamente.');
    } finally {
      setExportingZip(false);
      setExportProgress({ current: 0, total: 0 });
    }
  };

  return { exportingZip, exportProgress, handleExportCsv, handleExportPdf, handleExportZip };
}
