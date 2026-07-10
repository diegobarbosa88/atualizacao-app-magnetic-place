import React from 'react';
import { Calendar, Activity, ChevronLeft, ChevronRight, X, LogOut, LogIn, Coffee, PlayCircle, Navigation, MapPin, CheckCircle, Edit2 } from 'lucide-react';

const calculateHoursDiff = (entry, exit, breakStart, breakEnd) => {
    if (!entry || !exit || !entry.includes(':') || !exit.includes(':')) return 0;
    const [eh, em] = entry.split(':').map(n => parseInt(n, 10) || 0);
    const [xh, xm] = exit.split(':').map(n => parseInt(n, 10) || 0);
    let diffMins = (xh * 60 + xm) - (eh * 60 + em);
    if (diffMins < 0) diffMins += 24 * 60;
    if (breakStart && breakEnd && breakStart !== '--:--' && breakEnd !== '--:--') {
        const [bsh, bsm] = breakStart.split(':').map(Number);
        const [beh, bem] = breakEnd.split(':').map(Number);
        let bDiff = (beh * 60 + bem) - (bsh * 60 + bsm);
        if (bDiff < 0) bDiff += 24 * 60;
        diffMins -= bDiff;
    }
    return Number(Math.max(0, diffMins / 60).toFixed(2));
};

const LocationDot = ({ lat, lng, verified }) => {
    if (lat == null || lng == null) return null;
    const cls = verified === true
        ? 'bg-emerald-400 shadow-[0_0_5px_rgba(52,211,153,0.8)] animate-pulse'
        : verified === false
        ? 'bg-rose-400'
        : 'bg-slate-300';
    return <span className={`inline-block w-2.5 h-2.5 rounded-full flex-shrink-0 ${cls}`} title={verified === true ? 'Na localização' : verified === false ? 'Fora da localização' : 'GPS registado'} />;
};

const mapsLink = (lat, lng) => `https://www.google.com/maps?q=${lat},${lng}`;
const moradaMapsLink = (morada) => morada ? `https://www.google.com/maps/search/${encodeURIComponent(morada)}` : null;

