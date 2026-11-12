import { useEffect, useState } from 'react';

/** Ecrã de celular: estreito (em pé) ou baixo (deitado). Igual ao `baixo:` de avaliacao.css. */
const CONSULTA = '(max-width: 639px), (max-height: 520px)';

export function useCelular() {
  const [celular, setCelular] = useState(() => typeof window !== 'undefined' && !!window.matchMedia?.(CONSULTA).matches);
  useEffect(() => {
    const mq = window.matchMedia?.(CONSULTA);
    if (!mq) return undefined;
    const atualizar = () => setCelular(mq.matches);
    atualizar();
    mq.addEventListener('change', atualizar);
    return () => mq.removeEventListener('change', atualizar);
  }, []);
  return celular;
}

/** Tempo para ler a pergunta antes de ela recolher (entre 3 s e `tetoMs`) */
export function tempoLeitura(texto, tetoMs = 8000) {
  return Math.min(tetoMs, Math.max(3000, 1500 + (texto?.length ?? 0) * 50));
}
