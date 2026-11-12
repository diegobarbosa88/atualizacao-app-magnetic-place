import { parseMillimeters, round } from './calculations.js';

export function evaluateDerive(question, { rawInput, timeMs, timedOut, skipped }) {
  const value = skipped ? null : parseMillimeters(rawInput);
  const error = value === null ? null : Math.abs(value - question.expected);
  return {
    questionId: question.id,
    rawInput: skipped ? '' : rawInput,
    value,
    expected: round(question.expected),
    errorAbs: error === null ? null : round(error),
    correct: error !== null && error <= question.tolerance + 1e-9,
    skipped,
    timeMs: Math.round(timeMs),
    timedOut,
  };
}
