import { PDFDocument, StandardFonts, rgb } from "https://esm.sh/pdf-lib@1.17.1";

// Cores de marca
const ORANGE     = rgb(235 / 255, 141 / 255,   0 / 255); // #EB8D00
const NAVY       = rgb( 27 / 255,  58 / 255,  87 / 255); // #1B3A57
const SLATE_BLUE = rgb(134 / 255, 154 / 255, 175 / 255); // #869AAF
const WHITE      = rgb(1, 1, 1);
const DARK_TEXT  = rgb(0.10, 0.15, 0.22);
const LIGHT_TEXT = rgb(0.42, 0.48, 0.56);
const BORDER     = rgb(0.88, 0.90, 0.93);

// A4 em pontos (1 mm = 2.835 pt)
const PAGE_W  = 595.28;
const PAGE_H  = 841.89;
const MARGIN  = 48;
const CONTENT_W = PAGE_W - MARGIN * 2;

// Ao alterar este texto, incrementar a chave de versão e atualizar o texto equivalente
// em src/features/public/OnboardingCommitmentStep.jsx.
// Os dois textos devem ser IDÊNTICOS para que o hash SHA-256 seja consistente.
const LEGAL_TEXTS: Record<string, string> = {
  "v1.0": `COMPROMISSO DE INÍCIO DE ATIVIDADE
(Contrato-Promessa de Trabalho, nos termos do artigo 103.º do Código do Trabalho)

Cláusula 1.ª (Identificação das Partes)

Entre:
Magnetic Place Unipessoal, Lda., pessoa coletiva n.º 517379740, com sede na Trofa, neste ato representada por quem tem poderes para o efeito, adiante designada por "Primeira Contraente" ou "Empregadora"; e

[Nome completo do trabalhador], [estado civil], titular do documento de identificação n.º [_____], válido até [__/__/____], contribuinte fiscal (NIF) n.º [_____] e, se aplicável, número de identificação de Segurança Social (NISS) n.º [_____], residente em [morada completa], adiante designado por "Segundo Contraente" ou "Trabalhador",

é celebrado, de boa-fé e em termos inequívocos, o presente Compromisso de Início de Atividade, que se rege pelas cláusulas seguintes e, no que nelas for omisso, pelo Código do Trabalho e pela lei civil aplicável.

Cláusula 2.ª (Objeto e compromisso assumido)

1. O Segundo Contraente promete, de forma livre e esclarecida, iniciar funções ao serviço da Primeira Contraente na categoria profissional de [soldador / mecânico / outra], no dia [__/__/____], com o local de trabalho em [___] ou nas obras/clientes a que venha a ser afeto.

2. A Primeira Contraente promete admitir o Segundo Contraente na data e categoria referidas, mediante a retribuição base ilíquida mensal de [_____] €, acrescida das demais prestações e subsídios legalmente devidos.

3. As partes declaram, em termos inequívocos, obrigar-se a celebrar o contrato de trabalho prometido na data de início acima indicada.

Cláusula 3.ª (Efeitos imediatos da aceitação e custos assumidos pela Empregadora)

O Segundo Contraente reconhece e aceita que, a partir da aceitação do presente Compromisso e com vista a assegurar o início de atividade na data acordada, a Primeira Contraente fica legalmente obrigada a, e incorre de imediato em custos e obrigações com, nomeadamente:

a) A comunicação da admissão do Trabalhador à Segurança Social, dentro do prazo legalmente exigível antes do início da produção de efeitos do contrato;
b) A inclusão do Trabalhador na apólice de seguro obrigatório de acidentes de trabalho, com o correspondente encargo de prémio;
c) Os demais atos administrativos internos de admissão e afetação do Trabalhador.

Cláusula 4.ª (Incumprimento e responsabilidade)

1. O incumprimento culposo do presente Compromisso por qualquer das partes dá lugar à responsabilidade civil do contraente faltoso pelos danos causados à contraparte, nos termos gerais, conforme o artigo 103.º, n.º 2, do Código do Trabalho.

2. Sem prejuízo da prova dos danos efetivamente sofridos, as partes reconhecem que se incluem entre os danos ressarcíveis resultantes do não início de funções por facto imputável ao Trabalhador, a título exemplificativo e não exaustivo: (a) os custos de admissão e de comunicação à Segurança Social; (b) o prémio de seguro de acidentes de trabalho suportado em razão da inclusão do Trabalhador na apólice; (c) os custos administrativos internos; e (d) os custos de substituição do Trabalhador, incluindo nova procura e recrutamento e prejuízos decorrentes do atraso na afetação a obra ou cliente.

3. As partes reconhecem expressamente que, nos termos do artigo 103.º, n.º 3, do Código do Trabalho, não é aplicável a execução específica prevista no artigo 830.º do Código Civil, não podendo qualquer das partes ser obrigada à celebração forçada do contrato prometido, restando unicamente a via indemnizatória.

Cláusula 5.ª (Boa-fé e liberdade de trabalho)

O presente Compromisso não limita, restringe ou condiciona a liberdade de trabalho do Segundo Contraente, constitucionalmente garantida, tendo por único efeito o dever de indemnizar os danos causados por incumprimento culposo, nos termos das cláusulas anteriores.

Cláusula 6.ª (Declaração de leitura, aceitação e assinatura)

O Segundo Contraente declara ter lido, compreendido e aceite integralmente todas as cláusulas do presente Compromisso, que assina de forma livre e esclarecida.`,
};

