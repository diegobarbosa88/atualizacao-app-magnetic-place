import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { CATEGORIAS } from './formacaoTemplates';
import { getLogoBase64 } from '../cost-reports/costReportsUtils';

const CATEGORIA_LABEL = Object.fromEntries(CATEGORIAS.map(c => [c.id, c.label]));

const NAVY = [27, 58, 87];
const NAVY_DEEP = [18, 39, 65];
const ORANGE = [235, 141, 0];
const SLATE = [134, 154, 175];
const ROW_TINT = [245, 243, 238];

const ESTADO_CONCLUSAO_LABEL = {
  nao_iniciado: 'Não Iniciado',
  em_progresso: 'Em Progresso',
  concluido: 'Concluído',
  reprovado: 'Reprovado',
};

function fmtData(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('pt-PT');
}

export async function exportFormacaoPDF(formacao) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const logoBase64 = await getLogoBase64();

  // Cabeçalho — faixa navy com filete laranja, paleta de marca Magnetic Place.
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, 210, 30, 'F');
  doc.setFillColor(...ORANGE);
  doc.rect(0, 30, 210, 1.5, 'F');

  if (logoBase64) doc.addImage(logoBase64, 'PNG', 14, 4, 22, 22);
  const textX = logoBase64 ? 42 : 14;

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('MAGNETIC PLACE', textX, 13);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('REGISTO DE FORMAÇÃO INTERNA — Art. 131.º CT', textX, 20);
  doc.setTextColor(0, 0, 0);

  let y = 40;
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...NAVY_DEEP);
  doc.text(formacao.tipo_formacao || formacao.titulo, 14, y);
  doc.setTextColor(0, 0, 0);
  y += 3;
  doc.setDrawColor(...ORANGE);
  doc.setLineWidth(0.6);
  doc.line(14, y, 196, y);
  y += 6;

  const isElearning = formacao.formato === 'e-learning';

  autoTable(doc, {
    startY: y,
    theme: 'plain',
    styles: { fontSize: 9, cellPadding: 1.8 },
    columnStyles: { 0: { fontStyle: 'bold', textColor: NAVY, cellWidth: 45 } },
    alternateRowStyles: { fillColor: ROW_TINT },
    body: [
      ['Categoria', CATEGORIA_LABEL[formacao.categoria] || formacao.categoria || '—'],
      ['Formato', isElearning ? 'E-learning' : 'Presencial'],
      ['Período', `${fmtData(formacao.data_inicio)} a ${fmtData(formacao.data_fim)}`],
      ['Duração', `${formacao.duracao_horas}h`],
      ['Local', formacao.local || '—'],
      ['Formador', formacao.formador?.name || '—'],
      ['Entidade Externa', formacao.entidade_externa || '—'],
      ['Objetivos', formacao.objetivos || formacao.conteudo_estruturado?.objetivo || '—'],
      ['Conteúdo Programático', formacao.conteudo_programatico || '—'],
      ['Justificativa de Afinidade', formacao.justificativa_afinidade || '—'],
      ['Método de Avaliação', formacao.metodo_avaliacao || '—'],
      ['Resultado da Avaliação', formacao.resultado_avaliacao || '—'],
      ...(isElearning ? [['Nota Mínima', `${formacao.nota_minima_aprovacao}%`]] : []),
    ],
  });
  y = doc.lastAutoTable.finalY + 8;

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...NAVY_DEEP);
  doc.text('PARTICIPANTES', 14, y);
  doc.setTextColor(0, 0, 0);
  y += 2;

  autoTable(doc, {
    startY: y,
    head: isElearning
      ? [['Trabalhador', 'Estado', 'Nota', 'Assinado em']]
      : [['Trabalhador', 'Validade', 'Assinado em']],
    body: (formacao.formacao_participantes || []).map(p => isElearning
      ? [
        p.workers?.name || p.worker_id,
        ESTADO_CONCLUSAO_LABEL[p.estado_conclusao] || '—',
        p.nota_obtida != null ? `${p.nota_obtida}%` : '—',
        p.assinado_em ? fmtData(p.assinado_em) : 'Por assinar',
      ]
      : [
        p.workers?.name || p.worker_id,
        p.data_validade ? fmtData(p.data_validade) : '—',
        p.assinado_em ? fmtData(p.assinado_em) : 'Por assinar',
      ]),
    styles: { fontSize: 9 },
    headStyles: { fillColor: NAVY, textColor: 255 },
    alternateRowStyles: { fillColor: ROW_TINT },
  });

  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(...SLATE);
    doc.text('MAGNETIC PLACE UNIPESSOAL, LDA', 14, 290);
    doc.text(`Página ${i}/${pageCount}`, 196, 290, { align: 'right' });
    doc.setTextColor(0, 0, 0);
  }

  doc.save(`formacao-${formacao.id}.pdf`);
}

