import { cn } from '../../lib/cn.js';

const VARIANTS = {
  primary: 'bg-mp-orange-400 text-mp-navy-800 font-bold shadow-sm hover:bg-mp-orange-300 active:bg-mp-orange-500',
  secondary: 'bg-mp-navy-600 text-white hover:bg-mp-navy-500 active:bg-mp-navy-700',
  outline: 'bg-white text-slate-800 ring-2 ring-inset ring-slate-300 hover:text-mp-navy-700 hover:ring-mp-navy-500',
  ghost: 'bg-transparent text-white/85 hover:bg-white/10',
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
        'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-mp-navy-300',
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
