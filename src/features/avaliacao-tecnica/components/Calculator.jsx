import { useState } from 'react';
import { Delete } from 'lucide-react';
import { evaluateExpression } from '../lib/calculator.js';
import { cn } from '../lib/cn.js';
import { sfx } from '../lib/sound.js';

const KEYS = [
  { label: 'C', action: 'clear', tone: 'danger' },
  { label: '(', insert: '(', tone: 'fn' },
  { label: ')', insert: ')', tone: 'fn' },
  { label: '⌫', action: 'back', tone: 'fn' },
  { label: '÷', insert: '÷', tone: 'op' },
  { label: '7', insert: '7' },
  { label: '8', insert: '8' },
  { label: '9', insert: '9' },
  { label: '√', insert: '√(', tone: 'fn' },
  { label: '×', insert: '×', tone: 'op' },
  { label: '4', insert: '4' },
  { label: '5', insert: '5' },
  { label: '6', insert: '6' },
  { label: 'x²', insert: '²', tone: 'fn' },
  { label: '−', insert: '−', tone: 'op' },
  { label: '1', insert: '1' },
  { label: '2', insert: '2' },
  { label: '3', insert: '3' },
  { label: 'π', insert: 'π', tone: 'fn' },
  { label: '+', insert: '+', tone: 'op' },
  { label: '0', insert: '0', wide: true },
  { label: ',', insert: ',' },
  { label: '=', action: 'equals', tone: 'eq', wide: true },
];

const fmt = (v) => v.toLocaleString('pt-BR', { maximumFractionDigits: 4, useGrouping: false });

/**
 * Calculadora da prova — evita que o candidato saia da aplicação para fazer contas.
 * `compacta` (celular): teclas mais baixas e "Usar" ao lado do visor, para caber por
 * cima do plano mesmo com o celular deitado.
 */
export function Calculator({ onUse, compacta = false }) {
  const [expr, setExpr] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState(false);
  const preview = expr ? evaluateExpression(expr) : null;

  const press = (k) => {
    sfx.move();
    setError(false);
    if (k.action === 'clear') {
      setExpr('');
      setResult(null);
    } else if (k.action === 'back') {
      setExpr((e) => (e.endsWith('√(') ? e.slice(0, -2) : e.slice(0, -1)));
    } else if (k.action === 'equals') {
      const v = evaluateExpression(expr);
      if (v === null) setError(true);
      else {
        setResult(v);
        setExpr(fmt(v));
      }
    } else if (k.insert) {
      setResult(null);
      setExpr((e) => e + k.insert);
    }
  };

  const usable = result ?? preview;
  const usar = (
    <button
      type="button"
      disabled={usable === null}
      onClick={() => usable !== null && onUse(fmt(Math.round(usable * 100) / 100))}
      className={cn(
        'rounded-lg bg-white/10 font-semibold transition hover:bg-white/20 disabled:opacity-40',
        compacta ? 'w-24 shrink-0 px-2 text-xs leading-tight' : 'mt-2 h-11 w-full text-sm',
      )}
    >
      Usar resultado na resposta
    </button>
  );

  return (
    <div className={cn('rounded-2xl bg-mp-navy-800 text-white', compacta ? 'p-2' : 'p-3')}>
      <div className={cn('flex gap-2', compacta ? 'mb-2' : 'mb-3')}>
        <div className={cn('min-w-0 flex-1 rounded-xl bg-mp-navy-900 px-3 text-right', compacta ? 'py-1.5' : 'py-2')}>
          <div
            className={cn('break-all font-mono text-white/85', compacta ? 'min-h-5 text-base leading-5' : 'min-h-6 text-lg leading-6')}
            aria-live="polite"
          >
            {expr || <span className="text-slate-500">0</span>}
          </div>
          <div className={cn('font-mono', compacta ? 'min-h-4 text-xs' : 'min-h-5 text-sm', error ? 'text-red-400' : 'text-mp-orange-300')}>
            {error ? 'Expressão inválida' : preview !== null && result === null ? `= ${fmt(preview)}` : ' '}
          </div>
        </div>
        {compacta && usar}
      </div>
      <div className={cn('grid grid-cols-5', compacta ? 'gap-1' : 'gap-1.5')}>
        {KEYS.map((k) => (
          <button
            key={k.label}
            type="button"
            onClick={() => press(k)}
            className={cn(
              'grid place-items-center rounded-lg font-mono text-lg font-bold transition active:scale-95',
              compacta ? 'h-10 baixo:h-8' : 'h-11',
              k.wide && 'col-span-2',
              !k.tone && 'bg-mp-navy-600 hover:bg-mp-navy-500',
              k.tone === 'op' && 'bg-mp-navy-700 hover:bg-mp-navy-600',
              k.tone === 'fn' && 'bg-mp-navy-700 text-mp-orange-300 hover:bg-mp-navy-600',
              k.tone === 'eq' && 'bg-mp-orange-400 text-slate-900 hover:bg-mp-orange-300',
              k.tone === 'danger' && 'bg-mp-navy-700 text-red-300 hover:bg-mp-navy-600',
            )}
            aria-label={k.action === 'back' ? 'Apagar' : k.label}
          >
            {k.action === 'back' ? <Delete className="size-5" /> : k.label}
          </button>
        ))}
      </div>
      {!compacta && usar}
    </div>
  );
}
