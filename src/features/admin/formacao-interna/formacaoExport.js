import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { CATEGORIAS } from './formacaoTemplates';

const CATEGORIA_LABEL = Object.fromEntries(CATEGORIAS.map(c => [c.id, c.label]));

function fmtData(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('pt-PT');
}

export function exportFormacaoPDF(formacao) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  doc.setFillColor(27, 58, 87);
  doc.rect(0, 0, 210, 28, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('MAGNETIC PLACE', 14, 12);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('REGISTO DE FORMAÇÃO INTERNA — Art. 131.º CT', 14, 19);
  doc.setTextColor(0, 0, 0);

  let y = 36;
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(formacao.tipo_formacao || formacao.titulo, 14, y);
  y += 8;

  autoTable(doc, {
    startY: y,
    theme: 'plain',
    styles: { fontSize: 9, cellPadding: 1.5 },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 45 } },
    body: [
      ['Categoria', CATEGORIA_LABEL[formacao.categoria] || formacao.categoria || '—'],
      ['Período', `${fmtData(formacao.data_inicio)} a ${fmtData(formacao.data_fim)}`],
      ['Duração', `${formacao.duracao_horas}h`],
      ['Local', formacao.local || '—'],
      ['Formador', formacao.formador?.name || '—'],
      ['Entidade Externa', formacao.entidade_externa || '—'],
      ['Objetivos', formacao.objetivos || '—'],
      ['Conteúdo Programático', formacao.conteudo_programatico || '—'],
      ['Justificativa de Afinidade', formacao.justificativa_afinidade || '—'],
      ['Método de Avaliação', formacao.metodo_avaliacao || '—'],
      ['Resultado da Avaliação', formacao.resultado_avaliacao || '—'],
    ],
  });
  y = doc.lastAutoTable.finalY + 8;

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('PARTICIPANTES', 14, y);
  y += 2;

  autoTable(doc, {
    startY: y,
    head: [['Trabalhador', 'Validade', 'Assinado em']],
    body: (formacao.formacao_participantes || []).map(p => [
      p.workers?.name || p.worker_id,
      p.data_validade ? fmtData(p.data_validade) : '—',
      p.assinado_em ? fmtData(p.assinado_em) : 'Por assinar',
    ]),
    styles: { fontSize: 9 },
    headStyles: { fillColor: [27, 58, 87] },
  });

  doc.save(`formacao-${formacao.id}.pdf`);
}