export interface DadosPersonalizacao {
  nome: string;
  documentoId?: string;
  documentoValidade?: string; // ISO yyyy-mm-dd
  nif?: string;
  nis?: string;
  morada?: string;
  profissao?: string;
  dataInicio?: string;       // ISO yyyy-mm-dd (vem do convite)
  localTrabalho?: string;    // vem do convite
  vencimentoBase?: number;   // vem do convite
}

function fmtDataPT(iso?: string): string | null {
  if (!iso) return null;
  const [y, m, d] = iso.split("-");
  return (y && m && d) ? `${d}/${m}/${y}` : iso;
}

// Substitui os placeholders do template com os dados reais já recolhidos
// (candidato + condições definidas no convite). Aplica-se apenas ao PDF — o
// hash é sempre calculado sobre o texto original do template. Mantém
// IDÊNTICA à função personalizarTexto() em
// src/features/public/OnboardingCommitmentStep.jsx.
function personalizarTexto(template: string, dados: DadosPersonalizacao): string {
  const validade = fmtDataPT(dados.documentoValidade);
  const inicio   = fmtDataPT(dados.dataInicio);
  const salario  = (dados.vencimentoBase !== undefined && dados.vencimentoBase !== null)
    ? Number(dados.vencimentoBase).toFixed(2) : null;

  let out = template.replace("[Nome completo do trabalhador]", dados.nome);
  if (dados.documentoId) out = out.replace("titular do documento de identificação n.º [_____]", `titular do documento de identificação n.º ${dados.documentoId}`);
  if (validade) out = out.replace("válido até [__/__/____]", `válido até ${validade}`);
  if (dados.nif) out = out.replace("contribuinte fiscal (NIF) n.º [_____]", `contribuinte fiscal (NIF) n.º ${dados.nif}`);
  if (dados.nis) out = out.replace("número de identificação de Segurança Social (NISS) n.º [_____]", `número de identificação de Segurança Social (NISS) n.º ${dados.nis}`);
  if (dados.morada) out = out.replace("residente em [morada completa]", `residente em ${dados.morada}`);
  if (dados.profissao) out = out.replace("na categoria profissional de [soldador / mecânico / outra]", `na categoria profissional de ${dados.profissao}`);
  if (inicio) out = out.replace("no dia [__/__/____]", `no dia ${inicio}`);
  if (dados.localTrabalho) out = out.replace("com o local de trabalho em [___]", `com o local de trabalho em ${dados.localTrabalho}`);
  if (salario) out = out.replace("retribuição base ilíquida mensal de [_____] €", `retribuição base ilíquida mensal de ${salario} €`);
  return out;
}

