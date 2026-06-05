import { useState, useEffect } from 'react';
import { getCurrentPosition, isWithinGeofence, distanceMeters } from '../../../utils/geoUtils';
import { roundTimeToIntervalTimeUp, roundTimeToIntervalTimeDown } from '../../../utils/timeUtils';
import { calculateDuration } from '../../../utils/formatUtils';
import { toISODateLocal } from '../../../utils/dateUtils';

export function useWorkerGeo({ currentUser, clients, logs, systemSettings, saveToDb, isLimitedWorker, handleSaveEntry, setMainFormData }) {
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoSuggestion, setGeoSuggestion] = useState(null);
  const [geoSuggestionDismissed, setGeoSuggestionDismissed] = useState(false);
  const [geoActionLoading, setGeoActionLoading] = useState(false);

  const getGpsSilent = async () => {
    try { return await getCurrentPosition(); } catch { return null; }
  };

  const getClientTime = (clientId) => {
    const client = clients.find(c => c.id === clientId);
    const tz = client?.timezone || 'Europe/Madrid';
    const now = new Date();
    const time = now.toLocaleTimeString('pt-PT', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false });
    const date = now.toLocaleDateString('en-CA', { timeZone: tz });
    return { time, date };
  };

  const nowTimeStrForEntry = () => {
    const clientId = currentUser?.defaultClientId;
    if (!clientId) {
      const now = new Date();
      return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    }
    return getClientTime(clientId).time;
  };

  const nowTimeStrForExit = () => {
    const clientId = currentUser?.defaultClientId;
    if (!clientId) {
      const now = new Date();
      return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    }
    return getClientTime(clientId).time;
  };

  const handleSaveWithGeoCheck = async (formData, isMain, ds) => {
    const client = clients.find(c => c.id === formData.clientId);
    let enriched = formData;
    if (client?.lat != null && client?.lng != null) {
      setGeoLoading(true);
      try {
        const { lat, lng } = await getCurrentPosition();
        const within = isWithinGeofence(lat, lng, client.lat, client.lng, client.geo_radius_m ?? 200);
        if (!within) {
          const dist = Math.round(distanceMeters(lat, lng, client.lat, client.lng));
          const ok = window.confirm(`Estás a ${dist} m da unidade (raio: ${client.geo_radius_m ?? 200} m). Confirmas o registo na mesma?`);
          if (!ok) { setGeoLoading(false); return; }
        }
        enriched = { ...formData, check_in_lat: lat, check_in_lng: lng, geo_verified: within };
      } catch (err) {
        console.warn('[WorkerDashboard] GPS unavailable:', err.message);
      } finally {
        setGeoLoading(false);
      }
    }
    handleSaveEntry(enriched, isMain, ds, (resetClientId) => {
      setMainFormData({ id: null, date: toISODateLocal(new Date()), clientId: resetClientId || currentUser?.defaultClientId || '', startTime: '', breakStart: '', breakEnd: '', endTime: '', description: '' });
    });
  };

  // Sugestão de entrada/saída ao abrir o portal — só para workers limitados
  useEffect(() => {
    if (!currentUser || geoSuggestionDismissed) return;
    if (!isLimitedWorker) return;
    const client = clients.find(c => c.id === currentUser.defaultClientId);
    if (!client) return;

    const today = new Date().toLocaleDateString('en-CA');
    const todayWorkerLogs = logs.filter(l =>
      l.date === today &&
      String(l.workerId) === String(currentUser.id) &&
      String(l.clientId) === String(currentUser.defaultClientId)
    );
    const openLog = todayWorkerLogs.find(l => l.startTime && !l.endTime);

    if (isLimitedWorker && currentUser.gps_enabled !== true) {
      if (openLog) {
        setGeoSuggestion({ type: 'saida', within: null, dist: null, lat: null, lng: null, client, logId: openLog.id, startTime: openLog.startTime });
      } else {
        setGeoSuggestion({ type: 'entrada', within: null, dist: null, lat: null, lng: null, client });
      }
      return;
    }

    if (currentUser.gps_enabled !== true) return;

    if (openLog) {
      setGeoSuggestion({ type: 'saida', within: null, dist: null, lat: null, lng: null, client, logId: openLog.id, startTime: openLog.startTime });
    } else {
      setGeoSuggestion({ type: 'entrada', within: null, dist: null, lat: null, lng: null, client });
    }

    if (client.lat != null && client.lng != null) {
      getCurrentPosition()
        .then(({ lat, lng }) => {
          const within = isWithinGeofence(lat, lng, client.lat, client.lng, client.geo_radius_m ?? 200);
          const dist = Math.round(distanceMeters(lat, lng, client.lat, client.lng));
          setGeoSuggestion(prev => prev ? { ...prev, within, dist, lat, lng } : prev);
        })
        .catch(() => {});
    }
  }, [currentUser?.id, logs.length, isLimitedWorker, currentUser?.gps_enabled]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleConfirmGeoSuggestion = async () => {
    if (!geoSuggestion || !currentUser) return;
    setGeoActionLoading(true);
    const entryTime = nowTimeStrForEntry();
    const exitTime = nowTimeStrForExit();
    const today = new Date().toLocaleDateString('en-CA');

    try {
      const pos = await getGpsSilent();
      const client = geoSuggestion.client;
      const lat = pos?.lat ?? null;
      const lng = pos?.lng ?? null;
      let verified = null;
      if (pos && client?.lat != null && client?.lng != null) {
        verified = isWithinGeofence(lat, lng, client.lat, client.lng, client.geo_radius_m ?? 200);
      }

      if (geoSuggestion.type === 'entrada') {
        const logId = `l${Date.now()}`;
        await saveToDb('logs', logId, {
          id: logId,
          date: today,
          workerId: currentUser.id,
          clientId: currentUser.defaultClientId,
          startTime: entryTime,
          endTime: null,
          breakStart: null,
          breakEnd: null,
          hours: 0,
          description: '',
          check_in_lat: lat,
          check_in_lng: lng,
          geo_verified: verified,
        });
      } else {
        const existingLog = logs.find(l => l.id === geoSuggestion.logId);
        if (existingLog) {
          const interval = systemSettings?.minuteInterval || 30;
          const tolerance = systemSettings?.entryToleranceMinutes ?? 10;
          const roundedStart = roundTimeToIntervalTimeUp(existingLog.startTime, interval, tolerance);
          const roundedEnd = roundTimeToIntervalTimeDown(exitTime, interval);
          const hours = calculateDuration(roundedStart, roundedEnd, existingLog.breakStart, existingLog.breakEnd);
          await saveToDb('logs', existingLog.id, {
            ...existingLog,
            endTime: exitTime,
            hours,
            check_out_lat: lat,
            check_out_lng: lng,
          });
        }
      }
      setGeoSuggestion(null);
      setGeoSuggestionDismissed(false);
    } finally {
      setGeoActionLoading(false);
    }
  };

  const handleRegistarPausa = async (tipo, todayOpenLog) => {
    if (!todayOpenLog) return;
    const timeStr = tipo === 'inicio' ? nowTimeStrForEntry() : nowTimeStrForExit();
    const pos = await getGpsSilent();
    const updates = tipo === 'inicio'
      ? { breakStart: timeStr, break_start_lat: pos?.lat ?? null, break_start_lng: pos?.lng ?? null }
      : { breakEnd: timeStr, break_end_lat: pos?.lat ?? null, break_end_lng: pos?.lng ?? null };
    await saveToDb('logs', todayOpenLog.id, { ...todayOpenLog, ...updates });
  };

  const handleRegistarSaida = async (todayOpenLog) => {
    if (!todayOpenLog) return;
    setGeoActionLoading(true);
    try {
      const pos = await getGpsSilent();
      const exitTime = nowTimeStrForExit();
      const interval = systemSettings?.minuteInterval || 30;
      const tolerance = systemSettings?.entryToleranceMinutes ?? 10;
      const roundedStart = roundTimeToIntervalTimeUp(todayOpenLog.startTime, interval, tolerance);
      const roundedEnd = roundTimeToIntervalTimeDown(exitTime, interval);
      const hours = calculateDuration(roundedStart, roundedEnd, todayOpenLog.breakStart, todayOpenLog.breakEnd);
      await saveToDb('logs', todayOpenLog.id, {
        ...todayOpenLog,
        endTime: exitTime,
        hours,
        check_out_lat: pos?.lat ?? null,
        check_out_lng: pos?.lng ?? null,
      });
      setGeoSuggestion(null);
      setGeoSuggestionDismissed(false);
    } finally {
      setGeoActionLoading(false);
    }
  };

  return {
    geoLoading,
    geoSuggestion,
    setGeoSuggestion,
    geoSuggestionDismissed,
    setGeoSuggestionDismissed,
    geoActionLoading,
    handleSaveWithGeoCheck,
    handleConfirmGeoSuggestion,
    handleRegistarPausa,
    handleRegistarSaida,
  };
}
