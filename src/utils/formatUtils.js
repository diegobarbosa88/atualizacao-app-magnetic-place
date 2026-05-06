
/**
 * Calcula a duração em horas entre dois horários com pausa opcional.
 * @param {string|object} entry Or startTime string
 * @param {string} exit Or endTime string
 * @param {string} breakStart 
 * @param {string} breakEnd 
 * @returns {number}
 */
export const calculateDuration = (entry, exit, breakStart, breakEnd) => {
  // Handle object input (Legacy support if needed)
  let s, e, bs, be;
  if (typeof entry === 'object' && entry !== null) {
    s = entry.startTime;
    e = entry.endTime;
    bs = entry.breakStart;
    be = entry.breakEnd;
  } else {
    s = entry;
    e = exit;
    bs = breakStart;
    be = breakEnd;
  }

  if (!s || !e || s === '--:--' || e === '--:--') return 0;
  const [eh, em] = s.split(':').map(Number);
  const [xh, xm] = e.split(':').map(Number);
  let diffMins = (xh * 60 + xm) - (eh * 60 + em);
  if (diffMins < 0) diffMins += 24 * 60;

  if (bs && be && bs !== '--:--' && be !== '--:--') {
    const [bsh, bsm] = bs.split(':').map(Number);
    const [beh, bem] = be.split(':').map(Number);
    let breakDiffMins = (beh * 60 + bem) - (bsh * 60 + bsm);
    if (breakDiffMins < 0) breakDiffMins += 24 * 60;
    diffMins -= breakDiffMins;
  }

  return Number(Math.max(0, diffMins / 60).toFixed(2));
};

/**
 * Formata um valor numérico de horas para string (ex: 8.5 -> "8h30").
 * @param {number} h 
 * @returns {string}
 */
export const formatHours = (h) => {
  const hours = Math.floor(h);
  const minutes = Math.round((h - hours) * 60);
  return `${hours}h${minutes === 0 ? '00' : minutes.toString().padStart(2, '0')}`;
};

/**
 * Retorna a configuração de horário para um dia específico da semana.
 * @param {object} schedule 
 * @param {string} dateStr 
 * @returns {object|null}
 */
export const getScheduleForDay = (schedule, dateStr) => {
  if (!schedule) return null;
  const d = new Date(dateStr).getDay();
  if (schedule.isAdvanced && schedule.dailyConfigs && schedule.dailyConfigs[d]) {
    return schedule.dailyConfigs[d].isActive ? schedule.dailyConfigs[d] : null;
  }
  const allowedDays = schedule.weekdays || [1, 2, 3, 4, 5];
  if (allowedDays.includes(d)) {
    return { 
      startTime: schedule.startTime, 
      breakStart: schedule.breakStart, 
      breakEnd: schedule.breakEnd, 
      endTime: schedule.endTime 
    };
  }
  return null;
};

/**
 * Calcula o total de horas esperadas para um mês baseado num horário.
 * @param {object} schedule 
 * @param {Date} targetDate 
 * @returns {number}
 */
export const calculateExpectedMonthlyHours = (schedule, targetDate) => {
  if (!schedule) return 0;
  const daysInMonth = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0).getDate();
  let totalHours = 0;
  for (let i = 1; i <= daysInMonth; i++) {
    const ds = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
    const dayConfig = getScheduleForDay(schedule, ds);
    if (dayConfig) {
      totalHours += calculateDuration(dayConfig.startTime, dayConfig.endTime, dayConfig.breakStart, dayConfig.breakEnd);
    }
  }
  return totalHours;
};

/**
 * Calcula o total de horas esperadas para um dia específico.
 * @param {object} schedule 
 * @param {string} dateStr 
 * @returns {number}
 */
export const calculateExpectedDailyHours = (schedule, dateStr) => {
  if (!schedule) return 0;
  const dayConfig = getScheduleForDay(schedule, dateStr);
  if (!dayConfig) return 0;
  return calculateDuration(dayConfig.startTime, dayConfig.endTime, dayConfig.breakStart, dayConfig.breakEnd);
};

/**
 * Formata valor para moeda Euro.
 * @param {number} val 
 * @returns {string}
 */
export const formatCurrency = (val) => {
  return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(val || 0);
};

/**
 * Prepara valor de tempo para input HTML.
 * @param {string} val 
 * @returns {string}
 */
export const toTimeInputValue = (val) => val === '--:--' ? '' : (val || '');