// Quebra de texto para caber na largura máxima
function wrapText(
  text: string,
  font: { widthOfTextAtSize: (t: string, s: number) => number },
  fontSize: number,
  maxWidth: number,
): string[] {
  const lines: string[] = [];
  for (const para of text.split("\n")) {
    if (para.trim() === "") { lines.push(""); continue; }
    const words = para.split(" ");
    let current = "";
    for (const word of words) {
      const test = current ? `${current} ${word}` : word;
      if (font.widthOfTextAtSize(test, fontSize) > maxWidth && current) {
        lines.push(current);
        current = word;
      } else {
        current = test;
      }
    }
    if (current) lines.push(current);
  }
  return lines;
}

function base64ToBytes(b64: string): Uint8Array {
  const clean = b64.replace(/^data:image\/\w+;base64,/, "");
  const binary = atob(clean);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export interface GeneratePDFOptions extends DadosPersonalizacao {
  assinaturaBase64: string;
  textoHash: string;
  textoVersao: string;
  ip: string;
  createdAt: string;
}

export async function generateCommitmentPDF(opts: GeneratePDFOptions): Promise<Uint8Array> {
  const { nome, documentoId, assinaturaBase64, textoHash, textoVersao, ip, createdAt } = opts;

  const doc = await PDFDocument.create();
  const fontReg  = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

  // Estado mutável da página atual
  let page = doc.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H;

  // Mini-cabeçalho nas páginas de continuação
  const addContinuationHeader = () => {
    page.drawRectangle({ x: 0, y: PAGE_H - 24, width: PAGE_W, height: 24, color: NAVY });
    page.drawText("MAGNETIC PLACE  ·  Compromisso de Início de Atividade (continuação)", {
      x: MARGIN, y: PAGE_H - 15, size: 7, font: fontReg, color: SLATE_BLUE,
    });
    page.drawRectangle({ x: 0, y: PAGE_H - 27, width: PAGE_W, height: 3, color: ORANGE });
    y = PAGE_H - 40;
  };

  const ensureSpace = (needed: number) => {
    if (y - needed < MARGIN + 30) {
      page = doc.addPage([PAGE_W, PAGE_H]);
      addContinuationHeader();
    }
  };

  // ── Cabeçalho principal ─────────────────────────────────────────
  const HEADER_H = 68;
  page.drawRectangle({ x: 0, y: PAGE_H - HEADER_H, width: PAGE_W, height: HEADER_H, color: NAVY });
  page.drawText("MAGNETIC PLACE", {
    x: MARGIN, y: PAGE_H - 34, size: 19, font: fontBold, color: WHITE,
  });
  page.drawText("Unipessoal, Lda", {
    x: MARGIN, y: PAGE_H - 52, size: 9, font: fontReg, color: SLATE_BLUE,
  });
  // Faixa laranja
  page.drawRectangle({ x: 0, y: PAGE_H - HEADER_H - 4, width: PAGE_W, height: 4, color: ORANGE });
  y = PAGE_H - HEADER_H - 4;

  // ── Título ──────────────────────────────────────────────────────
  y -= 28;
  page.drawText("COMPROMISSO DE INÍCIO DE ATIVIDADE", {
    x: MARGIN, y, size: 14, font: fontBold, color: NAVY,
  });
  y -= 10;
  page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_W - MARGIN, y }, thickness: 0.5, color: BORDER });
  y -= 18;

  // ── Texto legal (com dados do trabalhador substituídos nos placeholders) ──
  const legalTemplate = LEGAL_TEXTS[textoVersao] ?? LEGAL_TEXTS["v1.0"];
  const legalText = personalizarTexto(legalTemplate, opts);
  const textLines = wrapText(legalText, fontReg, 8.5, CONTENT_W);

  for (const line of textLines) {
    ensureSpace(13);
    if (line === "") {
      y -= 5;
    } else {
      const isBold = /^(CLÁUSULA|PARTES|PREÂMBULO|DISPOSIÇÕES|⚠️)/.test(line.trim());
      page.drawText(line, {
        x: MARGIN, y, size: 8.5, font: isBold ? fontBold : fontReg, color: DARK_TEXT,
      });
      y -= 13;
    }
  }

  // ── Dados do trabalhador ────────────────────────────────────────
  ensureSpace(100);
  y -= 18;
  page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_W - MARGIN, y }, thickness: 0.5, color: BORDER });
  y -= 14;
  page.drawText("DADOS DO TRABALHADOR", { x: MARGIN, y, size: 8, font: fontBold, color: SLATE_BLUE });
  y -= 14;

  const labelX   = MARGIN;
  const valueX   = MARGIN + 148;
  const rowH     = 14;
  const infoRows: [string, string][] = [
    ["Nome completo",             nome],
    ["Documento de identificação",documentoId || "N/D"],
    ["Data e hora da assinatura", new Date(createdAt).toLocaleString("pt-PT", { timeZone: "Europe/Lisbon" })],
    ["Versão do documento",       textoVersao],
  ];

  for (const [label, value] of infoRows) {
    ensureSpace(rowH + 2);
    page.drawText(`${label}:`, { x: labelX, y, size: 8, font: fontBold, color: LIGHT_TEXT });
    page.drawText(value,       { x: valueX, y, size: 8, font: fontReg,  color: DARK_TEXT  });
    y -= rowH;
  }

  // ── Assinatura ──────────────────────────────────────────────────
  ensureSpace(140);
  y -= 20;

  try {
    const sigBytes = base64ToBytes(assinaturaBase64);
    const sigImg   = await doc.embedPng(sigBytes);
    const { width: sw, height: sh } = sigImg.scale(1);
    const maxW = 200, maxH = 80;
    const scale = Math.min(maxW / sw, maxH / sh, 1);
    const dw = sw * scale, dh = sh * scale;

    // Caixa de assinatura
    page.drawRectangle({
      x: MARGIN, y: y - dh - 12, width: dw + 20, height: dh + 20,
      color: rgb(0.97, 0.98, 0.99), borderColor: BORDER, borderWidth: 0.5,
    });
    page.drawImage(sigImg, { x: MARGIN + 10, y: y - dh, width: dw, height: dh });
    y -= dh + 32;
  } catch (_) {
    page.drawText("[Imagem de assinatura indisponível]", { x: MARGIN, y, size: 8, font: fontReg, color: LIGHT_TEXT });
    y -= 20;
  }

  page.drawLine({ start: { x: MARGIN, y }, end: { x: MARGIN + 220, y }, thickness: 0.6, color: DARK_TEXT });
  y -= 10;
  page.drawText("Assinatura do/a Trabalhador/a", { x: MARGIN, y, size: 7.5, font: fontReg, color: LIGHT_TEXT });

  // ── Rodapé de integridade ───────────────────────────────────────
  ensureSpace(70);
  y -= 24;
  page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_W - MARGIN, y }, thickness: 0.4, color: BORDER });
  y -= 12;
  page.drawText("REGISTO DE INTEGRIDADE", { x: MARGIN, y, size: 7, font: fontBold, color: SLATE_BLUE });
  y -= 11;

  const footerRows: [string, string][] = [
    ["Hash SHA-256 do texto aceite", textoHash],
    ["Endereço IP de submissão",     ip],
    ["Timestamp UTC",                new Date(createdAt).toISOString()],
  ];

  for (const [label, value] of footerRows) {
    ensureSpace(20);
    page.drawText(`${label}: `, { x: MARGIN, y, size: 6.5, font: fontBold, color: LIGHT_TEXT });
    // Valores longos (hash) divididos em duas linhas
    const maxValW = CONTENT_W - 150;
    if (fontReg.widthOfTextAtSize(value, 6.5) > maxValW) {
      const half = Math.ceil(value.length / 2);
      page.drawText(value.slice(0, half),  { x: MARGIN + 150, y, size: 6.5, font: fontReg, color: DARK_TEXT });
      y -= 9;
      ensureSpace(9);
      page.drawText(value.slice(half), { x: MARGIN + 150, y, size: 6.5, font: fontReg, color: DARK_TEXT });
    } else {
      page.drawText(value, { x: MARGIN + 150, y, size: 6.5, font: fontReg, color: DARK_TEXT });
    }
    y -= 11;
  }

  return doc.save();
}
