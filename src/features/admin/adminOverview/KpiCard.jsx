import React from 'react';

export default function KpiCard({ icon, iconBg, iconColor, value, subtitle, label, trend, invertTrend = false, dark = false }) {
  const trendGood = invertTrend ? trend <= 0 : trend >= 0;
  const base = dark
    ? 'bg-gradient-to-br from-slate-900 to-slate-800 shadow-xl text-white'
    : 'bg-white shadow-sm border border-slate-100';

  return (
    <div className={`p-4 sm:p-6 rounded-2xl sm:rounded-[2.5rem] flex flex-col gap-2 sm:gap-3 ${base}`}>
      <div className="flex justify-between items-start">
        <div className={`${iconBg} ${iconColor} p-3 rounded-2xl`}>{icon}</div>
        {trend !== null && trend !== undefined && trend !== 0 && (
          <span className={`text-[10px] font-black px-2 py-1 rounded-full ${
            dark
              ? (trendGood ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400')
              : (trendGood ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600')
          }`}>
            {trend >= 0 ? '▲' : '▼'} {Math.abs(trend)}%
          </span>
        )}
      </div>
      <div>
        <p className={`text-xl sm:text-3xl font-black ${dark ? '' : 'text-slate-800'}`}>{value}</p>
        {subtitle && (
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{subtitle}</p>
        )}
      </div>
      <p className={`text-xs font-bold uppercase tracking-wider ${dark ? 'text-slate-400' : 'text-slate-500'}`}>{label}</p>
    </div>
  );
}
