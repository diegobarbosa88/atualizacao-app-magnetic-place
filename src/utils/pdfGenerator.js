import pdfMake from 'pdfmake/build/pdfmake';
import pdfFonts from 'pdfmake/build/vfs_fonts';
const _vfs = pdfFonts?.pdfMake?.vfs || pdfFonts?.vfs || pdfFonts;
if (typeof pdfMake.addVirtualFileSystem === 'function') {
  pdfMake.addVirtualFileSystem(_vfs);
} else {
  pdfMake.vfs = _vfs;
}
import { replaceTemplateFields } from './templateFields';

const MM_TO_PT = 2.8346;
const MARGIN_H = Math.round(50 * MM_TO_PT);
const MARGIN_V = Math.round(60 * MM_TO_PT);

export function blocksToPdfMake(blocks, workerData = {}, signatureData = null) {
  const sortedBlocks = [...(blocks || [])].sort((a, b) => (a.order || 0) - (b.order || 0));

  const content = sortedBlocks.map(block => {
    switch (block.type) {
      case 'title':
        return { text: block.content || '', style: 'title', margin: [0, 0, 0, 20] };
      case 'subtitle':
        return { text: block.content || '', style: 'subtitle', margin: [0, 15, 0, 8] };
      case 'paragraph': {
        let text = block.content || '';
        if (workerData && Object.keys(workerData).length > 0) {
          text = replaceTemplateFields(text, workerData, {});
        }
        return { text, style: 'paragraph', margin: [0, 0, 0, 12] };
      }
      case 'signature': {
        const stack = [
          { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 150, y2: 0, lineWidth: 1 }] },
          { text: 'Assinatura', style: 'signatureLabel', alignment: 'right' }
        ];
        if (signatureData) {
          stack.push({ image: signatureData, width: 150, alignment: 'right', margin: [0, 5, 0, 0] });
        }
        return { unbreakable: true, stack, margin: [0, 40, 0, 0] };
      }
      default:
        return null;
    }
  }).filter(Boolean);

  return {
    content,
    styles: {
      defaultStyle: { fontSize: 12, lineHeight: 1.4, font: 'Helvetica' },
      title: { fontSize: 24, bold: true, margin: [0, 0, 0, 10] },
      subtitle: { fontSize: 16, bold: true, margin: [0, 5, 0, 5] },
      paragraph: { fontSize: 12, lineHeight: 1.7, margin: [0, 0, 0, 8] },
      signatureLabel: { fontSize: 10, bold: true, margin: [0, 5, 0, 0] },
      footer: { fontSize: 10, alignment: 'center', margin: [0, 10, 0, 0] }
    },
    pageMargins: [MARGIN_H, MARGIN_V, MARGIN_H, MARGIN_V],
    footer(currentPage, pageCount) {
      return {
        text: `Página ${currentPage} de ${pageCount}`,
        style: 'footer',
        margin: [MARGIN_H, 20, MARGIN_H, 0],
        alignment: 'center'
      };
    },
    pageSize: 'A4'
  };
}

export function mapBlocksToDocDefinition(blocks, options = {}) {
  const { workerData = {}, signatureData = null } = options;

  const sortedBlocks = [...(blocks || [])].sort((a, b) => (a.order || 0) - (b.order || 0));

  const content = sortedBlocks.map(block => {
    switch (block.type) {
      case 'title':
        return { text: block.content || '', style: 'title', margin: [0, 0, 0, 20] };
      case 'subtitle':
        return { text: block.content || '', style: 'subtitle', margin: [0, 15, 0, 8] };
      case 'paragraph': {
        let text = block.content || '';
        if (workerData && Object.keys(workerData).length > 0) {
          text = replaceTemplateFields(text, workerData, {});
        }
        return { text, style: 'paragraph', margin: [0, 0, 0, 12] };
      }
      case 'signature': {
        const stack = [
          { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 150, y2: 0, lineWidth: 1 }] },
          { text: 'Assinatura', style: 'signatureLabel', alignment: 'right' }
        ];
        if (signatureData) {
          stack.push({ image: signatureData, width: 150, alignment: 'right', margin: [0, 5, 0, 0] });
        }
        return { unbreakable: true, stack, margin: [0, 40, 0, 0] };
      }
      default:
        return null;
    }
  }).filter(Boolean);

  return {
    content,
    styles: {
      defaultStyle: { fontSize: 12, lineHeight: 1.4, font: 'Helvetica' },
      title: { fontSize: 24, bold: true, margin: [0, 0, 0, 10] },
      subtitle: { fontSize: 16, bold: true, margin: [0, 5, 0, 5] },
      paragraph: { fontSize: 12, lineHeight: 1.7, margin: [0, 0, 0, 8] },
      signatureLabel: { fontSize: 10, bold: true, margin: [0, 5, 0, 0] },
      footer: { fontSize: 10, alignment: 'center', margin: [0, 10, 0, 0] }
    },
    pageMargins: [MARGIN_H, MARGIN_V, MARGIN_H, MARGIN_V],
    footer(currentPage, pageCount) {
      return {
        text: `Página ${currentPage} de ${pageCount}`,
        style: 'footer',
        margin: [MARGIN_H, 20, MARGIN_H, 0],
        alignment: 'center'
      };
    },
    pageSize: 'A4'
  };
}

export function generatePdf(document, options = {}) {
  const blocks = document.blocks || [];
  const workerData = document.workerData || {};
  const signatureData = options.signatureData || document.signature_data || null;

  const docDefinition = blocksToPdfMake(blocks, workerData, signatureData);

  try {
    const pdfDoc = pdfMake.createPdf(docDefinition);
    return pdfDoc.getBlob();
  } catch (err) {
    return Promise.reject(err);
  }
}

export function downloadPdf(document, options = {}, filename = 'document.pdf') {
  const blocks = document.blocks || [];
  const workerData = document.workerData || {};
  const signatureData = options.signatureData || document.signature_data || null;

  const docDefinition = blocksToPdfMake(blocks, workerData, signatureData);
  pdfMake.createPdf(docDefinition).download(filename);
}

export function downloadPdfFromBlocks(blocks, workerData = {}, signatureData = null, filename = 'document.pdf') {
  const docDefinition = blocksToPdfMake(blocks, workerData, signatureData);
  pdfMake.createPdf(docDefinition).download(filename);
}

export async function generatePdfBlob(document, options = {}) {
  return generatePdf(document, options);
}
