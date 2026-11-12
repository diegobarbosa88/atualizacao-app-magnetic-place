/** Junta classes condicionais do Tailwind */
export function cn(...classes) {
  return classes.filter(Boolean).join(' ');
}
