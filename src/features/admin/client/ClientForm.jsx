import React, { useState } from 'react';
import { useApp } from '../../../context/AppContext';
import { useClient } from '../contexts/ClientContext';
import {
  Briefcase, MapPin, Euro, Building2, CreditCard, Mail, CalendarRange, Check, Navigation, Loader2, Clock,
  AlertTriangle, Info,
} from 'lucide-react';
import { getCurrentPosition } from '../../../utils/geoUtils';
import { FT } from '../../../styles/designTokens';

const FONT_TITLE = "'Barlow Condensed', sans-serif";
const FONT_MONO = "'IBM Plex Mono', monospace";

function Field({ label, icon: Icon, span2, children }) {
  return (
    <div className={`space-y-1 ${span2 ? 'md:col-span-2' : ''}`}>
      <label className="text-[10px] font-bold uppercase tracking-wider text-[#5C7086] ml-1 flex items-center gap-1.5" style={{ fontFamily: FONT_MONO }}>
        {Icon && <Icon size={11} className="opacity-70" />} {label}
      </label>
      {children}
    </div>
  );
}

const INPUT_CLS = "w-full bg-white border-[1.5px] border-[#E4E1D6] rounded-[0.85rem] py-[0.72rem] px-[0.9rem] text-[0.86rem] font-semibold text-[#222b33] outline-none shadow-sm focus:border-[var(--navy)] focus:ring-4 focus:ring-[#1B3A57]/10 transition-all";

