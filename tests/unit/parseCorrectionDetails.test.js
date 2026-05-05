import { describe, it, expect } from 'vitest';

const parseCorrectionDetails = (message, targetClientId = null, targetMonth = null) => {
  const details = { workers: [], monthStr: "", clientId: targetClientId, month: targetMonth };

  const clientMatch = message.match(/(?:⚠️ PEDIDO DE CORREÇÃO|💬 MENSAGEM DE DIVERGÊNCIA): (.+)\n/);
  if (clientMatch) details.clientName = clientMatch[1].trim();

  const periodMatch = message.match(/📅 Período: (.+)\n/);
  if (periodMatch) {
    details.monthLabel = periodMatch[1].trim();
    const yearMatch = details.monthLabel.match(/\d{4}/);
    if (yearMatch) details.year = yearMatch[0];
  }

  const justificationMatch = message.match(/💬 JUSTIFICAÇÃO:\n"(.+)"/);
  if (justificationMatch) details.justification = justificationMatch[1].trim();

  const isNewFormat = message.includes('👥 DETALHES POR COLABORADOR');
  const isQuickReportMessage = message.includes('💬 MENSAGEM DE DIVERGÊNCIA');

  if (isNewFormat) {
    const workerParts = message.split('👤 ');
    workerParts.shift();

    workerParts.forEach(part => {
      const lines = part.split('\n');
      const nameLine = lines[0].trim();
      const idMatch = nameLine.match(/(.+) \[ID:(.+)\]/);
      const workerName = idMatch ? idMatch[1].trim() : nameLine;
      const workerId = idMatch ? idMatch[2].trim() : null;

      const totalMatch = part.match(/Total: ([\d.]+)h ➔ ([\d.]+)h/);
      const suggestedTotal = totalMatch ? parseFloat(totalMatch[2]) : 0;
      const originalTotal = totalMatch ? parseFloat(totalMatch[1]) : 0;

      const changes = [];
      const dayParts = part.split('   • ');
      dayParts.shift();

      dayParts.forEach(dayPart => {
        const dayLines = dayPart.split('\n');
        const dateLabel = dayLines[0].replace(':', '').trim();

        const shiftMatch = dayPart.match(/- Turno: (.*?) ➔ (.*?)\n/);
        const breakMatch = dayPart.match(/- Pausa: (.*?) ➔ (.*?)\n/);
        const hourMatch = dayPart.match(/- Horas: (.*?) ➔ (.*?)\n/);

        if (shiftMatch) {
          const editedShift = shiftMatch[2].trim();
          const originalShift = shiftMatch[1].trim();
          const isClearedShift = (editedShift === '--:--' || editedShift === '--:' ||
            (editedShift.startsWith('--:') && editedShift.includes('-----')));
          const [e, x] = isClearedShift
            ? ['--:--', '--:--']
            : editedShift.includes('-') ? editedShift.split('-') : ['--:--', '--:--'];
          const [origEntry, origExit] = (originalShift && originalShift !== '--' && originalShift.includes('-') && originalShift !== '--:--') ? originalShift.split('-') : ['--:--', '--:--'];

          const originalBreak = breakMatch ? breakMatch[1].trim() : '--:--';
          const editedBreak = breakMatch ? breakMatch[2].trim() : '--:--';
          const [bs, be] = (editedBreak.includes('-') && editedBreak !== '--:--') ? editedBreak.split('-') : ['--:--', '--:--'];
          const [obs, obsEnd] = originalBreak.includes('-') ? originalBreak.split('-') : ['--:--', '--:--'];

          const dayRecord = {
            dateLabel,
            date: dateLabel,
            originalShift: originalShift,
            entry: origEntry === 'undefined' ? '--:--' : origEntry,
            exit: origExit === 'undefined' ? '--:--' : origExit,
            editedEntry: e,
            editedExit: x,
            originalBreak: originalBreak,
            editedBreakStart: bs === 'undefined' ? '--:--' : bs,
            editedBreakEnd: be === 'undefined' ? '--:--' : be,
            breakStart: obs === 'undefined' ? '--:--' : obs,
            breakEnd: obsEnd === 'undefined' ? '--:--' : obsEnd,
            originalHours: hourMatch ? parseFloat(hourMatch[1].replace('h', '')) : 0,
            editedHours: hourMatch ? parseFloat(hourMatch[2].replace('h', '')) : 0
          };

          changes.push(dayRecord);
        }
      });

      details.workers.push({ id: workerId, name: workerName, totalHours: originalTotal, editedTotalHours: suggestedTotal, dailyRecords: changes });
    });
  }

  return details;
};

