import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '../lib/cn.js';

/**
 * Pergunta por cima do plano, no celular. O plano fica com o ecrã todo; a pergunta
 * abre a cada pergunta nova (dar `key` diferente), fica o tempo de leitura e recolhe
 * numa barra no topo — tocar na barra volta a abri-la (e aí só fecha quando o
 * candidato tocar em "Ver o plano").
 *
 * `timer(compacto)` desenha o cronómetro: ItemTimer com `persistKey`, para o tempo
 * não voltar ao início quando a pergunta abre ou recolhe.
 */
export function PerguntaFlutuante({ tempoLeituraMs, etiqueta, resumo, timer, aviso, acao, children }) {
  const [aberta, setAberta] = useState(true);
  const [abertaPeloCandidato, setAbertaPeloCandidato] = useState(false);
  const recolheSozinha = aberta && !abertaPeloCandidato;

  useEffect(() => {
    if (!recolheSozinha) return undefined;
    const id = window.setTimeout(() => setAberta(false), tempoLeituraMs);
    return () => window.clearTimeout(id);
  }, [recolheSozinha, tempoLeituraMs]);

  const abrir = () => {
    setAbertaPeloCandidato(true);
    setAberta(true);
  };

  return (
    <div className="pointer-events-none absolute inset-x-2 top-2 z-20 flex max-h-[calc(100%-1rem)] flex-col">
      <section
        className="pointer-events-auto flex min-h-0 flex-col overflow-hidden rounded-2xl bg-white/95 shadow-xl ring-1 ring-mp-borda backdrop-blur"
        aria-label="Pergunta"
      >
        {aberta ? (
          <>
            <div className="min-h-0 space-y-2 overflow-y-auto overscroll-contain p-3">
              <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.06em] text-mp-navy-600">{etiqueta}</p>
              {timer(false)}
              {children}
            </div>
            <button
              type="button"
              onClick={() => setAberta(false)}
              className="relative flex shrink-0 items-center justify-center gap-1.5 border-t border-slate-200 py-2 text-sm font-semibold text-mp-navy-600 active:bg-mp-creme"
            >
              <ChevronUp className="size-4" /> Ver o plano
              {/* Encolhe até a pergunta recolher sozinha */}
              {recolheSozinha && (
                <span
                  aria-hidden
                  className="absolute inset-x-0 bottom-0 h-0.5 origin-left animate-encolher bg-mp-orange-400"
                  style={{ animationDuration: `${tempoLeituraMs}ms` }}
                />
              )}
            </button>
          </>
        ) : (
          <div className="space-y-1.5 p-2.5">
            <button type="button" onClick={abrir} className="flex w-full items-start gap-2 text-left" aria-expanded={false}>
              <div className="min-w-0 flex-1">
                <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.06em] text-mp-navy-600">{etiqueta}</p>
                <p className="line-clamp-2 text-sm font-bold leading-snug text-mp-navy-800">{resumo}</p>
              </div>
              <span className="mt-0.5 flex shrink-0 items-center gap-0.5 rounded-lg bg-mp-navy-50 px-1.5 py-1 text-xs font-semibold text-mp-navy-700">
                Ver <ChevronDown className="size-3.5" />
              </span>
            </button>
            {aviso}
            <div className={cn('flex items-center gap-2', !acao && 'pr-0.5')}>
              <div className="min-w-0 flex-1">{timer(true)}</div>
              {acao}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
