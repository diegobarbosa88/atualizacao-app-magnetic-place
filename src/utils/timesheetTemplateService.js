import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  WidthType, ShadingType, convertInchesToTwip
} from 'docx';

function parseHtmlToDocx(html) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const elements = [];

  function processNode(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent || '';
      if (text.trim()) return [new TextRun({ text, size: 16 })];
      return [];
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return [];
    const tag = node.tagName.toLowerCase();

    switch (tag) {
      case 'h1': case 'h2': case 'h3': case 'h4':
        return [new Paragraph({ children: [new TextRun({ text: node.textContent.trim(), bold: true, size: tag === 'h1' ? 32 : tag === 'h2' ? 28 : tag === 'h3' ? 24 : 22 })] })];
      case 'p':
        if (!node.textContent.trim()) return [new Paragraph({})];
        return [new Paragraph({ children: [new TextRun({ text: node.textContent.trim(), size: 16 })] })];
      case 'br':
        return [new Paragraph({})];
      case 'table': {
        const thead = node.querySelector('thead');
        const tbody = node.querySelector('tbody') || node;
        const dataRows = tbody.rows ? Array.from(tbody.rows) : [];
        if (dataRows.length === 0) return [];

        if (thead) {
          const firstRow = thead.querySelector('tr');
          const firstCellText = (firstRow?.cells?.[0]?.textContent || '').trim();
          const hasWeekHeader = /semana/i.test(firstCellText);
          if (hasWeekHeader) {
            const tableRows = dataRows.map(tr => {
              const cells = Array.from(tr.cells);
              const tableCells = cells.map(td => new TableCell({
                children: [new Paragraph({ children: [new TextRun({ text: td.textContent.trim(), size: 14 })] })],
                shading: { type: ShadingType.CLEAR, fill: 'FFFFFF' },
                margins: { top: convertInchesToTwip(0.02), bottom: convertInchesToTwip(0.02), left: convertInchesToTwip(0.04), right: convertInchesToTwip(0.04) },
              }));
              return new TableRow({ children: tableCells });
            });
            return [
              new Paragraph({ children: [new TextRun({ text: firstCellText, bold: true, size: 18 })], spacing: { after: 80 } }),
              new Table({ rows: tableRows, width: { size: 100, type: WidthType.PERCENTAGE } }),
            ];
          }
        }

        const tableRows = dataRows.map(tr => {
          const cells = Array.from(tr.cells);
          const tableCells = cells.map(td => new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text: td.textContent.trim(), size: 14 })] })],
            shading: { type: ShadingType.CLEAR, fill: 'FFFFFF' },
            margins: { top: convertInchesToTwip(0.02), bottom: convertInchesToTwip(0.02), left: convertInchesToTwip(0.04), right: convertInchesToTwip(0.04) },
          }));
          return new TableRow({ children: tableCells });
        });
        return [new Table({ rows: tableRows, width: { size: 100, type: WidthType.PERCENTAGE } })];
      }
      case 'div': {
        if (!node.textContent.trim()) {
          const results = [];
          for (const child of node.childNodes) results.push(...processNode(child));
          return results;
        }
        return [new Paragraph({ children: [new TextRun({ text: node.textContent.trim(), size: 16 })] })];
      }
      default:
        return [];
    }
  }

  for (const child of doc.body.childNodes) elements.push(...processNode(child));
  return elements;
}

export async function convertHtmlToDocx(html) {
  const doc = new Document({ sections: [{ properties: {}, children: parseHtmlToDocx(html) }] });
  const blob = await Packer.toBlob(doc);
  return new Uint8Array(await blob.arrayBuffer());
}

export function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}