export default function ClientForm() {
  const { schedules } = useApp();
  const { clientForm, setClientForm, clients } = useClient();

  const [geoLoading, setGeoLoading] = useState(false);
  const [geocodeLoading, setGeocodeLoading] = useState(false);

  const currentClient = clientForm.id ? clients.find(c => c.id === clientForm.id) : null;

  const handleGeocodeMorada = async () => {
    if (!clientForm.morada) return;
    setGeocodeLoading(true);
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(clientForm.morada)}&format=json&limit=1`, {
        headers: { 'Accept-Language': 'pt' }
      });
      const data = await res.json();
      if (data && data[0]) {
        setClientForm(prev => ({ ...prev, lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) }));
      } else {
        alert('Morada não encontrada. Tente uma morada mais detalhada.');
      }
    } catch {
      alert('Erro ao geocodificar a morada.');
    } finally {
      setGeocodeLoading(false);
    }
  };

  const handleUseCurrentLocation = async () => {
    setGeoLoading(true);
    try {
      const { lat, lng } = await getCurrentPosition();
      setClientForm(prev => ({ ...prev, lat, lng }));
    } catch (err) {
      alert(err.message);
    } finally {
      setGeoLoading(false);
    }
  };

  const raio = clientForm.geo_radius_m ?? 200;
  const ringSize = Math.max(46, Math.min(120, 46 + Number(raio) / 8));

  return (
    <div className="py-[1.75rem] px-[2rem]" style={{ background: '#FDFCFA' }}>
      <div className="grid grid-cols-1 lg:grid-cols-[1.62fr_1fr] gap-[1.5rem]">
        {/* COLUNA ESQUERDA */}
        <div className="space-y-5">

          {/* IDENTIFICAÇÃO */}
          <div className="bg-[#FAFAF7] border border-[#E5E1D6] rounded-[1.5rem] pt-[1.4rem] px-[1.5rem] pb-[1.6rem] space-y-5">
            <div className="flex items-center gap-2.5">
              <div className="w-[34px] h-[34px] rounded-[11px] flex items-center justify-center shrink-0" style={{ backgroundColor: 'rgba(134,154,175,0.16)', color: FT.slate }}>
                <Briefcase size={16} />
              </div>
              <div>
                <h4 className="font-bold text-[#2b3540] text-[1.2rem] leading-none" style={{ fontFamily: FONT_TITLE }}>Identificação</h4>
                <p className="text-[9.5px] font-bold uppercase tracking-widest text-[#5C7086] mt-0.5" style={{ fontFamily: FONT_MONO }}>Dados gerais do cliente</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-y-[1rem] gap-x-[1.1rem]">
              <Field label="Empresa" icon={Building2} span2>
                <input type="text" value={clientForm.name} onChange={e => setClientForm({ ...clientForm, name: e.target.value })} className={INPUT_CLS} placeholder="Nome da empresa" />
              </Field>
              <Field label="NIF" icon={CreditCard}>
                <input type="text" value={clientForm.nif || ''} onChange={e => setClientForm({ ...clientForm, nif: e.target.value })} className={INPUT_CLS} placeholder="Nº de Contribuinte" />
              </Field>
              <Field label="E-mail de contacto" icon={Mail}>
                <input type="email" value={clientForm.email || ''} onChange={e => setClientForm({ ...clientForm, email: e.target.value })} className={INPUT_CLS} placeholder="email@exemplo.pt" />
              </Field>
              <Field label="Fuso horário" icon={Clock}>
                <select
                  value={clientForm.timezone || 'Europe/Madrid'}
                  onChange={e => setClientForm({ ...clientForm, timezone: e.target.value })}
                  className={INPUT_CLS}
                >
                  {typeof Intl !== 'undefined' && Intl.supportedValuesOf ?
                    Intl.supportedValuesOf('timeZone').map(tz => (
                      <option key={tz} value={tz}>{tz}</option>
                    )) : (
                    <option value="Europe/Madrid">Europe/Madrid</option>
                  )}
                </select>
              </Field>
              <Field label="Morada" icon={MapPin} span2>
                <input type="text" value={clientForm.morada || ''} onChange={e => setClientForm({ ...clientForm, morada: e.target.value })} className={INPUT_CLS} placeholder="Morada completa" />
              </Field>

              <div className="md:col-span-2">
                <label
                  className="flex items-center justify-between gap-4 rounded-[0.9rem] px-[0.95rem] py-[0.75rem] cursor-pointer select-none"
                  style={{ background: '#FEF6E8', border: '1px solid #F3DDA8' }}
                >
                  <div className="flex items-center gap-2.5">
                    <AlertTriangle size={15} style={{ color: '#B47700' }} className="shrink-0" />
                    <div>
                      <p className="text-[0.78rem] font-bold" style={{ color: '#7A5000' }}>Modo limitado para workers</p>
                      <p className="text-[0.68rem] mt-0.5" style={{ color: '#9c7a2c' }}>Restringe o que os trabalhadores veem sobre este cliente na app</p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={clientForm.triggers_limited_mode || false}
                    onChange={e => setClientForm({ ...clientForm, triggers_limited_mode: e.target.checked })}
                    className="sr-only peer"
                  />
                  <span
                    className="relative w-[38px] h-[22px] rounded-full shrink-0 transition-colors"
                    style={{ backgroundColor: clientForm.triggers_limited_mode ? FT.orange : '#D8D2C4' }}
                  >
                    <span
                      className="absolute top-[2px] w-[18px] h-[18px] rounded-full bg-white shadow transition-all"
                      style={{ left: clientForm.triggers_limited_mode ? '18px' : '2px' }}
                    />
                  </span>
                </label>
              </div>
            </div>
          </div>

          {/* FINANCEIRO */}
          <div className="bg-[#FAFAF7] border border-[#E5E1D6] rounded-[1.5rem] pt-[1.4rem] px-[1.5rem] pb-[1.6rem] space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="w-[34px] h-[34px] rounded-[11px] flex items-center justify-center shrink-0" style={{ backgroundColor: 'rgba(235,141,0,0.14)', color: '#C97600' }}>
                <Euro size={16} />
              </div>
              <div>
                <h4 className="font-bold text-[#2b3540] text-[1.2rem] leading-none" style={{ fontFamily: FONT_TITLE }}>Financeiro</h4>
                <p className="text-[9.5px] font-bold uppercase tracking-widest text-[#5C7086] mt-0.5" style={{ fontFamily: FONT_MONO }}>Faturação por hora trabalhada</p>
              </div>
            </div>

            {currentClient && (
              <div className="relative overflow-hidden flex items-end justify-between gap-4 rounded-[1.15rem] px-[1.35rem] py-[1.15rem] mb-[1.1rem]" style={{ background: `linear-gradient(135deg, ${FT.navy} 0%, ${FT.navyMid} 100%)` }}>
                <div>
                  <p className="text-[9.5px] font-bold uppercase tracking-widest mb-1" style={{ fontFamily: FONT_MONO, color: '#9fb4c8' }}>Valor / hora atual</p>
                  <p className="font-bold leading-none text-white" style={{ fontFamily: FONT_TITLE, fontSize: '2.5rem' }}>
                    {Number(currentClient.valorHora || 0).toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-[1.1rem] font-semibold" style={{ color: '#b9c9d8' }}>€</span>
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[9px] font-bold uppercase tracking-widest" style={{ fontFamily: FONT_MONO, color: '#8ea6bc' }}>Válido desde</p>
                  <p className="text-sm font-bold text-white" style={{ fontFamily: FONT_MONO }}>
                    {currentClient.dataAlteracao ? new Date(currentClient.dataAlteracao).toLocaleDateString('pt-PT') : '—'}
                  </p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-y-[1rem] gap-x-[1.1rem]">
              <Field label="Novo valor / hora (€)" icon={Euro}>
                <input type="number" step="0.01" value={clientForm.valorHora || ''} onChange={e => setClientForm({ ...clientForm, valorHora: e.target.value })} className={INPUT_CLS} placeholder="0.00" />
              </Field>
              <Field label="Válido a partir de" icon={CalendarRange}>
                <input type="date" value={clientForm.dataAlteracao || ''} onChange={e => setClientForm({ ...clientForm, dataAlteracao: e.target.value })} className={INPUT_CLS} />
              </Field>
            </div>

            <div className="flex items-start gap-2.5 rounded-[0.85rem] px-[0.8rem] py-[0.65rem] mt-[0.9rem]" style={{ background: '#EEF2F6' }}>
              <Info size={14} style={{ color: FT.slate }} className="shrink-0 mt-0.5" />
              <p className="text-[0.72rem] leading-relaxed font-medium" style={{ color: '#51606E' }}>
                Ao atualizar o valor/hora, todos os registos futuros e os pendentes do mês atual são atualizados automaticamente com o novo valor.
              </p>
            </div>
          </div>
        </div>

        {/* COLUNA DIREITA */}
        <div className="space-y-5">

          {/* GEOLOCALIZAÇÃO */}
          <div className="bg-[#F7F8FA] border border-[#E5E1D6] rounded-[1.5rem] py-[1.25rem] px-[1.3rem]">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-[34px] h-[34px] rounded-[11px] flex items-center justify-center shrink-0" style={{ backgroundColor: 'rgba(134,154,175,0.16)', color: FT.slate }}>
                <MapPin size={16} />
              </div>
              <h4 className="font-bold uppercase tracking-wide text-[0.95rem]" style={{ fontFamily: FONT_MONO, color: '#51606E' }}>Geolocalização</h4>
            </div>

            {/* Mapa esquemático — pré-visualização do raio, não é um mapa real */}
            <div className="relative h-[150px] rounded-[1.1rem] overflow-hidden border border-[#E5E1D6] mb-4" style={{ background: 'linear-gradient(135deg,#e9edf1,#dfe6ec)' }}>
              <div
                className="absolute inset-0 opacity-50"
                style={{ backgroundImage: 'linear-gradient(#c9d3db 1px, transparent 1px), linear-gradient(90deg, #c9d3db 1px, transparent 1px)', backgroundSize: '22px 22px' }}
              />
              <div
                className="absolute rounded-full"
                style={{ left: '50%', top: '50%', width: ringSize + 40, height: ringSize + 40, transform: 'translate(-50%,-50%)', border: '1.5px dashed rgba(27,58,87,0.18)', background: 'rgba(235,141,0,0.04)' }}
              />
              <div
                className="absolute rounded-full"
                style={{ left: '50%', top: '50%', width: ringSize, height: ringSize, transform: 'translate(-50%,-50%)', border: '1.5px dashed rgba(27,58,87,0.35)', background: 'rgba(235,141,0,0.08)' }}
              />
              <div
                className="absolute flex items-center justify-center"
                style={{ left: '50%', top: '50%', transform: 'translate(-50%,-100%)', width: 26, height: 26, borderRadius: '50% 50% 50% 0', background: FT.orange, boxShadow: '0 4px 10px rgba(235,141,0,0.4)' }}
              >
                <span className="w-2 h-2 rounded-full bg-white" style={{ transform: 'rotate(45deg)' }} />
              </div>
              <div className="absolute left-2.5 bottom-2.5 bg-white/90 rounded-lg px-2 py-1 text-[9.5px] font-bold" style={{ fontFamily: FONT_MONO, color: 'var(--navy)' }}>
                raio {raio}m
              </div>
            </div>

            <div className="grid grid-cols-2 gap-[0.7rem] mb-[0.7rem]">
              <div className="space-y-1">
                <label className="text-[9px] font-bold uppercase tracking-wider text-[#5C7086]" style={{ fontFamily: FONT_MONO }}>Latitude</label>
                <input type="number" step="any" value={clientForm.lat ?? ''} onChange={e => setClientForm(prev => ({ ...prev, lat: e.target.value }))} className="w-full bg-white border-[1.5px] border-[#E4E1D6] rounded-[0.7rem] py-[0.55rem] px-[0.7rem] text-[0.78rem] font-bold outline-none shadow-sm focus:border-[var(--navy)] focus:ring-4 focus:ring-[#1B3A57]/10 transition-all" style={{ fontFamily: FONT_MONO }} placeholder="38.7169" />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-bold uppercase tracking-wider text-[#5C7086]" style={{ fontFamily: FONT_MONO }}>Longitude</label>
                <input type="number" step="any" value={clientForm.lng ?? ''} onChange={e => setClientForm(prev => ({ ...prev, lng: e.target.value }))} className="w-full bg-white border-[1.5px] border-[#E4E1D6] rounded-[0.7rem] py-[0.55rem] px-[0.7rem] text-[0.78rem] font-bold outline-none shadow-sm focus:border-[var(--navy)] focus:ring-4 focus:ring-[#1B3A57]/10 transition-all" style={{ fontFamily: FONT_MONO }} placeholder="-9.1399" />
              </div>
            </div>
            <div className="space-y-1 mb-3">
              <label className="text-[9px] font-bold uppercase tracking-wider text-[#5C7086]" style={{ fontFamily: FONT_MONO }}>Raio (metros)</label>
              <input type="number" value={clientForm.geo_radius_m ?? 200} onChange={e => setClientForm(prev => ({ ...prev, geo_radius_m: e.target.value }))} className="w-full bg-white border-[1.5px] border-[#E4E1D6] rounded-[0.7rem] py-[0.55rem] px-[0.7rem] text-[0.78rem] font-bold outline-none shadow-sm focus:border-[var(--navy)] focus:ring-4 focus:ring-[#1B3A57]/10 transition-all" style={{ fontFamily: FONT_MONO }} placeholder="200" />
            </div>

            <button
              onClick={handleUseCurrentLocation}
              disabled={geoLoading}
              className="w-full flex items-center justify-center gap-2 disabled:opacity-50 px-4 py-2.5 rounded-xl font-bold text-[10.5px] uppercase tracking-wide shadow-sm transition-all border-[1.5px] hover:bg-white"
              style={{ fontFamily: FONT_MONO, borderColor: FT.slate, color: 'var(--navy)' }}
            >
              {geoLoading ? <Loader2 size={13} className="animate-spin" /> : <Navigation size={13} />}
              Usar localização atual
            </button>
            {clientForm.morada && (
              <button
                onClick={handleGeocodeMorada}
                disabled={geocodeLoading}
                className="mt-2 w-full flex items-center justify-center gap-2 bg-white disabled:opacity-50 px-4 py-2.5 rounded-xl font-bold text-[10.5px] uppercase tracking-wide shadow-sm transition-all border-[1.5px] border-dashed hover:bg-[var(--surface)]"
                style={{ fontFamily: FONT_MONO, borderColor: '#a8b5c1', color: '#5C7086' }}
              >
                {geocodeLoading ? <Loader2 size={13} className="animate-spin" /> : <MapPin size={13} />}
                Aplicar morada à geolocalização
              </button>
            )}
          </div>

          {/* HORÁRIOS */}
          <div className="bg-[#F7F8FA] border border-[#E5E1D6] rounded-[1.5rem] py-[1.25rem] px-[1.3rem]">
            <div className="flex items-center gap-2.5 mb-3.5">
              <div className="w-[34px] h-[34px] rounded-[11px] flex items-center justify-center shrink-0" style={{ backgroundColor: 'rgba(134,154,175,0.16)', color: FT.slate }}>
                <Clock size={16} />
              </div>
              <h4 className="font-bold uppercase tracking-wide text-[0.95rem]" style={{ fontFamily: FONT_MONO, color: '#51606E' }}>Horários</h4>
              <span
                className="ml-auto text-[9.5px] font-bold px-2 py-0.5 rounded-full text-white"
                style={{ fontFamily: FONT_MONO, backgroundColor: FT.navy }}
              >
                {(clientForm.assignedSchedules || []).length} selec.
              </span>
            </div>
            <div className="flex flex-wrap gap-2 max-h-[170px] overflow-y-auto pr-0.5 custom-scrollbar">
              {schedules.length === 0 && (
                <p className="text-[10px] text-[var(--slate-dim)] font-bold px-1">Sem horários criados.</p>
              )}
              {[...schedules].sort((a, b) => a.name.localeCompare(b.name)).map(s => {
                const isAssigned = !!(clientForm.assignedSchedules || []).includes(s.id);
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => {
                      const current = clientForm.assignedSchedules || [];
                      const updated = current.includes(s.id) ? current.filter(id => id !== s.id) : [...current, s.id];
                      setClientForm({ ...clientForm, assignedSchedules: updated });
                    }}
                    className="flex items-center gap-1.5 rounded-[0.6rem] px-2.5 py-1.5 text-[10px] font-bold border-[1.5px] transition-all"
                    style={{
                      fontFamily: FONT_MONO,
                      backgroundColor: isAssigned ? FT.navy : '#fff',
                      borderColor: isAssigned ? FT.navy : '#E4E1D6',
                      color: isAssigned ? '#fff' : '#5b6570',
                    }}
                  >
                    {isAssigned && <Check size={11} style={{ color: '#8fe0ac' }} />}
                    {s.name}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
