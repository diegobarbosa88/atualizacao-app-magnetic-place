import { PDFDocument, StandardFonts, rgb } from "https://esm.sh/pdf-lib@1.17.1";

// Mesma paleta de marca usada em submit-onboarding-commitment/pdfGenerator.ts
const ORANGE     = rgb(235 / 255, 141 / 255,   0 / 255); // #EB8D00
const NAVY       = rgb( 27 / 255,  58 / 255,  87 / 255); // #1B3A57
const SLATE_BLUE = rgb(134 / 255, 154 / 255, 175 / 255); // #869AAF
const WHITE      = rgb(1, 1, 1);
const DARK_TEXT  = rgb(0.10, 0.15, 0.22);
const LIGHT_TEXT = rgb(0.42, 0.48, 0.56);
const BORDER     = rgb(0.88, 0.90, 0.93);
const ROW_ALT    = rgb(0.97, 0.98, 0.99);

const PAGE_W  = 841.89; // A4 paisagem (mais colunas cabem sem cortar)
const PAGE_H  = 595.28;
const MARGIN  = 40;
const CONTENT_W = PAGE_W - MARGIN * 2;

const MESES_PT = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

const DIAS_PT = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

export interface LogEntry {
  date: string;
  startTime: string | null;
  breakStart: string | null;
  breakEnd: string | null;
  endTime: string | null;
  description: string | null;
  hours: number | null;
  clientName: string;
}

export interface GenerateFolhaPontoOptions {
  workerName: string;
  mes: string; // YYYY-MM
  logs: LogEntry[];
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
  return `${hours}h${minutes === 0 ? "00" : String(minutes).padStart(2, "0")}`;
}

