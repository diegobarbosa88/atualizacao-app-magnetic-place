import { PDFDocument, StandardFonts, rgb } from "https://esm.sh/pdf-lib@1.17.1";

// Réplica (server-side, pdf-lib) do layout de
// src/components/common/ClientTimesheetReport.jsx — mesma estrutura visual
// que o relatório de horas já usado na app (cabeçalho, barra do colaborador,
// tabelas semanais, resumo mensal, carimbo de assinatura). O app aplica uma
// regra global de CSS (`text-transform: uppercase`) a tudo — por isso todo o
// texto aqui é gerado já em maiúsculas, para bater certo visualmente com o
// PDF exportado pela app. Suporta um único trabalhador (enviar_folha_ponto)
// ou vários (enviar_folhas_ponto_cliente) — cada trabalhador começa numa
// página nova, como no export em lote (ZIP) da própria app.
const INDIGO     = rgb(79 / 255, 70 / 255, 229 / 255);   // indigo-600, cor dos totais
const INK        = rgb(0.06, 0.09, 0.14);                // texto principal quase-preto
const SLATE      = rgb(0.55, 0.58, 0.64);                // labels em cinza
const SLATE_LIGHT= rgb(0.78, 0.80, 0.84);                // dias sem registo
const BAND_BG    = rgb(0.95, 0.96, 0.98);                // faixa clara (colaborador / semana)
const BORDER     = rgb(0.85, 0.87, 0.90);

const PAGE_W  = 595.28; // A4 retrato, igual ao relatório original
const PAGE_H  = 841.89;
const MARGIN  = 34;
const CONTENT_W = PAGE_W - MARGIN * 2;

const MESES_PT = [
  "JANEIRO", "FEVEREIRO", "MARÇO", "ABRIL", "MAIO", "JUNHO",
  "JULHO", "AGOSTO", "SETEMBRO", "OUTUBRO", "NOVEMBRO", "DEZEMBRO",
];
const DIAS_PT = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];

export interface LogEntry {
  date: string;
  startTime: string | null;
  breakStart: string | null;
  breakEnd: string | null;
  endTime: string | null;
  description: string | null;
  hours: number | null;
  clientId: string | null;
  clientName: string;
}

export interface WorkerReportInput {
  workerName: string;
  logs: LogEntry[];
}

export interface GenerateFolhaPontoOptions {
  mes: string; // YYYY-MM
  workers: WorkerReportInput[];
  logoBytes: Uint8Array | null;
}

function isoWeek(dateStr: string): number {
  const d = new Date(dateStr + "T00:00:00Z");
  const target = new Date(d.valueOf());
  const dayNr = (d.getUTCDay() + 6) % 7;
  target.setUTCDate(target.getUTCDate() - dayNr + 3);
  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  const diff = target.valueOf() - firstThursday.valueOf();
  return 1 + Math.round(diff / (7 * 24 * 60 * 60 * 1000));
}

function calcDuration(start: string | null, end: string | null, bStart: string | null, bEnd: string | null): number {
  if (!start || !end || start === "--:--" || end === "--:--") return 0;
  const toMin = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + (m || 0);
  };
  let total = toMin(end) - toMin(start);
  if (bStart && bEnd && bStart !== "--:--" && bEnd !== "--:--") {
    total -= (toMin(bEnd) - toMin(bStart));
  }
  return Math.max(0, total) / 60;
}

function formatHours(h: number): string {
  const hours = Math.floor(h);
  const minutes = Math.round((h - hours) * 60);
  return `${hours}H${minutes === 0 ? "00" : String(minutes).padStart(2, "0")}`;
}

function daysInMonth(mes: string): string[] {
  const [y, m] = mes.split("-").map(Number);
  const last = new Date(y, m, 0).getDate();
  return Array.from({ length: last }, (_, i) => `${mes}-${String(i + 1).padStart(2, "0")}`);
}

type Fonts = {
  reg: Awaited<ReturnType<PDFDocument["embedFont"]>>;
  bold: Awaited<ReturnType<PDFDocument["embedFont"]>>;
  mono: Awaited<ReturnType<PDFDocument["embedFont"]>>;
  monoBold: Awaited<ReturnType<PDFDocument["embedFont"]>>;
};

