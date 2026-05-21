const RAD = Math.PI / 180;

export function distanceMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * RAD;
  const dLng = (lng2 - lng1) * RAD;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * RAD) * Math.cos(lat2 * RAD) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function isWithinGeofence(userLat, userLng, unitLat, unitLng, radiusM = 200) {
  if (unitLat == null || unitLng == null) return null; // sem geofence configurada
  return distanceMeters(userLat, userLng, unitLat, unitLng) <= radiusM;
}

// Retorna { lat, lng } ou lança erro
export function getCurrentPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocalização não suportada neste dispositivo.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => reject(new Error(err.message || 'Erro ao obter localização.')),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
    );
  });
}