// Registo individual — um trabalhador, todas as formações internas de um
// ano, para comprovar o cumprimento do art. 131.º CT perante clientes.
export async function exportRegistoIndividualPDF(worker, ano, formacoesDoTrabalhador, resumo) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const logoBase64 = await getLogoBase64();

  doc.setFillColor(...NAVY);
  doc.rect(0, 0, 210, 30, 'F');
  doc.setFillColor(...ORANGE);
  doc.rect(0, 30, 210, 1.5, 'F');

  if (logoBase64) doc.addImage(logoBase64, 'PNG', 14, 4, 22, 22);
  const textX = logoBase64 ? 42 : 14;

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('MAGNETIC PLACE', textX, 13);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('REGISTO DE FORMAÇÃO INTERNA — Art. 131.º CT — Registo Individual', textX, 20);
  doc.setTextColor(0, 0, 0);

  let y = 40;
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...NAVY_DEEP);
  doc.text(worker.name, 14, y);
  doc.setTextColor(0, 0, 0);
  y += 3;
  doc.setDrawColor(...ORANGE);
  doc.setLineWidth(0.6);
  doc.line(14, y, 196, y);
  y += 6;

  autoTable(doc, {
    startY: y,
    theme: 'plain',
    styles: { fontSize: 9, cellPadding: 1.8 },
    columnStyles: { 0: { fontStyle: 'bold', textColor: NAVY, cellWidth: 45 } },
    alternateRowStyles: { fillColor: ROW_TINT },
    body: [
      ['NIF', worker.nif || '—'],
      ['Função', worker.profissao || '—'],
      ['Data de Admissão', fmtData(worker.dataInicio)],
      ...(worker.dataFim ? [['Data de Cessação', fmtData(worker.dataFim)]] : []),
      ['Ano de Referência', String(ano)],
    ],
  });
  y = doc.lastAutoTable.finalY + 8;

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...NAVY_DEEP);
  doc.text('CUMPRIMENTO DO ART. 131.º CT', 14, y);
  doc.setTextColor(0, 0, 0);
  y += 2;

  const situacaoLabel = resumo.anoEmCurso ? 'Em curso' : resumo.cumprido ? 'Cumprido' : 'Por cumprir';
  autoTable(doc, {
    startY: y,
    theme: 'plain',
    styles: { fontSize: 9, cellPadding: 1.8 },
    columnStyles: { 0: { fontStyle: 'bold', textColor: NAVY, cellWidth: 70 } },
    alternateRowStyles: { fillColor: ROW_TINT },
    body: [
      ['Horas mínimas exigidas (proporcional)', `${resumo.horasMinimas.toFixed(1)}h`],
      ['Horas de formação realizadas', `${resumo.horasRealizadas.toFixed(1)}h`],
      ['Situação', situacaoLabel],
    ],
  });
  y = doc.lastAutoTable.finalY + 8;

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...NAVY_DEEP);
  doc.text('FORMAÇÕES REALIZADAS NO PERÍODO', 14, y);
  doc.setTextColor(0, 0, 0);
  y += 2;

  autoTable(doc, {
    startY: y,
    head: [['Data', 'Formação', 'Categoria', 'Formato', 'Duração', 'Assinado']],
    body: formacoesDoTrabalhador.map(({ formacao: f, participacao: p }) => [
      fmtData(f.data_inicio),
      f.tipo_formacao || f.titulo,
      CATEGORIA_LABEL[f.categoria] || f.categoria || '—',
      f.formato === 'e-learning' ? 'E-learning' : 'Presencial',
      `${f.duracao_horas}h`,
      p.assinado_em ? fmtData(p.assinado_em) : 'Por assinar',
    ]),
    styles: { fontSize: 8.5 },
    headStyles: { fillColor: NAVY, textColor: 255 },
    alternateRowStyles: { fillColor: ROW_TINT },
  });
  y = doc.lastAutoTable.finalY + 16;

  if (y > 250) { doc.addPage(); y = 20; }
  doc.setFontSize(8.5);
  doc.setTextColor(...SLATE);
  doc.text(
    'Nos termos do art. 131.º do Código do Trabalho, o trabalhador tem direito a um mínimo de 40 horas de formação\ncontínua por ano, proporcional ao tempo de vínculo no ano e ao regime de trabalho. Este documento serve de\ncomprovativo de cumprimento da obrigação formativa, gerado em ' + fmtData(new Date()) + '.',
    14, y
  );
  doc.setTextColor(0, 0, 0);
  y += 18;

  doc.setDrawColor(...SLATE);
  doc.setLineWidth(0.3);
  doc.line(14, y, 90, y);
  doc.line(120, y, 196, y);
  doc.setFontSize(8);
  doc.setTextColor(...NAVY_DEEP);
  doc.text('Assinatura do Trabalhador', 14, y + 5);
  doc.text('Assinatura do Responsável — Magnetic Place', 120, y + 5);
  doc.setTextColor(0, 0, 0);

  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(...SLATE);
    doc.text('MAGNETIC PLACE UNIPESSOAL, LDA', 14, 290);
    doc.text(`Página ${i}/${pageCount}`, 196, 290, { align: 'right' });
    doc.setTextColor(0, 0, 0);
  }

  doc.save(`registo-formacao-${worker.name.replace(/\s+/g, '_')}-${ano}.pdf`);
}