function drawWorkerSection(
  doc: PDFDocument,
  fonts: Fonts,
  logoImg: Awaited<ReturnType<PDFDocument["embedPng"]>> | null,
  mes: string,
  workerName: string,
  logs: LogEntry[],
) {
  const { reg: fontReg, bold: fontBold, mono: fontMono, monoBold: fontMonoBold } = fonts;

  const [yy, mm] = mes.split("-").map(Number);
  const mesLabel = `${MESES_PT[(mm || 1) - 1]} DE ${yy}`;

  const clientIds = [...new Set(logs.map((l) => l.clientId).filter(Boolean))];
  const isVariosClientes = clientIds.length !== 1;
  const subtitleClient = isVariosClientes ? "VÁRIOS CLIENTES" : (logs[0]?.clientName || "").toUpperCase();

  let page = doc.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H;

  // ── Cabeçalho ───────────────────────────────────────────────────
  y -= 26;
  if (logoImg) {
    const logoSize = 40;
    page.drawImage(logoImg, { x: MARGIN, y: y - logoSize + 8, width: logoSize, height: logoSize });
  }
  const textX = MARGIN + (logoImg ? 52 : 0);
  page.drawText("MAGNETIC PLACE", { x: textX, y, size: 17, font: fontBold, color: INK });
  page.drawText("UNIPESSOAL LDA", { x: textX, y: y - 15, size: 8, font: fontReg, color: SLATE });

  const mesW = fontBold.widthOfTextAtSize(mesLabel, 13);
  page.drawText(mesLabel, { x: PAGE_W - MARGIN - mesW, y, size: 13, font: fontBold, color: INK });
  const subLabel = `FOLHA DE HORAS MENSAL · ${subtitleClient}`;
  const subW = fontReg.widthOfTextAtSize(subLabel, 8);
  page.drawText(subLabel, { x: PAGE_W - MARGIN - subW, y: y - 14, size: 8, font: fontReg, color: SLATE });

  y -= 30;
  page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_W - MARGIN, y }, thickness: 1.4, color: INK });
  y -= 18;

  // ── Barra do colaborador ─────────────────────────────────────────
  const BAR_H = 30;
  page.drawRectangle({ x: MARGIN, y: y - BAR_H, width: CONTENT_W, height: BAR_H, color: BAND_BG });
  page.drawText("COLABORADOR", { x: MARGIN + 12, y: y - 13, size: 6.5, font: fontBold, color: SLATE });
  page.drawText(workerName.toUpperCase(), { x: MARGIN + 12, y: y - 27, size: 12, font: fontBold, color: INK });

  const totalMes = logs.reduce((acc, l) => acc + (l.hours ?? calcDuration(l.startTime, l.endTime, l.breakStart, l.breakEnd)), 0);
  const totalLabel = "TOTAL REGISTADO";
  const totalLabelW = fontBold.widthOfTextAtSize(totalLabel, 6.5);
  page.drawText(totalLabel, { x: PAGE_W - MARGIN - 12 - totalLabelW, y: y - 13, size: 6.5, font: fontBold, color: SLATE });
  const totalValue = formatHours(totalMes);
  const totalValueW = fontMonoBold.widthOfTextAtSize(totalValue, 14);
  page.drawText(totalValue, { x: PAGE_W - MARGIN - 12 - totalValueW, y: y - 29, size: 14, font: fontMonoBold, color: INDIGO });
  y -= BAR_H + 10;

  // ── Colunas da tabela (sem Comentário, igual ao default da app) ──
  const cols = [
    { label: "DIA",     w: 55 },
    { label: "ENTRADA", w: 60 },
    { label: "I. DESC", w: 55 },
    { label: "F. DESC", w: 55 },
    { label: "SAÍDA",   w: 55 },
    { label: "TOTAL",   w: 55 },
    { label: "PROJETO", w: CONTENT_W - (55 + 60 + 55 * 4) },
  ];
  const colX: number[] = [];
  { let acc = MARGIN; for (const c of cols) { colX.push(acc); acc += c.w; } }
  const colCenter = (i: number) => colX[i] + cols[i].w / 2;

  const ROW_H = 11.5;
  const WEEK_HEADER_H = 13;
  const COL_HEADER_H = 11;

  const ensureSpace = (needed: number) => {
    if (y - needed < MARGIN + 30) {
      page = doc.addPage([PAGE_W, PAGE_H]);
      y = PAGE_H - 30;
      page.drawText(`MAGNETIC PLACE · FOLHA DE PONTO · ${workerName.toUpperCase()} (CONTINUAÇÃO)`, { x: MARGIN, y, size: 7.5, font: fontReg, color: SLATE });
      y -= 20;
    }
  };

  const allDates = daysInMonth(mes);
  const weeks = new Map<number, string[]>();
  for (const d of allDates) {
    const w = isoWeek(d);
    if (!weeks.has(w)) weeks.set(w, []);
    weeks.get(w)!.push(d);
  }

  const logsByDate = new Map<string, LogEntry[]>();
  for (const l of logs) {
    if (!logsByDate.has(l.date)) logsByDate.set(l.date, []);
    logsByDate.get(l.date)!.push(l);
  }

  for (const [weekNum, dates] of [...weeks.entries()].sort((a, b) => a[0] - b[0])) {
    ensureSpace(WEEK_HEADER_H + COL_HEADER_H + ROW_H);

    page.drawRectangle({ x: MARGIN, y: y - WEEK_HEADER_H, width: CONTENT_W, height: WEEK_HEADER_H, color: BAND_BG });
    page.drawText(`SEMANA ${weekNum}`, { x: MARGIN + 8, y: y - WEEK_HEADER_H + 5, size: 8, font: fontBold, color: INK });
    let totalSemana = 0;
    for (const d of dates) {
      for (const l of (logsByDate.get(d) || [])) {
        totalSemana += l.hours ?? calcDuration(l.startTime, l.endTime, l.breakStart, l.breakEnd);
      }
    }
    const semanaTxt = `TOTAL SEMANAL:  ${formatHours(totalSemana)}`;
    const semanaW = fontBold.widthOfTextAtSize(semanaTxt, 8);
    page.drawText(semanaTxt, { x: PAGE_W - MARGIN - 8 - semanaW, y: y - WEEK_HEADER_H + 5, size: 8, font: fontBold, color: INK });
    y -= WEEK_HEADER_H;

    cols.forEach((c, i) => {
      const w = fontBold.widthOfTextAtSize(c.label, 6.5);
      page.drawText(c.label, { x: i === cols.length - 1 ? colX[i] + 6 : colCenter(i) - w / 2, y: y - COL_HEADER_H + 4, size: 6.5, font: fontBold, color: SLATE });
    });
    y -= COL_HEADER_H;
    page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_W - MARGIN, y }, thickness: 0.5, color: BORDER });

    for (const dateStr of dates) {
      const dateObj = new Date(dateStr + "T00:00:00Z");
      const dayLabel = `${dateObj.getUTCDate()} ${DIAS_PT[dateObj.getUTCDay()]}`;
      const dayLogs = logsByDate.get(dateStr) || [];

      if (dayLogs.length === 0) {
        ensureSpace(ROW_H);
        page.drawText(dayLabel, { x: colCenter(0) - fontBold.widthOfTextAtSize(dayLabel, 7) / 2, y: y - ROW_H + 4, size: 7, font: fontBold, color: SLATE_LIGHT });
        y -= ROW_H;
        continue;
      }

      for (const log of dayLogs) {
        ensureSpace(ROW_H);
        const hours = log.hours ?? calcDuration(log.startTime, log.endTime, log.breakStart, log.breakEnd);
        const vals = [dayLabel, log.startTime || "", log.breakStart || "", log.breakEnd || "", log.endTime || "", formatHours(hours)];
        vals.forEach((v, i) => {
          if (!v) return;
          const font = i === 0 ? fontBold : fontMono;
          const color = i === 0 ? INK : (i === 5 ? INK : SLATE);
          const size = i === 0 ? 7 : 7.5;
          const w = font.widthOfTextAtSize(v, size);
          page.drawText(v, { x: colCenter(i) - w / 2, y: y - ROW_H + 4, size, font, color });
        });
        const projeto = (log.clientName || "").toUpperCase();
        page.drawText(projeto.slice(0, 42), { x: colX[6] + 6, y: y - ROW_H + 4, size: 6.5, font: fontReg, color: INK });
        y -= ROW_H;
      }
    }
    y -= 5;
  }

  // ── Resumo mensal ────────────────────────────────────────────────
  ensureSpace(60);
  page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_W - MARGIN, y }, thickness: 1.2, color: INK });
  y -= 13;
  page.drawText("RESUMO MENSAL", { x: MARGIN, y, size: 7, font: fontBold, color: SLATE });

  const totalLabel2 = "TOTAL REGISTADO";
  const totalLabel2W = fontBold.widthOfTextAtSize(totalLabel2, 6.5);
  page.drawText(totalLabel2, { x: PAGE_W - MARGIN - totalLabel2W, y: y + 2, size: 6.5, font: fontBold, color: SLATE });
  const totalValue2W = fontMonoBold.widthOfTextAtSize(totalValue, 15);
  page.drawText(totalValue, { x: PAGE_W - MARGIN - totalValue2W, y: y - 15, size: 15, font: fontMonoBold, color: INDIGO });

  y -= 12;
  const byClient = new Map<string, number>();
  for (const l of logs) {
    const name = (l.clientName || "SEM CLIENTE").toUpperCase();
    const hours = l.hours ?? calcDuration(l.startTime, l.endTime, l.breakStart, l.breakEnd);
    byClient.set(name, (byClient.get(name) || 0) + hours);
  }
  for (const [clientName, hrs] of [...byClient.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    ensureSpace(11);
    page.drawText(clientName.slice(0, 40), { x: MARGIN, y, size: 7.5, font: fontBold, color: SLATE });
    page.drawText(formatHours(hrs), { x: MARGIN + 210, y, size: 7.5, font: fontMonoBold, color: INDIGO });
    y -= 11;
  }

  // ── Carimbo "Aguardando assinatura" ───────────────────────────────
  ensureSpace(70);
  y -= 12;
  const stampW = 190, stampH = 50;
  const stampX = PAGE_W - MARGIN - stampW;
  page.drawRectangle({
    x: stampX, y: y - stampH, width: stampW, height: stampH,
    borderColor: BORDER, borderWidth: 1, color: rgb(1, 1, 1),
    ...( { borderDashArray: [4, 3] } as Record<string, unknown> ),
  });
  const waitLabel = "AGUARDANDO ASSINATURA";
  const waitW = fontBold.widthOfTextAtSize(waitLabel, 7);
  page.drawText(waitLabel, { x: stampX + stampW / 2 - waitW / 2, y: y - stampH / 2 - 3, size: 7, font: fontBold, color: SLATE_LIGHT });

  return totalMes;
}

export async function generateFolhaPontoPDF(opts: GenerateFolhaPontoOptions): Promise<{ bytes: Uint8Array; totalPorTrabalhador: Record<string, number> }> {
  const { mes, workers, logoBytes } = opts;

  const doc = await PDFDocument.create();
  const fonts: Fonts = {
    reg: await doc.embedFont(StandardFonts.Helvetica),
    bold: await doc.embedFont(StandardFonts.HelveticaBold),
    mono: await doc.embedFont(StandardFonts.Courier),
    monoBold: await doc.embedFont(StandardFonts.CourierBold),
  };

  let logoImg = null;
  if (logoBytes) {
    try { logoImg = await doc.embedPng(logoBytes); } catch { /* segue sem logo */ }
  }

  const totalPorTrabalhador: Record<string, number> = {};
  for (const w of workers) {
    const total = drawWorkerSection(doc, fonts, logoImg, mes, w.workerName, w.logs);
    totalPorTrabalhador[w.workerName] = total;
  }

  return { bytes: await doc.save(), totalPorTrabalhador };
}
