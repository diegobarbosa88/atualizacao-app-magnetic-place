import React from 'react';
import { Bell, X, CheckCircle, AlertTriangle, XCircle, Info } from 'lucide-react';

const TYPE_STYLES = {
  success: { bar: 'bg-emerald-500', iconBg: 'bg-emerald-50', iconFg: 'text-emerald-600', Icon: CheckCircle },
  warning: { bar: 'bg-amber-500', iconBg: 'bg-amber-50', iconFg: 'text-amber-600', Icon: AlertTriangle },
  error: { bar: 'bg-rose-500', iconBg: 'bg-rose-50', iconFg: 'text-rose-600', Icon: XCircle },
  info: { bar: 'bg-indigo-500', iconBg: 'bg-indigo-50', iconFg: 'text-indigo-600', Icon: Info },
};

export default function GenericNotificationCard({ notif, handleDismissNotif }) {
  const style = TYPE_STYLES[notif.type] || TYPE_STYLES.info;
  const { Icon } = style;
  return (
    <div className="relative overflow-hidden bg-white border border-slate-100 rounded-2xl shadow-sm animate-fade-in">
      <div className={`absolute top-0 left-0 w-1.5 h-full ${style.bar}`} />
      <div className="p-4 pl-6 flex items-start gap-3">
        <div className={`${style.iconBg} ${style.iconFg} p-2.5 rounded-xl shrink-0`}>
          <Icon size={16} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-black text-slate-800 uppercase tracking-tight">{notif.title}</p>
          <p className="text-xs text-slate-600 mt-1 whitespace-pre-wrap">{notif.message}</p>
        </div>
        <button onClick={() => handleDismissNotif(notif.id)} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 transition-colors shrink-0">
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
