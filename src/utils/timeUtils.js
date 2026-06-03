/**
 * Converts "HH:mm" string to decimal hours.
 */
export const timeToDecimal = (timeStr) => {
  if (!timeStr || typeof timeStr !== 'string' || timeStr === '--:--') return 0;
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours + (minutes / 60);
};

/**
 * Converts decimal hours to "HH:mm" string.
 */
export const decimalToTime = (decimal) => {
  if (isNaN(decimal)) return '00:00';
  const hours = Math.floor(Math.abs(decimal));
  const minutes = Math.round((Math.abs(decimal) - hours) * 60);
  const sign = decimal < 0 ? '-' : '';
  return `${sign}${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};

/**
 * Calculates the difference between two HH:mm strings.
 */
export const calculateTimeDiff = (startTime, endTime) => {
  if (startTime === '--:--' || endTime === '--:--') return 0;
  return timeToDecimal(endTime) - timeToDecimal(startTime);
};

/**
 * Formats a decimal difference with sign and "h" suffix.
 */
export const formatDiff = (decimal) => {
  const sign = decimal > 0 ? '+' : '';
  return `${sign}${decimal.toFixed(2)}h`;
};

/**
 * Rounds current time to the nearest interval (in minutes).
 * @param {number} intervalMinutes - Interval to round to (e.g., 5, 15, 30, 60)
 * @returns {string} - Time string in "HH:MM" format
 */
export const roundTimeToInterval = (intervalMinutes = 30) => {
  const now = new Date();
  const totalMinutes = now.getHours() * 60 + now.getMinutes();
  const roundedMinutes = Math.round(totalMinutes / intervalMinutes) * intervalMinutes;
  const hours = Math.floor(roundedMinutes / 60) % 24;
  const minutes = roundedMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};

/**
 * Rounds a given time string "HH:MM" to the nearest interval.
 * @param {string} timeStr - Time string in "HH:MM" format
 * @param {number} intervalMinutes - Interval to round to (e.g., 5, 15, 30, 60)
 * @returns {string} - Rounded time string in "HH:MM" format
 */
export const roundTimeToIntervalTime = (timeStr, intervalMinutes = 30) => {
  if (!timeStr || timeStr === '--:--' || !timeStr.includes(':')) return timeStr;
  const [h, m] = timeStr.split(':').map(Number);
  if (isNaN(h) || isNaN(m)) return timeStr;
  const totalMinutes = h * 60 + m;
  const roundedMinutes = Math.round(totalMinutes / intervalMinutes) * intervalMinutes;
  const hours = Math.floor(roundedMinutes / 60) % 24;
  const minutes = roundedMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};

/**
 * Rounds a given time string "HH:MM" DOWN to the nearest interval (for exit times).
 * @param {string} timeStr - Time string in "HH:MM" format
 * @param {number} intervalMinutes - Interval to round to (e.g., 5, 15, 30, 60)
 * @returns {string} - Rounded time string in "HH:MM" format
 */
export const roundTimeToIntervalTimeDown = (timeStr, intervalMinutes = 30) => {
  if (!timeStr || timeStr === '--:--' || !timeStr.includes(':')) return timeStr;
  const [h, m] = timeStr.split(':').map(Number);
  if (isNaN(h) || isNaN(m)) return timeStr;
  const totalMinutes = h * 60 + m;
  const roundedMinutes = Math.floor(totalMinutes / intervalMinutes) * intervalMinutes;
  const hours = Math.floor(roundedMinutes / 60) % 24;
  const minutes = roundedMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};

/**
 * Rounds a given time string "HH:MM" UP to the nearest interval (for entry times).
 * If the time falls within `toleranceMinutes` of the previous interval boundary,
 * rounds DOWN instead (e.g., with interval=30 and tolerance=10: 08:05→08:00, 08:11→08:30).
 * @param {string} timeStr - Time string in "HH:MM" format
 * @param {number} intervalMinutes - Interval to round to (e.g., 5, 15, 30, 60)
 * @param {number} toleranceMinutes - Tolerance window after a boundary before rounding up (default 0)
 * @returns {string} - Rounded time string in "HH:MM" format
 */
export const roundTimeToIntervalTimeUp = (timeStr, intervalMinutes = 30, toleranceMinutes = 0) => {
  if (!timeStr || timeStr === '--:--' || !timeStr.includes(':')) return timeStr;
  const [h, m] = timeStr.split(':').map(Number);
  if (isNaN(h) || isNaN(m)) return timeStr;
  const totalMinutes = h * 60 + m;
  const minutesInInterval = totalMinutes % intervalMinutes;
  let roundedMinutes;
  if (minutesInInterval > 0 && minutesInInterval <= toleranceMinutes) {
    roundedMinutes = Math.floor(totalMinutes / intervalMinutes) * intervalMinutes;
  } else {
    roundedMinutes = Math.ceil(totalMinutes / intervalMinutes) * intervalMinutes;
  }
  const hours = Math.floor(roundedMinutes / 60) % 24;
  const minutes = roundedMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};