describe('parseCorrectionDetails', () => {
  const precisionReportMessage = `⚠️ PEDIDO DE CORREÇÃO: EMPRESA TESTE
📅 Período: maio de 2026

👥 DETALHES POR COLABORADOR:

👤 JOÃO SILVA [ID:w123]
   Total: 40h ➔ 42h (2.00h)
   Alterações:
   • 2026-05-01:
     - Turno: 08:00-17:00 ➔ 08:00-18:00
     - Pausa: 12:00-13:00 ➔ 12:00-13:00
     - Horas: 8h ➔ 9h
   • 2026-05-02:
     - Turno: 08:00-17:00 ➔ 08:00-17:00
     - Pausa: 12:00-13:00 ➔ 12:00-13:00
     - Horas: 8h ➔ 8h

💬 JUSTIFICAÇÃO:
"Horário alterado por motivo de projeto urgente"`;

  const quickReportMessage = `💬 MENSAGEM DE DIVERGÊNCIA: CLIENTE ABC
📅 Período: abril de 2026

📊 RESUMO GERAL:
• Total Original: 160h
• Novo Total Sugerido: 160h
• Diferença: 0.00h

👥 DETALHES POR COLABORADOR:

👤 MARIA SANTOS [ID:w456]
   Total: 160h ➔ 160h (0.00h)
   Alterações:
   • 2026-04-01:
     - Turno: 09:00-18:00 ➔ 09:00-18:00
     - Pausa: 12:30-13:30 ➔ 12:30-13:30
     - Horas: 8h ➔ 8h

💬 JUSTIFICAÇÃO:
"Sem alterações, apenas confirmando"`;

  it('should parse client name from precision report', () => {
    const result = parseCorrectionDetails(precisionReportMessage);
    expect(result.clientName).toBe('EMPRESA TESTE');
  });

  it('should parse month label from precision report', () => {
    const result = parseCorrectionDetails(precisionReportMessage);
    expect(result.monthLabel).toBe('maio de 2026');
  });

  it('should parse workers from precision report', () => {
    const result = parseCorrectionDetails(precisionReportMessage);
    expect(result.workers).toHaveLength(1);
    expect(result.workers[0].name).toBe('JOÃO SILVA');
    expect(result.workers[0].id).toBe('w123');
  });

  it('should parse worker totals from precision report', () => {
    const result = parseCorrectionDetails(precisionReportMessage);
    expect(result.workers[0].totalHours).toBe(40);
    expect(result.workers[0].editedTotalHours).toBe(42);
  });

  it('should parse daily records from precision report', () => {
    const result = parseCorrectionDetails(precisionReportMessage);
    expect(result.workers[0].dailyRecords).toHaveLength(2);
    expect(result.workers[0].dailyRecords[0].date).toBe('2026-05-01');
    expect(result.workers[0].dailyRecords[0].entry).toBe('08:00');
    expect(result.workers[0].dailyRecords[0].exit).toBe('17:00');
    expect(result.workers[0].dailyRecords[0].editedEntry).toBe('08:00');
    expect(result.workers[0].dailyRecords[0].editedExit).toBe('18:00');
  });

  it('should parse justification from precision report', () => {
    const result = parseCorrectionDetails(precisionReportMessage);
    expect(result.justification).toBe('Horário alterado por motivo de projeto urgente');
  });

  it('should parse quick report message correctly', () => {
    const result = parseCorrectionDetails(quickReportMessage);
    expect(result.clientName).toBe('CLIENTE ABC');
    expect(result.monthLabel).toBe('abril de 2026');
  });

  it('should handle empty message gracefully', () => {
    const result = parseCorrectionDetails('');
    expect(result.workers).toHaveLength(0);
    expect(result.clientName).toBeUndefined();
  });

  it('should handle malformed messages gracefully', () => {
    const result = parseCorrectionDetails('not a valid message');
    expect(result.workers).toHaveLength(0);
  });

  it('should parse cleared day patterns (--:-- entries)', () => {
    const clearedMessage = `⚠️ PEDIDO DE CORREÇÃO: TESTE
📅 Período: maio de 2026

👥 DETALHES POR COLABORADOR:

👤 WORKER [ID:w1]
   Total: 8h ➔ 0h (-8.00h)
   Alterações:
   • 2026-05-01:
     - Turno: 08:00-17:00 ➔ --:-----:--
     - Pausa: 12:00-13:00 ➔ --:-----
     - Horas: 8h ➔ 0h

💬 JUSTIFICAÇÃO:
"Dia de folga"`;

    const result = parseCorrectionDetails(clearedMessage);
    expect(result.workers[0].dailyRecords[0].editedEntry).toBe('--:--');
    expect(result.workers[0].dailyRecords[0].editedExit).toBe('--:--');
    expect(result.workers[0].dailyRecords[0].editedHours).toBe(0);
  });
});
