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

/** Calculadora da prova — evita que o candidato saia da aplicação para fazer contas */
export function Calculator({ onUse }) {
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

  return (
    <div className="rounded-2xl bg-slate-900 p-3 text-white">
      <div className="mb-3 rounded-xl bg-slate-800 px-3 py-2 text-right">
        <div className="min-h-6 break-all font-mono text-lg leading-6 text-slate-200" aria-live="polite">
          {expr || <span className="text-slate-500">0</span>}
        </div>
        <div className={cn('min-h-5 font-mono text-sm', error ? 'text-red-400' : 'text-safety-300')}>
          {error ? 'Expressão inválida' : preview !== null && result === null ? `= ${fmt(preview)}` : ' '}
        </div>
      </div>
      <div className="grid grid-cols-5 gap-1.5">
        {KEYS.map((k) => (
          <button
            key={k.label}
            type="button"
            onClick={() => press(k)}
            className={cn(
              'grid h-11 place-items-center rounded-lg font-mono text-lg font-bold transition active:scale-95',
              k.wide && 'col-span-2',
              !k.tone && 'bg-slate-700 hover:bg-slate-600',
              k.tone === 'op' && 'bg-tech-700 hover:bg-tech-600',
              k.tone === 'fn' && 'bg-slate-800 text-safety-300 hover:bg-slate-700',
              k.tone === 'eq' && 'bg-safety-400 text-slate-900 hover:bg-safety-300',
              k.tone === 'danger' && 'bg-slate-800 text-red-300 hover:bg-slate-700',
            )}
            aria-label={k.action === 'back' ? 'Apagar' : k.label}
          >
            {k.action === 'back' ? <Delete className="size-5" /> : k.label}
          </button>
        ))}
      </div>
      <button
        type="button"
        disabled={usable === null}
        onClick={() => usable !== null && onUse(fmt(Math.round(usable * 100) / 100))}
        className="mt-2 h-11 w-full rounded-lg bg-white/10 text-sm font-semibold transition hover:bg-white/20 disabled:opacity-40"
      >
        Usar resultado na resposta
      </button>
    </div>
  );
}
