import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { CATEGORIAS } from './formacaoTemplates';
import { getLogoBase64 } from '../cost-reports/costReportsUtils';

const CATEGORIA_LABEL = Object.fromEntries(CATEGORIAS.map(c => [c.id, c.label]));

const NAVY = [27, 58, 87];
const NAVY_DEEP = [18, 39, 65];
const ORANGE = [235, 141, 0];
const ORANGE_DEEP = [201, 118, 0];
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

function fmtDataHora(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) + 'h';
}

// Código de referência derivado do próprio id do registo de participação na
// base de dados — não é criptográfico, mas dá um número de série concreto e
// consultável (o admin pode confirmar contra o registo real), em vez de uma
// assinatura que é só uma linha em branco por preencher à mão.
function codigoVerificacao(id) {
  if (!id) return '—';
  const limpo = String(id).replace(/-/g, '').toUpperCase();
  const fim = limpo.slice(-8).padStart(8, '0');
  return `${fim.slice(0, 4)}-${fim.slice(4)}`;
}

// Para códigos do lado institucional (não vêm de um id de BD já com aspeto
// de código) — hash curto e determinístico, para nunca parecer texto solto
// meio-legível (ex: fragmentos de "registo"/"cert").
function hashCurto(str) {
  let h = 0;
  for (let i = 0; i < String(str).length; i++) {
    h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  }
  const hex = (h >>> 0).toString(16).toUpperCase().padStart(8, '0');
  return `${hex.slice(0, 4)}-${hex.slice(4)}`;
}

async function imagemParaBase64(url) {
  if (!url) return null;
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const blob = await response.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

// Carimbo oficial da empresa — ficheiro estático em public/, usado ao lado
// da assinatura do responsável para dar ao lado institucional a mesma
// credibilidade visual da assinatura eletrónica do trabalhador. Se o
// ficheiro ainda não existir, os documentos continuam a gerar-se na mesma
// (sem o carimbo).
async function getCarimboBase64() {
  return imagemParaBase64('/carimbo-magnetic-place.png');
}

// Desenha o lado "institucional" da assinatura — carimbo da empresa com a
// assinatura pessoal do responsável (a mesma configurada em
// Definições → Assinatura da Empresa) por cima, nome/cargo, data/hora de
// emissão e um código de verificação do próprio documento — no mesmo
// formato usado para a assinatura do trabalhador, para as duas partes
// terem o mesmo nível de credibilidade.
function desenharBlocoEmpresa(doc, x, y, { carimboBase64, assinaturaBase64, nomeResponsavel, cargoResponsavel, codigo, largura = 76 }) {
  if (carimboBase64) {
    try { doc.addImage(carimboBase64, 'PNG', x, y, 32, 18, undefined, 'FAST'); } catch { /* segue sem carimbo */ }
  }
  // Assinatura pessoal do responsável por cima do carimbo, ligeiramente
  // desviada — como uma rubrica feita mesmo em cima do carimbo em papel.
  if (assinaturaBase64) {
    try { doc.addImage(assinaturaBase64, 'PNG', x + 6, y + 5, 30, 13, undefined, 'FAST'); } catch { /* segue sem assinatura */ }
  }

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...NAVY_DEEP);
  doc.text(nomeResponsavel || 'Magnetic Place Unipessoal, Lda', x, y + 22);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(...SLATE);
  if (nomeResponsavel && cargoResponsavel) {
    doc.text(cargoResponsavel, x, y + 25.5);
    doc.text(`Assinado eletronicamente em ${fmtDataHora(new Date())}`, x, y + 29);
    doc.text(`Código de verificação: ${codigo}`, x, y + 32, { maxWidth: largura });
  } else {
    doc.text(`Assinado eletronicamente em ${fmtDataHora(new Date())}`, x, y + 26);
    doc.text(`Código de verificação: ${codigo}`, x, y + 29, { maxWidth: largura });
  }
  doc.setTextColor(0, 0, 0);
}