export async function generateFolhaPontoPDF(opts: GenerateFolhaPontoOptions): Promise<Uint8Array> {
  const { workerName, mes, logs } = opts;

  const doc = await PDFDocument.create();
  const fontReg  = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

  let page = doc.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H;

  const drawHeader = (continuation: boolean) => {
    const headerH = continuation ? 30 : 60;
    page.drawRectangle({ x: 0, y: PAGE_H - headerH, width: PAGE_W, height: headerH, color: NAVY });
    if (continuation) {
      page.drawText("MAGNETIC PLACE · Folha de Ponto (continuação)", {
        x: MARGIN, y: PAGE_H - 19, size: 8, font: fontReg, color: SLATE_BLUE,
      });
    } else {
      page.drawText("MAGNETIC PLACE", { x: MARGIN, y: PAGE_H - 28, size: 17, font: fontBold, color: WHITE });
      page.drawText("Unipessoal, Lda", { x: MARGIN, y: PAGE_H - 44, size: 8, font: fontReg, color: SLATE_BLUE });
      const [yy, mm] = mes.split("-").map(Number);
      const mesLabel = `${MESES_PT[(mm || 1) - 1]} de ${yy}`;
      const title = `Folha de Ponto · ${mesLabel}`;
      const titleW = fontBold.widthOfTextAtSize(title, 12);
      page.drawText(title, { x: PAGE_W - MARGIN - titleW, y: PAGE_H - 24, size: 12, font: fontBold, color: WHITE });
      const sub = workerName.toUpperCase();
      const subW = fontReg.widthOfTextAtSize(sub, 9);
      page.drawText(sub, { x: PAGE_W - MARGIN - subW, y: PAGE_H - 40, size: 9, font: fontReg, color: SLATE_BLUE });
    }
    page.drawRectangle({ x: 0, y: PAGE_H - headerH - 3, width: PAGE_W, height: 3, color: ORANGE });
    y = PAGE_H - headerH - 20;
  };

  drawHeader(false);

  // ── Colunas da tabela ─────────────────────────────────────────
  const cols = [
    { key: "dia",      label: "Dia",      w: 70 },
    { key: "entrada",  label: "Entrada",  w: 55 },
    { key: "iDesc",    label: "I. Desc",  w: 55 },
    { key: "fDesc",    label: "F. Desc",  w: 55 },
    { key: "saida",    label: "Saída",    w: 55 },
    { key: "total",    label: "Total",    w: 55 },
    { key: "cliente",  label: "Cliente",  w: 180 },
    { key: "coment",   label: "Comentário", w: CONTENT_W - (70 + 55 * 4 + 180) },
  ];
  const colX: number[] = [];
  let acc = MARGIN;
  for (const c of cols) { colX.push(acc); acc += c.w; }

  const ROW_H = 15;

  const ensureSpace = (needed: number) => {
    if (y - needed < MARGIN + 20) {
      page = doc.addPage([PAGE_W, PAGE_H]);
      drawHeader(true);
    }
  };

  const drawTableHeader = () => {
    ensureSpace(ROW_H + 4);
    page.drawRectangle({ x: MARGIN, y: y - ROW_H, width: CONTENT_W, height: ROW_H, color: rgb(0.94, 0.95, 0.97) });
    cols.forEach((c, i) => {
      page.drawText(c.label, { x: colX[i] + 4, y: y - ROW_H + 4, size: 7.5, font: fontBold, color: LIGHT_TEXT });
    });
    y -= ROW_H;
  };

  // ── Agrupar logs por semana ISO ─────────────────────────────────
  const byWeek = new Map<number, LogEntry[]>();
  const sorted = [...logs].sort((a, b) => a.date.localeCompare(b.date));
  for (const log of sorted) {
    const w = isoWeek(log.date);
    if (!byWeek.has(w)) byWeek.set(w, []);
    byWeek.get(w)!.push(log);
  }

  let totalMes = 0;
  let rowIdx = 0;

  for (const [weekNum, weekLogs] of [...byWeek.entries()].sort((a, b) => a[0] - b[0])) {
    ensureSpace(ROW_H + 4);
    page.drawRectangle({ x: MARGIN, y: y - ROW_H, width: CONTENT_W, height: ROW_H, color: rgb(0.90, 0.92, 0.95) });
    page.drawText(`SEMANA ${weekNum}`, { x: MARGIN + 4, y: y - ROW_H + 4, size: 7.5, font: fontBold, color: NAVY });
    let totalSemana = 0;
    for (const log of weekLogs) totalSemana += log.hours ?? calcDuration(log.startTime, log.endTime, log.breakStart, log.breakEnd);
    const semanaLabel = `Total semanal: ${formatHours(totalSemana)}`;
    const semanaW = fontBold.widthOfTextAtSize(semanaLabel, 7.5);
    page.drawText(semanaLabel, { x: MARGIN + CONTENT_W - semanaW - 4, y: y - ROW_H + 4, size: 7.5, font: fontBold, color: NAVY });
    y -= ROW_H;

    drawTableHeader();

    for (const log of weekLogs) {
      ensureSpace(ROW_H + 2);
      const hours = log.hours ?? calcDuration(log.startTime, log.endTime, log.breakStart, log.breakEnd);
      totalMes += hours;
      const dateObj = new Date(log.date + "T00:00:00Z");
      const dayLabel = `${dateObj.getUTCDate()} ${DIAS_PT[dateObj.getUTCDay()]}`;

      if (rowIdx % 2 === 1) {
        page.drawRectangle({ x: MARGIN, y: y - ROW_H, width: CONTENT_W, height: ROW_H, color: ROW_ALT });
      }
      rowIdx++;

      const values = [
        dayLabel,
        log.startTime || "—",
        log.breakStart || "—",
        log.breakEnd || "—",
        log.endTime || "—",
        formatHours(hours),
        log.clientName || "—",
        (log.description || "").slice(0, 60),
      ];
      values.forEach((v, i) => {
        page.drawText(v, { x: colX[i] + 4, y: y - ROW_H + 4, size: 7.5, font: fontReg, color: DARK_TEXT });
      });
      y -= ROW_H;
    }
    y -= 6;
  }

  // ── Resumo mensal ─────────────────────────────────────────────
  ensureSpace(40);
  y -= 6;
  page.drawLine({ start: { x: MARGIN, y }, end: { x: MARGIN + CONTENT_W, y }, thickness: 1, color: NAVY });
  y -= 18;
  page.drawText("TOTAL REGISTADO NO MÊS", { x: MARGIN, y, size: 9, font: fontBold, color: LIGHT_TEXT });
  const totalLabel = formatHours(totalMes);
  const totalW = fontBold.widthOfTextAtSize(totalLabel, 14);
  page.drawText(totalLabel, { x: MARGIN + CONTENT_W - totalW, y: y - 3, size: 14, font: fontBold, color: NAVY });

  return doc.save();
}