export default function DashboardView({ logs, workers, clients, effectiveClientId, selectedMonth, availableMonths, setSelectedMonth, originalWorkersData, originalTotal, clientData, clientObj, todayStr, activeNow, rotatingWorkerIdx, isWorkersModalOpen, setIsWorkersModalOpen, calSelectedDay, setCalSelectedDay, expandedLogLocations, setExpandedLogLocations, now, t, onManageLogs }) {
    const todayAllLogs = logs.filter(l => String(l.clientId) === String(effectiveClientId) && l.date === todayStr && l.startTime);

    const formatElapsed = (startTimeStr) => {
        const [h, m] = startTimeStr.split(':').map(Number);
        const start = new Date(now);
        start.setHours(h, m, 0, 0);
        const diffMins = Math.max(0, Math.floor((now - start) / 60000));
        if (diffMins < 1) return 'agora mesmo';
        if (diffMins < 60) return `${diffMins} min`;
        const hh = Math.floor(diffMins / 60);
        const mm = diffMins % 60;
        return mm > 0 ? `${hh}h ${mm}min` : `${hh}h`;
    };

    const renderCalLogLine = (log) => {
        const h = log.hours ?? calculateHoursDiff(log.startTime, log.endTime, log.breakStart, log.breakEnd);
        const isOpen = log.startTime && !log.endTime;
        const inBreak = isOpen && log.breakStart && !log.breakEnd;
        const worker = workers.find(w => String(w.id) === String(log.workerId || log.worker_id));
        const logHasGps = log.check_in_lat || log.check_out_lat || log.break_start_lat || log.break_end_lat;
        const isLocExpanded = expandedLogLocations.has(log.id);
        const thisClient = clients?.find(c => String(c.id) === String(effectiveClientId));
        const gpsPoints = [
            log.check_in_lat ? { label: 'Entrada', lat: log.check_in_lat, lng: log.check_in_lng, cls: 'text-emerald-700 bg-emerald-50 border-emerald-200' } : null,
            log.break_start_lat ? { label: 'Pausa ↑', lat: log.break_start_lat, lng: log.break_start_lng, cls: 'text-amber-700 bg-amber-50 border-amber-200' } : null,
            log.break_end_lat ? { label: 'Pausa ↓', lat: log.break_end_lat, lng: log.break_end_lng, cls: 'text-orange-700 bg-orange-50 border-orange-200' } : null,
            log.check_out_lat ? { label: 'Saída', lat: log.check_out_lat, lng: log.check_out_lng, cls: 'text-rose-700 bg-rose-50 border-rose-200' } : null,
        ].filter(Boolean);
        return (
            <div key={log.id} className="px-5 py-3 border-b border-slate-100 last:border-0">
                {worker && <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">{worker.name}</p>}
                <div className="flex items-center gap-3 flex-wrap">
                    <div className="flex items-center gap-1.5">
                        <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">{t('entry')}</span>
                        <span className={`text-sm font-black font-mono ${isOpen && !inBreak ? 'text-emerald-700' : 'text-slate-700'}`}>{log.startTime || '–'}</span>
                        <LocationDot lat={log.check_in_lat} lng={log.check_in_lng} verified={log.geo_verified} />
                        {isOpen && !inBreak && <span className="text-[9px] font-bold text-emerald-500">{formatElapsed(log.startTime)}</span>}
                    </div>
                    <span className="text-slate-200">|</span>
                    <div className="flex items-center gap-1.5">
                        <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">{t('break_label')}</span>
                        {log.breakStart ? (
                            <>
                                <span className={`text-sm font-black font-mono ${inBreak ? 'text-amber-600' : 'text-slate-600'}`}>{log.breakStart}{log.breakEnd ? ` → ${log.breakEnd}` : ' → …'}</span>
                                <LocationDot lat={log.break_start_lat} lng={log.break_start_lng} verified={null} />
                                {inBreak && <span className="text-[9px] font-bold text-amber-500">{formatElapsed(log.breakStart)}</span>}
                            </>
                        ) : <span className="text-slate-300 font-bold text-sm">–</span>}
                    </div>
                    <span className="text-slate-200">|</span>
                    <div className="flex items-center gap-1.5">
                        <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">{t('exit_label')}</span>
                        <span className="text-sm font-black font-mono text-slate-700">{log.endTime || '–'}</span>
                        {log.endTime && <LocationDot lat={log.check_out_lat} lng={log.check_out_lng} verified={null} />}
                    </div>
                    <span className="text-slate-200">|</span>
                    <span className="text-sm font-black text-indigo-700">{h > 0 ? `${h.toFixed(2)}h` : '–'}</span>
                    {logHasGps && (
                        <button onClick={(e) => { e.stopPropagation(); setExpandedLogLocations(prev => { const n = new Set(prev); n.has(log.id) ? n.delete(log.id) : n.add(log.id); return n; }); }}
                            className={`ml-auto flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-black transition-all ${isLocExpanded ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50'}`}>
                            <Navigation size={9} /> {t('locations')}
                        </button>
                    )}
                </div>
                {isLocExpanded && (
                    <div className="mt-2 p-3 bg-slate-50 rounded-xl border border-slate-100">
                        <div className="flex flex-wrap gap-1.5">
                            {thisClient?.morada && (
                                <a href={moradaMapsLink(thisClient.morada)} target="_blank" rel="noreferrer" className="flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-black text-indigo-700 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 transition-all">
                                    <MapPin size={10} /> {thisClient.morada}
                                </a>
                            )}
                            {gpsPoints.map(p => (
                                <a key={p.label} href={mapsLink(p.lat, p.lng)} target="_blank" rel="noreferrer" className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-black border ${p.cls} hover:opacity-75 transition-all`}>
                                    <MapPin size={10} /> {p.label}
                                </a>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="animate-fade-in space-y-7">
            <div className="flex flex-col lg:flex-row lg:items-end w-full gap-8 mb-10 pb-8 border-b border-zinc-200">
                <div className="flex-1">
                    <div className="flex items-center gap-4 mb-5">
                        <span className="px-2.5 py-1 rounded-md bg-zinc-900 text-zinc-50 text-[10px] font-bold uppercase tracking-widest shadow-sm">
                            {t('client_panel')}
                        </span>
                        <div className="w-1 h-1 rounded-full bg-zinc-300 hidden sm:block" />
                        <div className="flex items-center gap-1.5 text-sm text-zinc-500 font-medium">
                            <Calendar size={15} />
                            <span className="capitalize">{new Date().toLocaleDateString(t('locale'), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</span>
                        </div>
                    </div>
                    <div className="text-4xl md:text-4xl font-semibold text-zinc-900 tracking-tight">
                        <span className="text-zinc-400 font-light">{t('hello')},</span> {clientObj.name}
                    </div>
                    <div className="mt-3 text-zinc-500 text-xs leading-relaxed max-w-md">
                        {t('dashboard_desc')}
                    </div>
                </div>
                <div className="flex flex-col items-start lg:items-end gap-3 shrink-0 ml-auto">
                    <div className="flex items-center gap-3 px-3 py-1.5 bg-white rounded-full border border-zinc-200 shadow-sm transition-all hover:shadow-md">
                        <div className="relative flex h-2.5 w-2.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
                        </div>
                        <span className="text-sm font-semibold text-zinc-800 tracking-wide">Sistema Operacional</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-zinc-400 font-medium px-1">
                        <Activity size={12} />
                        <span>Sincronizado há instantes</span>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="bg-white rounded-[2rem] shadow-lg border border-slate-100 p-4 text-center flex flex-col items-center gap-2">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{t('period')}</p>
                    <div className="flex items-center gap-1">
                        <button
                            onClick={() => { const idx = availableMonths.indexOf(selectedMonth); if (idx < availableMonths.length - 1) setSelectedMonth(availableMonths[idx + 1]); }}
                            disabled={availableMonths.indexOf(selectedMonth) >= availableMonths.length - 1}
                            className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 disabled:opacity-20 transition-all"
                        ><ChevronLeft size={17} /></button>
                        <p className="text-2xl font-black text-slate-800 uppercase leading-tight min-w-[80px] text-center">{clientData.period || '—'}</p>
                        <button
                            onClick={() => { const idx = availableMonths.indexOf(selectedMonth); if (idx > 0) setSelectedMonth(availableMonths[idx - 1]); }}
                            disabled={availableMonths.indexOf(selectedMonth) <= 0}
                            className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 disabled:opacity-20 transition-all"
                        ><ChevronRight size={14} /></button>
                    </div>
                </div>
                <div className="bg-indigo-600 rounded-[2rem] shadow-lg shadow-indigo-200 p-6 text-center">
                    <p className="text-[9px] font-black text-indigo-300 uppercase tracking-widest mb-2">{t('total_hours')}</p>
                    <p className="text-3xl font-black text-white">{originalTotal}h</p>
                </div>
                <div className="bg-white rounded-[2rem] shadow-lg border border-slate-100 p-6 text-center col-span-2 md:col-span-1">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">{t('workers')}</p>
                    <p className="text-3xl font-black text-slate-800">{originalWorkersData.length}</p>
                </div>
            </div>

            {isWorkersModalOpen && (
                <div className="fixed inset-0 z-[9998] flex items-end sm:items-center justify-center p-4" onClick={() => setIsWorkersModalOpen(false)}>
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
                    <div className="relative w-full max-w-md bg-white rounded-[2rem] shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4 duration-300" onClick={e => e.stopPropagation()}>
                        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-emerald-50/50">
                            <div className="flex items-center gap-3">
                                <span className="relative flex h-3 w-3">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                                    <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
                                </span>
                                <h3 className="font-black text-slate-900 text-sm uppercase tracking-widest">Em serviço agora</h3>
                            </div>
                            <button onClick={() => setIsWorkersModalOpen(false)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors">
                                <X size={18} />
                            </button>
                        </div>
                        <div className="max-h-[60vh] overflow-y-auto p-2">
                            {activeNow.map((log, i) => {
                                const worker = workers.find(w => String(w.id) === String(log.workerId || log.worker_id));
                                const inBreak = log.breakStart && !log.breakEnd;
                                const elapsed = inBreak ? formatElapsed(log.breakStart) : formatElapsed(log.startTime);
                                const avatarColors = ['bg-indigo-100 text-indigo-700','bg-purple-100 text-purple-700','bg-blue-100 text-blue-700','bg-rose-100 text-rose-700','bg-amber-100 text-amber-700','bg-teal-100 text-teal-700','bg-slate-200 text-slate-700'];
                                const color = avatarColors[i % avatarColors.length];
                                const initial = (worker?.name || 'C').charAt(0).toUpperCase();
                                return (
                                    <div key={log.id} className="flex items-center justify-between p-4 hover:bg-slate-50 rounded-2xl transition-colors">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-11 h-11 rounded-full flex items-center justify-center font-black text-sm ring-4 ring-white shadow-sm ${color}`}>
                                                {initial}
                                            </div>
                                            <div>
                                                <p className="font-black text-slate-900 text-sm">{worker?.name || 'Colaborador'}</p>
                                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{worker?.profissao || worker?.role || '—'}</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-lg inline-block ${inBreak ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                                {inBreak ? t('on_break') : elapsed}
                                            </p>
                                            <p className="text-[9px] font-bold text-slate-400 mt-1 uppercase tracking-widest">
                                                Desde {log.startTime}
                                            </p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end">
                            <button onClick={() => setIsWorkersModalOpen(false)} className="px-6 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-black text-xs uppercase tracking-widest rounded-xl transition-colors">
                                Fechar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {selectedMonth && (() => {
                const [calYear, calMonth] = selectedMonth.split('-').map(Number);
                const logsByDate = {};
                logs
                    .filter(l => String(l.clientId) === String(effectiveClientId)
                        && l.date && l.date.substring(0, 7) === selectedMonth)
                    .forEach(l => { if (!logsByDate[l.date]) logsByDate[l.date] = []; logsByDate[l.date].push(l); });
                const firstDay = new Date(calYear, calMonth - 1, 1);
                const daysInMonth = new Date(calYear, calMonth, 0).getDate();
                const startOffset = (firstDay.getDay() + 6) % 7;
                const totalCells = Math.ceil((startOffset + daysInMonth) / 7) * 7;
                const weekDayLabels = t('week_days');
                const calTodayStr = new Date().toLocaleDateString('en-CA');
                const selectedDayLogs = calSelectedDay ? (logsByDate[calSelectedDay] || []) : [];

                return (
                    <section className="space-y-6">
                        <div className="bg-white rounded-xl shadow-xl border border-slate-100 overflow-hidden">
                            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                                <h3 className="font-black text-slate-800 text-lg uppercase tracking-tighter">{t('calendar')} — {new Date(calYear, calMonth - 1).toLocaleDateString(t('locale'), { month: 'long', year: 'numeric' })}</h3>
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{Object.keys(logsByDate).length} {t('days')}</span>
                            </div>
                            <div className="grid grid-cols-7 border-b border-slate-100 px-1">
                                {weekDayLabels.map(d => (
                                    <div key={d} className="py-2 text-center text-[11px] font-black uppercase tracking-widest text-slate-400">{d}</div>
                                ))}
                            </div>
                            <div className="grid grid-cols-7 p-1 gap-0">
                                {Array.from({ length: totalCells }).map((_, idx) => {
                                    const dayNum = idx - startOffset + 1;
                                    if (dayNum < 1 || dayNum > daysInMonth) {
                                        return <div key={idx} className="aspect-[3/2] border-b border-r border-slate-50 last:border-r-0 bg-slate-50/40 rounded-xl m-0.5" />;
                                    }
                                    const dateStr = `${calYear}-${String(calMonth).padStart(2,'0')}-${String(dayNum).padStart(2,'0')}`;
                                    const dayLogs = logsByDate[dateStr] || [];
                                    const hasLogs = dayLogs.length > 0;
                                    const dayTotal = dayLogs.reduce((acc, l) => acc + (l.hours ?? calculateHoursDiff(l.startTime, l.endTime, l.breakStart, l.breakEnd)), 0);
                                    const isToday = dateStr === calTodayStr;
                                    const isSelected = calSelectedDay === dateStr;
                                    const hasOpen = dayLogs.some(l => l.startTime && !l.endTime);

                                    if (isToday) {
                                        const currentLog = todayAllLogs.length > 0 ? todayAllLogs[rotatingWorkerIdx % todayAllLogs.length] : null;
                                        const currentW = currentLog ? workers.find(wk => String(wk.id) === String(currentLog.workerId || currentLog.worker_id)) : null;
                                        const hasExited = !!currentLog?.endTime;
                                        const inBreak = !hasExited && currentLog?.breakStart && !currentLog?.breakEnd;
                                        const returnedBreak = !hasExited && currentLog?.breakStart && currentLog?.breakEnd;
                                        const statusIcon = hasExited ? <LogOut size={17} className="text-rose-400" /> : inBreak ? <Coffee size={17} className="text-amber-300" /> : returnedBreak ? <PlayCircle size={17} className="text-sky-300" /> : <LogIn size={17} className="text-emerald-300" />;
                                        const statusTime = hasExited ? currentLog.endTime : inBreak ? currentLog.breakStart : returnedBreak ? currentLog.breakEnd : currentLog?.startTime;
                                        const wIdx = todayAllLogs.length > 0 ? rotatingWorkerIdx % todayAllLogs.length : 0;
                                        return (
                                            <div key={dateStr}
                                                onClick={() => setCalSelectedDay(isSelected ? null : dateStr)}
                                                className="relative m-0.3 rounded-xl overflow-hidden cursor-pointer select-none flex flex-col"
                                                style={{ background: 'linear-gradient(160deg, #058664 0%, #077e5c 60%, #06966d 100%)', minHeight: '100%' }}>
                                                <div className="flex items-center justify-between px-3 pt-0.5">
                                                    <span className="text-s font-black text-white/60 leading-none">{dayNum}</span>
                                                    <div className="flex items-center gap-1">
                                                        <span className="text-[7px] font-black text-emerald-300 uppercase tracking-widest">ao vivo</span>
                                                        <span className="relative flex h-2.7 w-2.7">
                                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-300 opacity-75" />
                                                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
                                                        </span>
                                                    </div>
                                                </div>
                                                {currentLog && currentW ? (
                                                    <div className="flex-1 flex flex-col items-center justify-start text-center px-1 pt-0.1 pb-0 gap-0.3">
                                                        <div className="text-[11.7px] gap-1 mt-1.5 font-black text-white leading-tight w-full truncate">{currentW.name}</div>
                                                        <p className="text-[9.9px] font-bold text-emerald-400 uppercase tracking-wide leading-none w-full truncate mt-0.7">{currentW.profissao || currentW.role || '—'}</p>
                                                        <div className="flex items-center justify-center gap-1 mt-1.5 leading-none">{statusIcon}<span className="font-black text-white text-xs">{statusTime}</span></div>
                                                        {todayAllLogs.length > 1 && (
                                                            <div className="flex gap-0.5 mt-5 w-full px-1">
                                                                {todayAllLogs.map((l, di) => (
                                                                    <span key={di} className={`h-0.5 flex-1 rounded-full ${di === wIdx ? (l.endTime ? 'bg-rose-400' : 'bg-emerald-300') : 'bg-white/20'}`} />
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <div className="flex-1 flex items-center justify-center">
                                                        <p className="text-[9px] font-bold text-emerald-300/60 text-center">{t('nobody_working')}</p>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    }
                                    return (
                                        <div key={dateStr}
                                            onClick={() => setCalSelectedDay(isSelected ? null : dateStr)}
                                            className={`relative aspect-[3/2] p-2 rounded-xl m-0.5 flex flex-col cursor-pointer transition-all select-none ${isSelected ? 'bg-indigo-600' : hasLogs ? 'hover:bg-indigo-50 bg-white border border-indigo-100' : 'hover:bg-slate-50 bg-white border border-slate-100'}`}>
                                            <span className={`text-xs font-black leading-none ${isSelected ? 'text-white/70' : hasLogs ? 'text-slate-400' : 'text-slate-300'}`}>{dayNum}</span>
                                            {hasOpen && <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />}
                                            {hasLogs && (
                                                <div className="flex-1 flex flex-col items-center justify-center gap-0.5">
                                                    <p className={`text-base font-black leading-none ${isSelected ? 'text-white' : 'text-slate-500'}`}>{dayTotal.toFixed(1)}h</p>
                                                    <p className={`text-[10px] font-bold leading-none ${isSelected ? 'text-indigo-200' : 'text-slate-400'}`}>{dayLogs.length} {dayLogs.length === 1 ? t('record_singular') : t('record_plural')}</p>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {calSelectedDay && (
                            <div className="fixed inset-0 z-[9998] flex items-end sm:items-center justify-center p-4" onClick={() => setCalSelectedDay(null)}>
                                <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
                                <div className="relative w-full max-w-lg bg-white rounded-[2rem] shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4 duration-300" onClick={e => e.stopPropagation()}>
                                    <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-indigo-50/60">
                                        <div>
                                            <p className="text-[9px] font-black uppercase tracking-widest text-indigo-400">{t('day_records')}</p>
                                            <p className="text-base font-black text-slate-800 mt-0.5">
                                                {new Date(...calSelectedDay.split('-').map((v,i) => i===1 ? Number(v)-1 : Number(v))).toLocaleDateString(t('locale'), { weekday: 'long', day: 'numeric', month: 'long' })}
                                            </p>
                                        </div>
                                        <button onClick={() => setCalSelectedDay(null)} className="p-2 rounded-xl hover:bg-slate-100 text-slate-400 transition-all"><X size={16} /></button>
                                    </div>
                                    <div className="max-h-[60vh] overflow-y-auto">
                                        {selectedDayLogs.length === 0
                                            ? <div className="p-8 text-center text-slate-400 text-sm font-bold">{t('no_records')}</div>
                                            : selectedDayLogs.map(renderCalLogLine)
                                        }
                                    </div>
                                </div>
                            </div>
                        )}
                    </section>
                );
            })()}

            {originalWorkersData.length > 0 && (
                <section className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                    <div className="px-5 py-3 border-b border-slate-100 bg-slate-50">
                        <h3 className="font-black text-slate-400 text-xs uppercase tracking-widest">{t('workers')} — {clientData.period}</h3>
                    </div>
                    <div className="divide-y divide-slate-50">
                        {originalWorkersData.map(worker => {
                            const workerObj = workers.find(w => String(w.id) === String(worker.id));
                            return (
                                <div key={worker.id} className="px-5 py-2.5 flex items-center gap-3">
                                    <div className="w-7 h-7 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-700 font-black text-xs flex-shrink-0 uppercase">
                                        {worker.name.charAt(0)}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-black text-slate-700 text-xs truncate">{worker.name}</p>
                                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">{worker.role}</p>
                                    </div>
                                    <span className="text-sm font-black text-indigo-600">{worker.totalHours}h</span>
                                    {onManageLogs && (
                                        <button
                                            onClick={() => onManageLogs(workerObj || { id: worker.id, name: worker.name, profissao: worker.role })}
                                            className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                                            title="Gerir registos"
                                        >
                                            <Edit2 size={13} />
                                        </button>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </section>
            )}
            {originalWorkersData.length === 0 && selectedMonth && (
                <div className="bg-white rounded-[3rem] shadow-xl border border-slate-100 p-12 text-center text-slate-400 font-bold">
                    {t('no_hours')} {clientData.period}.
                </div>
            )}

            {effectiveClientId && selectedMonth && (
                <a
                    href={`${window.location.origin}${window.location.pathname}?client=${effectiveClientId}&month=${selectedMonth}`}
                    className="w-full flex items-center justify-center gap-3 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-black text-sm uppercase tracking-widest py-5 rounded-[2rem] shadow-lg shadow-indigo-200 transition-all"
                >
                    <CheckCircle size={20} />
                    {t('validate_period')}
                </a>
            )}
        </div>
    );
}