function cabecalho(doc, logoBase64, subtitulo) {
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
  doc.text(subtitulo, textX, 20);
  doc.setTextColor(0, 0, 0);
}

function rodape(doc) {
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(...SLATE);
    doc.text('MAGNETIC PLACE UNIPESSOAL, LDA', 14, 290);
    doc.text(`Página ${i}/${pageCount}`, 196, 290, { align: 'right' });
    doc.setTextColor(0, 0, 0);
  }
}

// Desenha um bloco de assinatura eletrónica credível: a imagem real
// recolhida no dispositivo do trabalhador (não uma linha em branco), a
// data/hora exata da recolha, e um código de referência do registo — em vez
// de "Assinado em DD/MM" como texto solto, que qualquer um podia escrever.
async function desenharBlocoAssinatura(doc, x, y, { nome, assinaturaBase64, assinadoEm, participanteId, largura = 85 }) {
  doc.setDrawColor(...SLATE);
  doc.setLineWidth(0.2);
  doc.roundedRect(x, y, largura, 26, 1.5, 1.5);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...NAVY_DEEP);
  doc.text(nome, x + 3, y + 5, { maxWidth: largura - 6 });
  doc.setTextColor(0, 0, 0);

  if (assinaturaBase64) {
    try {
      doc.addImage(assinaturaBase64, 'PNG', x + 3, y + 6.5, largura - 6, 12, undefined, 'FAST');
    } catch {
      // imagem inválida/corrompida — segue sem embutir, o texto abaixo continua fiável
    }
  }

  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...SLATE);
  doc.text(`Assinado eletronicamente em ${fmtDataHora(assinadoEm)}`, x + 3, y + 21.5);
  doc.text(`Código de verificação: ${codigoVerificacao(participanteId)}`, x + 3, y + 24.5);
  doc.setTextColor(0, 0, 0);

  return y + 26;
}

