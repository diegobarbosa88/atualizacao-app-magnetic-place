import React, { useState } from 'react';
import { useApp } from '../../../context/AppContext';
import { useClient } from '../contexts/ClientContext';
import {
  Briefcase, MapPin, Euro, Save, Building2, CreditCard, Mail, CalendarRange, Check, Navigation, Loader2, Clock
} from 'lucide-react';
import { getCurrentPosition } from '../../../utils/geoUtils';

export default function ClientForm() {
  const { schedules } = useApp();
  const { clientForm, setClientForm, handleSaveClient } = useClient();

  const [geoLoading, setGeoLoading] = useState(false);
  const [geocodeLoading, setGeocodeLoading] = useState(false);

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

  return (
    <div className="p-4 sm:p-6">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* COLUNA ESQUERDA (8 colunas) */}
        <div className="lg:col-span-8 space-y-6">

          {/* DADOS DO CLIENTE */}
          <div className="bg-slate-50/50 p-6 rounded-[2rem] border border-slate-100 space-y-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-xl" style={{ backgroundColor: 'rgba(134,154,175,0.15)', color: '#869AAF' }}><Briefcase size={18} /></div>
              <h4 className="font-black text-slate-700 text-lg tracking-tight">Dados do cliente</h4>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider ml-1 flex items-center gap-1"><Building2 size={10} /> Empresa</label>
                <input type="text" value={clientForm.name} onChange={e => setClientForm({ ...clientForm, name: e.target.value })} className="w-full bg-white border border-slate-200 rounded-xl p-4 text-sm font-bold outline-none shadow-sm focus:border-[#1B3A57] focus:ring-4 focus:ring-[#1B3A57]/10 transition-all" placeholder="Nome da empresa" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider ml-1 flex items-center gap-1"><CreditCard size={10} /> NIF</label>
                <input type="text" value={clientForm.nif || ''} onChange={e => setClientForm({ ...clientForm, nif: e.target.value })} className="w-full bg-white border border-slate-200 rounded-xl p-4 text-sm font-bold outline-none shadow-sm focus:border-[#1B3A57] focus:ring-4 focus:ring-[#1B3A57]/10 transition-all" placeholder="Nº de Contribuinte" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider ml-1 flex items-center gap-1"><Mail size={10} /> E-mail de Contato</label>
                <input type="email" value={clientForm.email || ''} onChange={e => setClientForm({ ...clientForm, email: e.target.value })} className="w-full bg-white border border-slate-200 rounded-xl p-4 text-sm font-bold outline-none shadow-sm focus:border-[#1B3A57] focus:ring-4 focus:ring-[#1B3A57]/10 transition-all" placeholder="email@exemplo.pt" />
              </div>
              <div className="space-y-1 flex items-center justify-end">
                <label className="text-[10px] font-black text-amber-600 uppercase tracking-wider ml-1 flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={clientForm.triggers_limited_mode || false}
                    onChange={e => setClientForm({ ...clientForm, triggers_limited_mode: e.target.checked })}
                    className="w-4 h-4 rounded border-amber-300 text-amber-600 focus:ring-amber-500"
                  />
                  Ativa modo limitado para workers
                </label>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider ml-1 flex items-center gap-1"><Clock size={10} /> Fuso Horário</label>
                <select
                  value={clientForm.timezone || 'Europe/Madrid'}
                  onChange={e => setClientForm({ ...clientForm, timezone: e.target.value })}
                  className="w-full bg-white border border-slate-200 rounded-xl p-4 text-sm font-bold outline-none shadow-sm focus:border-[#1B3A57] focus:ring-4 focus:ring-[#1B3A57]/10 transition-all"
                >
                  {typeof Intl !== 'undefined' && Intl.supportedValuesOf ?
                    Intl.supportedValuesOf('timeZone').map(tz => (
                      <option key={tz} value={tz}>{tz}</option>
                    )) : (
                    <option value="Europe/Madrid">Europe/Madrid</option>
                  )}
                </select>
              </div>
              <div className="space-y-1 md:col-span-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider ml-1 flex items-center gap-1"><MapPin size={10} /> Morada</label>
                <input type="text" value={clientForm.morada || ''} onChange={e => setClientForm({ ...clientForm, morada: e.target.value })} className="w-full bg-white border border-slate-200 rounded-xl p-4 text-sm font-bold outline-none shadow-sm focus:border-[#1B3A57] focus:ring-4 focus:ring-[#1B3A57]/10 transition-all" placeholder="Morada completa" />
              </div>
            </div>
          </div>

          {/* DADOS FINANCEIROS */}
          <div className="bg-slate-50/50 p-6 rounded-[2rem] border border-slate-100 space-y-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-xl" style={{ backgroundColor: 'rgba(134,154,175,0.15)', color: '#869AAF' }}><Euro size={18} /></div>
              <h4 className="font-black text-slate-700 text-lg tracking-tight">Dados financeiros</h4>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2 border-t border-slate-100">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider ml-1 flex items-center gap-1"><Euro size={10} /> Valor Hora (€)</label>
                <input type="number" step="0.01" value={clientForm.valorHora || ''} onChange={e => setClientForm({ ...clientForm, valorHora: e.target.value })} className="w-full bg-white border border-slate-200 rounded-xl p-4 text-lg text-slate-800 font-black outline-none shadow-sm focus:border-[#1B3A57] focus:ring-4 focus:ring-[#1B3A57]/10 transition-all" placeholder="0.00" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider ml-1 flex items-center gap-1"><CalendarRange size={10} /> Valor válido desde</label>
                <input type="date" value={clientForm.dataAlteracao || ''} onChange={e => setClientForm({ ...clientForm, dataAlteracao: e.target.value })} className="w-full bg-white border border-slate-200 rounded-xl p-4 text-sm font-bold outline-none shadow-sm focus:border-[#1B3A57] focus:ring-4 focus:ring-[#1B3A57]/10 transition-all" />
              </div>
            </div>
          </div>
        </div>

        {/* COLUNA DIREITA (4 colunas) */}
        <div className="lg:col-span-4 space-y-6 flex flex-col">
          <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100 flex-1">
            <div className="flex items-center gap-2 mb-4">
              <Briefcase size={16} style={{ color: '#869AAF' }} />
              <h4 className="font-black text-slate-700 text-sm tracking-widest">Informação adicional</h4>
            </div>
            <p className="text-xs text-slate-500 mb-4">
              Ao atualizar o valor/hora de um cliente, todos os registos futuros e os pendentes do mês atual serão atualizados com o novo valor.
            </p>
            <p className="text-xs text-slate-500">
              Regista a morada e os detalhes de faturação para constarem nos relatórios enviados.
            </p>
          </div>

          {/* GEOLOCALIZAÇÃO */}
          <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100">
            <div className="flex items-center gap-2 mb-4">
              <MapPin size={16} style={{ color: '#869AAF' }} />
              <h4 className="font-black text-slate-700 text-sm tracking-widest">Geolocalização da unidade</h4>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider ml-1">Latitude</label>
                <input type="number" step="any" value={clientForm.lat ?? ''} onChange={e => setClientForm(prev => ({ ...prev, lat: e.target.value }))} className="w-full bg-white border border-slate-200 rounded-xl p-3 text-sm font-bold outline-none shadow-sm focus:border-[#1B3A57] focus:ring-4 focus:ring-[#1B3A57]/10 transition-all" placeholder="38.7169" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider ml-1">Longitude</label>
                <input type="number" step="any" value={clientForm.lng ?? ''} onChange={e => setClientForm(prev => ({ ...prev, lng: e.target.value }))} className="w-full bg-white border border-slate-200 rounded-xl p-3 text-sm font-bold outline-none shadow-sm focus:border-[#1B3A57] focus:ring-4 focus:ring-[#1B3A57]/10 transition-all" placeholder="-9.1399" />
              </div>
            </div>
            <div className="space-y-1 mb-3">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider ml-1">Raio (metros)</label>
              <input type="number" value={clientForm.geo_radius_m ?? 200} onChange={e => setClientForm(prev => ({ ...prev, geo_radius_m: e.target.value }))} className="w-full bg-white border border-slate-200 rounded-xl p-3 text-sm font-bold outline-none shadow-sm focus:border-[#1B3A57] focus:ring-4 focus:ring-[#1B3A57]/10 transition-all" placeholder="200" />
            </div>
            <button onClick={handleUseCurrentLocation} disabled={geoLoading} className="w-full flex items-center justify-center gap-2 disabled:opacity-50 px-4 py-3 rounded-xl font-black text-xs uppercase shadow-sm transition-all border-2 hover:bg-slate-50" style={{ borderColor: '#869AAF', color: '#1B3A57' }}>
              {geoLoading ? <Loader2 size={14} className="animate-spin" /> : <Navigation size={14} />}
              Usar localização atual
            </button>
            {clientForm.morada && (
              <button
                onClick={handleGeocodeMorada}
                disabled={geocodeLoading}
                className="mt-2 w-full flex items-center justify-center gap-2 bg-white disabled:opacity-50 px-4 py-3 rounded-xl font-black text-xs uppercase shadow-sm transition-all border-2 hover:bg-slate-50"
                style={{ borderColor: '#869AAF', color: '#1B3A57' }}
              >
                {geocodeLoading ? <Loader2 size={14} className="animate-spin" /> : <MapPin size={14} />}
                Aplicar morada à geolocalização
              </button>
            )}
          </div>

          {/* HORÁRIOS */}
          <div className="bg-slate-50 p-4 rounded-[2rem] border border-slate-100">
            <div className="flex items-center gap-2 mb-3">
              <Clock size={14} style={{ color: '#869AAF' }} />
              <h4 className="font-black text-slate-700 text-sm tracking-widest">Horários</h4>
            </div>
            <div className="max-h-[200px] overflow-y-auto pr-1 custom-scrollbar space-y-1.5">
              {schedules.length === 0 && (
                <p className="text-[10px] text-slate-400 font-bold px-1">Sem horários criados.</p>
              )}
              {[...schedules].sort((a, b) => a.name.localeCompare(b.name)).map(s => {
                const isAssigned = !!(clientForm.assignedSchedules || []).includes(s.id);
                return (
                  <label key={s.id} className="flex items-center gap-2 p-2 rounded-xl border transition-all cursor-pointer shadow-sm" style={isAssigned ? { backgroundColor: 'rgba(134,154,175,0.12)', borderColor: '#869AAF' } : { backgroundColor: '#fff', borderColor: '#f1f5f9' }}>
                    <div className="w-4 h-4 rounded flex items-center justify-center border flex-shrink-0" style={isAssigned ? { backgroundColor: '#1B3A57', borderColor: '#1B3A57' } : {}}>
                      {isAssigned && <Check size={10} className="text-white" />}
                    </div>
                    <input type="checkbox" className="hidden" checked={isAssigned} onChange={() => {
                      const current = clientForm.assignedSchedules || [];
                      const updated = current.includes(s.id) ? current.filter(id => id !== s.id) : [...current, s.id];
                      setClientForm({ ...clientForm, assignedSchedules: updated });
                    }} />
                    <span className="text-[10px] font-black uppercase truncate" style={{ color: isAssigned ? '#1B3A57' : '#475569' }}>{s.name}</span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* AÇÕES */}
          <div className="pt-2">
            <button onClick={handleSaveClient} className="w-full hover:-translate-y-1 p-5 rounded-[1.5rem] font-black text-sm uppercase shadow-lg transition-all flex items-center justify-center gap-3" style={{ backgroundColor: '#EB8D00', color: '#1B3A57' }}>
              <Save size={20} />
              Gravar Cliente
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
