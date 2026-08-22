import React from 'react';
import { X } from 'lucide-react';

const ACCENT = {
  indigo: { header: 'bg-indigo-50 border-indigo-100', iconBg: 'bg-indigo-100', iconColor: 'text-indigo-600' },
  orange: { header: 'bg-orange-50 border-orange-100', iconBg: 'bg-orange-100', iconColor: 'text-orange-600' },
  rose:   { header: 'bg-rose-50 border-rose-100',     iconBg: 'bg-rose-100',   iconColor: 'text-rose-600'   },
  slate:  { header: 'bg-slate-50 border-slate-100',   iconBg: 'bg-slate-100',  iconColor: 'text-slate-600'  },
  navy:   { header: 'bg-slate-50 border-slate-100',   iconBg: 'bg-slate-100',  iconColor: 'text-[#1B3A57]'  },
  navyOrange: { header: 'bg-white border-[#E2DED4]', iconBg: 'bg-[#122741]', iconColor: 'text-[#EB8D00]' },
};

const SIZE_MAP = {
  sm: 'sm:max-w-sm',
  md: 'sm:max-w-md',
  lg: 'sm:max-w-lg',
  xl: 'sm:max-w-xl',
  '2xl': 'sm:max-w-2xl',
  '3xl': 'sm:max-w-3xl',
  '4xl': 'sm:max-w-4xl',
  '5xl': 'sm:max-w-5xl',
  '6xl': 'sm:max-w-6xl',
  clientWide: 'sm:max-w-[1180px]',
};

export default function ModalShell({ isOpen, onClose, title, subtitle, icon, accent = 'indigo', size = 'lg', footer, children }) {
  if (!isOpen) return null;
  const sizeClass = SIZE_MAP[size] || SIZE_MAP.lg;
  const isNavyGradient = accent === 'navyGradient';

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex flex-col justify-end sm:items-center sm:justify-center p-0 sm:p-4">
      <div
        className={`bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl w-full ${sizeClass} flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-300`}
        style={{ maxHeight: 'min(92dvh, 92vh)' }}
      >
        {isNavyGradient ? (
          <div className="shrink-0">
            {/* Cabeçalho claro, pela mesma razão da opção A nas secções: o
                bloco navy fazia massa escura em cima de cada modal. Mantém as
                proporções do mockup — sobrescrito por cima, título em Barlow
                Condensed 700 — e guarda a marca no filete laranja em baixo. */}
            <div className="flex items-center gap-3.5 px-6 py-4 bg-white">
              <div className="w-11 h-11 rounded-[14px] bg-[#1B3A57]/[0.08] text-[#1B3A57] flex items-center justify-center shrink-0">
                {icon}
              </div>
              <div className="flex-1 min-w-0">
                {subtitle && (
                  <p
                    style={{ fontFamily: 'var(--mono)' }}
                    className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400 truncate mb-0.5"
                  >
                    {subtitle}
                  </p>
                )}
                <h2 className="text-2xl font-bold leading-[1.05] tracking-[0.01em] text-[#1B3A57] truncate">{title}</h2>
              </div>
              <button
                onClick={onClose}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all shrink-0"
              >
                <X size={18} />
              </button>
            </div>
            <div className="h-[3px]" style={{ background: 'linear-gradient(90deg, #EB8D00, #ffb444)' }} />
          </div>
        ) : (
          (() => {
            const a = ACCENT[accent] || ACCENT.indigo;
            return (
              <div className={`flex items-center gap-3 ${a.header} border-b px-4 py-3 shrink-0`}>
                <div className={`w-8 h-8 rounded-xl ${a.iconBg} flex items-center justify-center shrink-0`}>
                  <span className={a.iconColor}>{icon}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="font-black text-slate-800 uppercase tracking-tight text-sm leading-none">{title}</h2>
                  {subtitle && <p className="text-[10px] font-bold text-slate-400 mt-0.5">{subtitle}</p>}
                </div>
                <button
                  onClick={onClose}
                  className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all shrink-0"
                >
                  <X size={18} />
                </button>
              </div>
            );
          })()
        )}
        <div className="flex-1 overflow-y-auto overscroll-contain min-h-0">
          {children}
        </div>
        {footer && <div className="shrink-0">{footer}</div>}
      </div>
    </div>
  );
}