export async function exportFormacaoPDF(formacao) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const logoBase64 = await getLogoBase64();
  cabecalho(doc, logoBase64, 'REGISTO DE FORMAÇÃO INTERNA — Art. 131.º CT');

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

  const participantes = formacao.formacao_participantes || [];

  autoTable(doc, {
    startY: y,
    head: isElearning
      ? [['Trabalhador', 'Estado', 'Nota', 'Assinado em']]
      : [['Trabalhador', 'Validade', 'Assinado em']],
    body: participantes.map(p => isElearning
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
  y = doc.lastAutoTable.finalY + 8;

  // Assinaturas eletrónicas reais (imagem + timestamp + código) — só para
  // quem já assinou. Substitui a antiga linha "Assinado em DD/MM" solta.
  const assinados = participantes.filter(p => p.assinado_em);
  if (assinados.length > 0) {
    if (y > 250) { doc.addPage(); y = 20; }
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...NAVY_DEEP);
    doc.text('ASSINATURAS ELETRÓNICAS', 14, y);
    doc.setTextColor(0, 0, 0);
    y += 4;

    let coluna = 0;
    const largura = 88;
    const ALTURA_BLOCO = 26;
    for (const p of assinados) {
      if (y > 260) { doc.addPage(); y = 20; coluna = 0; }
      const assinaturaBase64 = await imagemParaBase64(p.assinatura_signed_url);
      const x = 14 + coluna * (largura + 6);
      await desenharBlocoAssinatura(doc, x, y, {
        nome: p.workers?.name || p.worker_id,
        assinaturaBase64,
        assinadoEm: p.assinado_em,
        participanteId: p.id,
        largura,
      });
      if (coluna === 1) { y += ALTURA_BLOCO + 4; coluna = 0; } else { coluna = 1; }
    }
    if (coluna === 1) y += ALTURA_BLOCO + 4;
  }

  rodape(doc);
  doc.save(`formacao-${formacao.id}.pdf`);
}

// Registo individual — um trabalhador, todas as formações internas de um
// ano, para comprovar o cumprimento do art. 131.º CT perante clientes.
// `companySignature` (opcional) vem de Definições → Assinatura da Empresa
// ({ responsibleName, responsibleRole, signatureDataUrl }).
export async function exportRegistoIndividualPDF(worker, ano, formacoesDoTrabalhador, resumo, companySignature) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const logoBase64 = await getLogoBase64();
  const carimboBase64 = await getCarimboBase64();
  cabecalho(doc, logoBase64, 'REGISTO DE FORMAÇÃO INTERNA — Art. 131.º CT — Registo Individual');

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
  y = doc.lastAutoTable.finalY + 8;

  // Assinaturas eletrónicas reais de cada formação já assinada — a prova de
  // que cada linha da tabela acima foi mesmo confirmada pelo trabalhador,
  // não só uma data escrita na tabela.
  const assinadas = formacoesDoTrabalhador.filter(x => x.participacao.assinado_em);
  if (assinadas.length > 0) {
    if (y > 250) { doc.addPage(); y = 20; }
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...NAVY_DEEP);
    doc.text('ASSINATURAS ELETRÓNICAS', 14, y);
    doc.setTextColor(0, 0, 0);
    y += 4;

    let coluna = 0;
    const largura = 88;
    const ALTURA_BLOCO = 26;
    for (const { formacao: f, participacao: p } of assinadas) {
      if (y > 260) { doc.addPage(); y = 20; coluna = 0; }
      const assinaturaBase64 = await imagemParaBase64(p.assinatura_signed_url);
      const x = 14 + coluna * (largura + 6);
      await desenharBlocoAssinatura(doc, x, y, {
        nome: f.tipo_formacao || f.titulo,
        assinaturaBase64,
        assinadoEm: p.assinado_em,
        participanteId: p.id,
        largura,
      });
      if (coluna === 1) { y += ALTURA_BLOCO + 4; coluna = 0; } else { coluna = 1; }
    }
    if (coluna === 1) y += ALTURA_BLOCO + 4;
  }

  if (y > 250) { doc.addPage(); y = 20; }
  doc.setFontSize(8.5);
  doc.setTextColor(...SLATE);
  doc.text(
    'Nos termos do art. 131.º do Código do Trabalho, o trabalhador tem direito a um mínimo de 40 horas de formação\ncontínua por ano, proporcional ao tempo de vínculo no ano e ao regime de trabalho. Cada formação assinada acima\nfoi confirmada eletronicamente pelo próprio trabalhador, autenticado na sua sessão pessoal. Documento gerado em ' + fmtDataHora(new Date()) + '.',
    14, y
  );
  doc.setTextColor(0, 0, 0);
  y += 8;

  if (y > 250) { doc.addPage(); y = 20; }
  desenharBlocoEmpresa(doc, 120, y, {
    carimboBase64,
    // já vem como data URL de Definições → Assinatura da Empresa, não uma
    // URL remota — nada a ir buscar, é embutir diretamente.
    assinaturaBase64: companySignature?.signatureDataUrl || null,
    nomeResponsavel: companySignature?.responsibleName,
    cargoResponsavel: companySignature?.responsibleRole,
    codigo: hashCurto(`${worker.id}-${ano}-registo`),
  });

  rodape(doc);
  doc.save(`registo-formacao-${worker.name.replace(/\s+/g, '_')}-${ano}.pdf`);
}

