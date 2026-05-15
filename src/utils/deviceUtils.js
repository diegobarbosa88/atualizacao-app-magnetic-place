// Parse navigator.userAgent into a short "Browser/OS" label.
// Examples: "Chrome/macOS", "Firefox/Windows", "Safari/iOS".
export function parseDeviceLabel(ua = navigator.userAgent || '') {
  const browser = /Edg\//.test(ua) ? 'Edge'
    : /OPR\/|Opera/.test(ua) ? 'Opera'
    : /Chrome\//.test(ua) ? 'Chrome'
    : /Firefox\//.test(ua) ? 'Firefox'
    : /Safari\//.test(ua) ? 'Safari'
    : 'Browser';

  const os = /Windows NT/.test(ua) ? 'Windows'
    : /Mac OS X|Macintosh/.test(ua) ? 'macOS'
    : /Android/.test(ua) ? 'Android'
    : /iPhone|iPad|iPod/.test(ua) ? 'iOS'
    : /Linux/.test(ua) ? 'Linux'
    : 'OS';

  return `${browser}/${os}`;
}

// Fetch public IP (best-effort, returns 'N/D' on failure).
export async function fetchPublicIp() {
  try {
    const res = await fetch('https://api.ipify.org?format=json');
    if (!res.ok) return 'N/D';
    const data = await res.json();
    return data.ip || 'N/D';
  } catch {
    return 'N/D';
  }
}

// Derive a short, stable Token ID from an ISO timestamp.
// Example: '2026-05-14T22:31:43.000Z' -> '19E230148BE' (11 hex chars uppercase).
export function tokenIdFromDate(isoString) {
  const ms = isoString ? new Date(isoString).getTime() : Date.now();
  return ms.toString(16).toUpperCase().padStart(11, '0').slice(-11);
}

// Format ISO date as 'DD.MM.YYYY // HH:MM'.
export function formatStampDateTime(isoString) {
  if (!isoString) return '';
  const d = new Date(isoString);
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} // ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
