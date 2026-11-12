import { cn } from '../../lib/cn.js';

const VARIANTS = {
  primary: 'bg-safety-400 text-slate-900 shadow-sm ring-1 ring-inset ring-safety-600/40 hover:bg-safety-300 active:bg-safety-500',
  secondary: 'bg-slate-900 text-white hover:bg-slate-800 active:bg-slate-950',
  outline: 'bg-white text-slate-800 ring-2 ring-inset ring-slate-300 hover:text-tech-700 hover:ring-tech-500',
  ghost: 'bg-transparent text-slate-200 hover:bg-white/10',
  danger: 'bg-red-600 text-white hover:bg-red-500 active:bg-red-700',
};

const SIZES = {
  md: 'min-h-11 gap-2 px-4 text-sm',
  lg: 'min-h-14 gap-2.5 px-6 text-base',
  xl: 'min-h-16 gap-3 px-8 text-lg',
};

export function Button({ variant = 'primary', size = 'lg', icon, iconRight, block, className, children, type = 'button', ...rest }) {
  return (
    <button
      type={type}
      className={cn(
        'inline-flex select-none items-center justify-center rounded-xl font-semibold transition',
        'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-tech-300',
        'disabled:cursor-not-allowed disabled:opacity-45',
        VARIANTS[variant],
        SIZES[size],
        block && 'w-full',
        className,
      )}
      {...rest}
    >
      {icon}
      {children}
      {iconRight}
    </button>
  );
}