// Certificado individual de conclusão — um por formação já assinada pelo
// trabalhador, em formato de diploma (paisagem, moldura decorativa), pronto
// a entregar ao trabalhador ou a um cliente como comprovativo autónomo.
// `companySignature` (opcional) vem de Definições → Assinatura da Empresa
// ({ responsibleName, responsibleRole, signatureDataUrl }).
export async function exportCertificadoPDF(formacao, participante, companySignature) {
  if (!participante?.assinado_em) {
    throw new Error('Só é possível emitir certificado para uma formação já assinada pelo trabalhador.');
  }

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const logoBase64 = await getLogoBase64();
  const carimboBase64 = await getCarimboBase64();
  const assinaturaBase64 = await imagemParaBase64(participante.assinatura_signed_url);
  const W = 297, H = 210;
  const numeroCertificado = hashCurto(`${formacao.id}-${participante.id}-cert`);

  // Fundo branco.
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, W, H, 'F');

  // Marca de água — logótipo gigante e muito translúcido, centrado, atrás
  // de tudo o resto — dá o aspeto de um documento oficial impresso em papel
  // timbrado, não uma folha em branco com texto.
  if (logoBase64) {
    doc.saveGraphicsState();
    doc.setGState(new doc.GState({ opacity: 0.05 }));
    const wmSize = 150;
    doc.addImage(logoBase64, 'PNG', W / 2 - wmSize / 2, H / 2 - wmSize / 2, wmSize, wmSize);
    doc.restoreGraphicsState();
  }

  // Moldura decorativa dupla, cores da marca, com pequenos remates nos
  // cantos (estilo "canto de documento oficial").
  doc.setDrawColor(...NAVY);
  doc.setLineWidth(1.4);
  doc.rect(8, 8, W - 16, H - 16);
  doc.setDrawColor(...ORANGE);
  doc.setLineWidth(0.5);
  doc.rect(11.5, 11.5, W - 23, H - 23);

  doc.setDrawColor(...ORANGE);
  doc.setLineWidth(0.9);
  const rc = 6; // comprimento do remate de canto
  const cantos = [[15, 15, 1, 1], [W - 15, 15, -1, 1], [15, H - 15, 1, -1], [W - 15, H - 15, -1, -1]];
  for (const [cx, cy, sx, sy] of cantos) {
    doc.line(cx, cy, cx + rc * sx, cy);
    doc.line(cx, cy, cx, cy + rc * sy);
  }

  if (logoBase64) doc.addImage(logoBase64, 'PNG', W / 2 - 12, 18, 24, 24);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...NAVY_DEEP);
  doc.text('MAGNETIC PLACE UNIPESSOAL, LDA', W / 2, 49, { align: 'center' });

  doc.setFontSize(28);
  doc.setTextColor(...NAVY);
  doc.text('CERTIFICADO DE FORMAÇÃO', W / 2, 66, { align: 'center' });

  // Divisor decorativo — traço sólido laranja ladeado por traço navy
  // tracejado, no mesmo espírito do "cordão de solda" usado no resto do
  // módulo de Formação Interna.
  doc.setDrawColor(...NAVY);
  doc.setLineWidth(0.25);
  doc.setLineDashPattern([1, 1.2], 0);
  doc.line(W / 2 - 55, 71, W / 2 - 42, 71);
  doc.line(W / 2 + 42, 71, W / 2 + 55, 71);
  doc.setLineDashPattern([], 0);
  doc.setDrawColor(...ORANGE);
  doc.setLineWidth(0.8);
  doc.line(W / 2 - 40, 71, W / 2 + 40, 71);

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...SLATE);
  doc.text(`Nº ${numeroCertificado}`, W / 2, 76, { align: 'center' });
  doc.setTextColor(0, 0, 0);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(0, 0, 0);
  doc.text('Certifica-se que', W / 2, 85, { align: 'center' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(...NAVY_DEEP);
  doc.text(participante.workers?.name || participante.worker_id, W / 2, 98, { align: 'center' });

  const isElearning = formacao.formato === 'e-learning';
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(0, 0, 0);
  doc.text('concluiu com aproveitamento a formação', W / 2, 109, { align: 'center' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(...ORANGE_DEEP);
  doc.text(formacao.tipo_formacao || formacao.titulo, W / 2, 119, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10.5);
  doc.setTextColor(0, 0, 0);
  const detalhes = [
    `Categoria: ${CATEGORIA_LABEL[formacao.categoria] || formacao.categoria || '—'}`,
    `Duração: ${formacao.duracao_horas}h`,
    `Formato: ${isElearning ? 'E-learning' : 'Presencial'}`,
    ...(isElearning && participante.nota_obtida != null ? [`Nota: ${participante.nota_obtida}%`] : []),
    `Data: ${fmtData(formacao.data_inicio)}`,
  ];
  doc.text(detalhes.join('   ·   '), W / 2, 128, { align: 'center' });

  // Assinatura eletrónica real + código de verificação, lado a lado com a
  // "assinatura" institucional — o que torna o certificado credível é a
  // imagem real recolhida no momento da conclusão, não um nome impresso.
  const yAss = 152;
  doc.setDrawColor(...SLATE);
  doc.setLineWidth(0.2);

  doc.line(W / 2 - 85, yAss + 16, W / 2 - 20, yAss + 16);
  if (assinaturaBase64) {
    try { doc.addImage(assinaturaBase64, 'PNG', W / 2 - 80, yAss, 55, 15, undefined, 'FAST'); } catch { /* segue sem imagem */ }
  }
  doc.setFontSize(8.5);
  doc.setTextColor(...NAVY_DEEP);
  doc.text('Assinatura do Trabalhador', W / 2 - 85, yAss + 20);
  doc.setFontSize(6.5);
  doc.setTextColor(...SLATE);
  doc.text(`Assinado eletronicamente em ${fmtDataHora(participante.assinado_em)}`, W / 2 - 85, yAss + 24);
  doc.text(`Código de verificação: ${codigoVerificacao(participante.id)}`, W / 2 - 85, yAss + 27.5);

  doc.setDrawColor(...SLATE);
  doc.line(W / 2 + 20, yAss + 16, W / 2 + 85, yAss + 16);
  desenharBlocoEmpresa(doc, W / 2 + 22, yAss - 2, {
    carimboBase64,
    assinaturaBase64: companySignature?.signatureDataUrl || null,
    nomeResponsavel: companySignature?.responsibleName,
    cargoResponsavel: companySignature?.responsibleRole,
    codigo: numeroCertificado,
    largura: 63,
  });

  doc.setTextColor(0, 0, 0);
  doc.setFontSize(7.5);
  doc.setTextColor(...SLATE);
  doc.text('Documento gerado automaticamente pelo sistema de gestão de formação interna da Magnetic Place.', W / 2, H - 15, { align: 'center' });
  doc.setTextColor(0, 0, 0);

  // Verso — cronograma/conteúdo programático da formação, para o certificado
  // não ficar só com a frente decorativa: dá para conferir o que foi mesmo
  // dado, sessão a sessão, sem precisar de consultar o sistema.
  doc.addPage('a4', 'landscape');
  desenharVersoCronograma(doc, formacao, logoBase64);

  const nomeArquivo = `certificado-${(participante.workers?.name || 'trabalhador').replace(/\s+/g, '_')}-${(formacao.tipo_formacao || formacao.titulo || 'formacao').replace(/\s+/g, '_')}.pdf`;
  doc.save(nomeArquivo);
}

// Verso do certificado — cronograma/conteúdo programático da formação.
// Presencial usa o texto livre de conteudo_programatico; e-learning usa as
// secções estruturadas (conteudo_estruturado.seccoes), com o objetivo geral
// no topo, exatamente o que o trabalhador percorreu no módulo.
function desenharVersoCronograma(doc, formacao, logoBase64) {
  const W = 297, H = 210;

  // Cabeçalho e rodapé próprios (paisagem) — cabecalho()/rodape() partilhados
  // assumem sempre A4 retrato (210×297), não servem para esta página.
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, W, 26, 'F');
  doc.setFillColor(...ORANGE);
  doc.rect(0, 26, W, 1.3, 'F');
  if (logoBase64) doc.addImage(logoBase64, 'PNG', 14, 3, 19, 19);
  const textX = logoBase64 ? 38 : 14;
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text('MAGNETIC PLACE', textX, 12);
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.text('CRONOGRAMA DA FORMAÇÃO — Verso do Certificado', textX, 18);
  doc.setTextColor(0, 0, 0);

  let y = 35;
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...NAVY_DEEP);
  doc.text(formacao.tipo_formacao || formacao.titulo, 14, y);
  doc.setTextColor(0, 0, 0);
  y += 3;
  doc.setDrawColor(...ORANGE);
  doc.setLineWidth(0.6);
  doc.line(14, y, W - 14, y);
  y += 6;

  const isElearning = formacao.formato === 'e-learning';
  autoTable(doc, {
    startY: y,
    theme: 'plain',
    styles: { fontSize: 9, cellPadding: 1.6 },
    columnStyles: { 0: { fontStyle: 'bold', textColor: NAVY, cellWidth: 40 } },
    alternateRowStyles: { fillColor: ROW_TINT },
    tableWidth: W - 28,
    body: [
      ['Categoria', CATEGORIA_LABEL[formacao.categoria] || formacao.categoria || '—'],
      ['Formato', isElearning ? 'E-learning' : 'Presencial'],
      ['Duração', `${formacao.duracao_horas}h`],
      ['Data', `${fmtData(formacao.data_inicio)}${formacao.data_fim && formacao.data_fim !== formacao.data_inicio ? ` a ${fmtData(formacao.data_fim)}` : ''}`],
      ...(formacao.local ? [['Local', formacao.local]] : []),
      ...(formacao.formador?.name ? [['Formador', formacao.formador.name]] : []),
      ...(formacao.entidade_externa ? [['Entidade Externa', formacao.entidade_externa]] : []),
      ...(formacao.metodo_avaliacao ? [['Método de Avaliação', formacao.metodo_avaliacao]] : []),
    ],
  });
  y = doc.lastAutoTable.finalY + 8;

  const objetivo = formacao.objetivos || formacao.conteudo_estruturado?.objetivo;
  if (objetivo) {
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...NAVY_DEEP);
    doc.text('OBJETIVO', 14, y);
    doc.setTextColor(0, 0, 0);
    y += 5;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    const linhasObjetivo = doc.splitTextToSize(objetivo, W - 28);
    doc.text(linhasObjetivo, 14, y);
    y += linhasObjetivo.length * 4.2 + 6;
  }

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...NAVY_DEEP);
  doc.text('CRONOGRAMA / CONTEÚDO PROGRAMÁTICO', 14, y);
  doc.setTextColor(0, 0, 0);
  y += 6;

  const seccoes = formacao.conteudo_estruturado?.seccoes;
  if (Array.isArray(seccoes) && seccoes.length > 0) {
    for (const sec of seccoes) {
      if (y > 185) { doc.addPage('a4', 'landscape'); y = 20; }
      doc.setFontSize(9.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...ORANGE_DEEP);
      doc.text(`• ${sec.titulo}`, 14, y);
      doc.setTextColor(0, 0, 0);
      y += 4.5;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      const texto = [...(sec.paragrafos || []), ...(sec.lista || []).map(li => `– ${li}`)].join('  ');
      if (texto) {
        const linhas = doc.splitTextToSize(texto, W - 32);
        doc.text(linhas, 18, y);
        y += linhas.length * 4 + 4;
      } else {
        y += 2;
      }
    }
  } else if (formacao.conteudo_programatico) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    const linhas = doc.splitTextToSize(formacao.conteudo_programatico, W - 28);
    doc.text(linhas, 14, y);
    y += linhas.length * 4.2;
  } else {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...SLATE);
    doc.text('Sem conteúdo programático registado.', 14, y);
    doc.setTextColor(0, 0, 0);
  }

  // Rodapé próprio (paisagem) em todas as páginas do verso — rodape()
  // partilhado assume A4 retrato, não serve aqui.
  const totalPaginas = doc.internal.getNumberOfPages();
  for (let i = 2; i <= totalPaginas; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(...SLATE);
    doc.text('MAGNETIC PLACE UNIPESSOAL, LDA', 14, H - 8);
    doc.text(`Página ${i}/${totalPaginas}`, W - 14, H - 8, { align: 'right' });
    doc.setTextColor(0, 0, 0);
  }
}
