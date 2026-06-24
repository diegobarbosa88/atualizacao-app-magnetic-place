import { useState, useEffect, useMemo } from 'react';
import { getCurrentPosition, isWithinGeofence, distanceMeters } from '../../../utils/geoUtils';
import { roundTimeToIntervalTimeUp, roundTimeToIntervalTimeDown } from '../../../utils/timeUtils';
import { calculateDuration } from '../../../utils/formatUtils';
import { toISODateLocal } from '../../../utils/dateUtils';

export function useWorkerGeo({ currentUser, clients, logs, systemSettings, saveToDb, isLimitedWorker, handleSaveEntry, setMainFormData }) {
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoSuggestionDismissed, setGeoSuggestionDismissed] = useState(false);
  const [geoActionLoading, setGeoActionLoading] = useState(false);
  const [geoPosition, setGeoPosition] = useState({ within: null, dist: null, lat: null, lng: null });

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

  // Sugestão de entrada/saída — derivada sincronamente dos dados actuais.
  // Usar useMemo em vez de useEffect+useState elimina problemas de timing
  // (ex: clients carregam antes de logs, efeito corre com logs vazio e fica preso em 'entrada').
  const baseSuggestion = useMemo(() => {
    if (!currentUser || geoSuggestionDismissed) return null;
    if (!isLimitedWorker) return null;

    const client = clients.find(c => c.id === currentUser.defaultClientId);
    if (!client) return null;

    const today = new Date().toLocaleDateString('en-CA');
    const todayWorkerLogs = logs.filter(l =>
      l.date === today &&
      String(l.workerId) === String(currentUser.id)
    );
    const openLog = todayWorkerLogs.find(l => l.startTime && !l.endTime);
    const hasCompletedLog = todayWorkerLogs.some(l => l.startTime && l.endTime);

    if (openLog) {
      return { type: 'saida', client, logId: openLog.id, startTime: openLog.startTime };
    }
    if (!hasCompletedLog) {
      return { type: 'entrada', client };
    }
    return null;
  }, [currentUser?.id, currentUser?.defaultClientId, isLimitedWorker, logs, clients, geoSuggestionDismissed]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sugestão final = base + coordenadas GPS (assíncronas)
  const geoSuggestion = useMemo(() => {
    if (!baseSuggestion) return null;
    return { ...baseSuggestion, ...geoPosition };
  }, [baseSuggestion, geoPosition]);

  // Fetch de posição GPS apenas quando o tipo de sugestão muda
  useEffect(() => {
    if (!baseSuggestion || currentUser?.gps_enabled !== true) {
      setGeoPosition({ within: null, dist: null, lat: null, lng: null });
      return;
    }
    const client = baseSuggestion.client;
    if (client?.lat != null && client?.lng != null) {
      getCurrentPosition()
        .then(({ lat, lng }) => {
          const within = isWithinGeofence(lat, lng, client.lat, client.lng, client.geo_radius_m ?? 200);
          const dist = Math.round(distanceMeters(lat, lng, client.lat, client.lng));
          setGeoPosition({ within, dist, lat, lng });
        })
        .catch(() => {});
    }
  }, [baseSuggestion?.type, baseSuggestion?.logId, currentUser?.gps_enabled]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleConfirmGeoSuggestion = async () => {
    if (!geoSuggestion || !currentUser) return;
    setGeoActionLoading(true);
    const entryTime = nowTimeStrForEntry();
    const exitTime = nowTimeStrForExit();
    const today = new Date().toLocaleDateString('en-CA');

    try {
      const pos = await getGpsSilent();
      const client = geoSuggestion.client;
      const lat = pos?.lat ?? geoSuggestion.lat ?? null;
      const lng = pos?.lng ?? geoSuggestion.lng ?? null;
      let verified = null;
      if (pos && client?.lat != null && client?.lng != null) {
        verified = isWithinGeofence(lat, lng, client.lat, client.lng, client.geo_radius_m ?? 200);
      }

      let saveError = null;
      if (geoSuggestion.type === 'entrada') {
        const logId = `l${Date.now()}`;
        saveError = await saveToDb('logs', logId, {
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
          source: 'gps_auto',
        });
      } else {
        const existingLog = logs.find(l => l.id === geoSuggestion.logId);
        if (existingLog) {
          const interval = systemSettings?.minuteInterval || 30;
          const tolerance = systemSettings?.entryToleranceMinutes ?? 10;
          const roundedStart = roundTimeToIntervalTimeUp(existingLog.startTime, interval, tolerance);
          const roundedEnd = roundTimeToIntervalTimeDown(exitTime, interval);
          const hours = calculateDuration(roundedStart, roundedEnd, existingLog.breakStart, existingLog.breakEnd);
          saveError = await saveToDb('logs', existingLog.id, {
            ...existingLog,
            endTime: exitTime,
            hours,
            check_out_lat: lat,
            check_out_lng: lng,
          });
        }
      }
      if (saveError) {
        alert('Erro ao guardar registo. Por favor tenta novamente.');
        return;
      }
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
      setGeoSuggestionDismissed(false);
    } finally {
      setGeoActionLoading(false);
    }
  };

  // setGeoSuggestion mantido por compatibilidade com WorkerDashboard (no-op: sugestão é derivada dos dados)
  const setGeoSuggestion = () => {};

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
