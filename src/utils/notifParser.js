/**
 * Utility to parse notification messages into structured data for the Correction Portal.
 */
export const parseCorrectionMessage = (message) => {
  // Identify if it's a "Precision" report (has worker details section)
  const isPrecision = message.includes('👥 DETALHES POR COLABORADOR');
  
  if (isPrecision) {
    return parsePrecisionMessage(message);
  } else {
    return parseQuickMessage(message);
  }
};

const parseQuickMessage = (message) => {
  const workerMatch = message.match(/👤 (.+?)\n/) || message.match(/Colaborador: (.+?)\n/);
  const periodMatch = message.match(/📅 Período: (.+?)\n/);
  
  const clientMatch = message.match(/💬 MENSAGEM DE DIVERGÊNCIA: (.+)\n/) || message.match(/⚠️ PEDIDO DE CORREÇÃO: (.+)\n/);
  const clientName = clientMatch ? clientMatch[1].trim() : "Cliente Desconhecido";

  const diffMatch = message.match(/• Diferença: ([+-]?[\d.]+)h/);
  const diffValue = diffMatch ? diffMatch[1].trim() : "0.0";

  const justifMatch = message.match(/💬 JUSTIFICAÇÃO:\n"(.+)"/);
  const cleanMsg = justifMatch ? justifMatch[1].trim() : '';

  return {
    type: 'quick',
    workerName: clientName,
    dateRange: periodMatch ? periodMatch[1].trim() : "Data não especificada",
    message: cleanMsg || "Divergência reportada sem mensagem.",
    hoursDiscrepancy: diffValue,
    clientName
  };
};

const parsePrecisionMessage = (message) => {
  const workerParts = message.split('👤 ');
  workerParts.shift(); // Remove intro
  
  const firstWorker = workerParts[0] || "";
  const lines = firstWorker.split('\n');
  const nameLine = lines[0].trim();
  const idMatch = nameLine.match(/(.+) \[ID:(.+)\]/);
  
  const periodMatch = message.match(/📅 Período: (.+?)\n/);
  const totalMatch = firstWorker.match(/Total: ([\d.]+)h ➔ ([\d.]+)h/);

  const days = [];
  const dayParts = firstWorker.split('   • ');
  dayParts.shift();
  
  dayParts.forEach(dayPart => {
    const dateMatch = dayPart.match(/^(\d{2}\/\d{2})/);
    const shiftMatch = dayPart.match(/- Turno: (.*?) ➔ (.*?)\n/);
    const breakMatch = dayPart.match(/- Pausa: (.*?) ➔ (.*?)\n/);
    
    if (dateMatch && shiftMatch) {
      const editedShift = shiftMatch[2].trim();
      const [e, x] = editedShift.includes('-') ? editedShift.split('-') : ['--:--', '--:--'];
      
      const editedBreak = breakMatch ? breakMatch[2].trim() : '--:--';
      const [bs, be] = (editedBreak.includes('-') && editedBreak !== '--:--') ? editedBreak.split('-') : ['--:--', '--:--'];

      days.push({
        date: dateMatch[1],
        start: e,
        end: x,
        break: editedBreak === '--:--' ? '01:00' : (decimalToTime(timeToDecimal(be) - timeToDecimal(bs))) // Approximation
      });
    }
  });

  return {
    type: 'precision',
    workerName: idMatch ? idMatch[1].trim() : nameLine,
    dateRange: periodMatch ? periodMatch[1].trim() : "Mensal",
    affectedDaysCount: days.length,
    totalDifference: totalMatch ? (parseFloat(totalMatch[2]) - parseFloat(totalMatch[1])).toFixed(1) : "0.0",
    days
  };
};

const decimalToTime = (decimal) => {
  const hours = Math.floor(Math.abs(decimal));
  const minutes = Math.round((Math.abs(decimal) - hours) * 60);
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};

const timeToDecimal = (timeStr) => {
  if (!timeStr || timeStr === '--:--') return 0;
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours + (minutes / 60);
};
