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
