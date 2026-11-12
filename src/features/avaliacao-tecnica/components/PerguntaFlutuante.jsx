import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { CELULA_PERGUNTA } from './ecraProva.js';
import { cn } from '../lib/cn.js';

/**
 * Pergunta no celular. Recolhida é uma barra fina (contador, resumo, cronómetro e
 * "Ver") com a sua própria faixa no ecrã: o plano fica por baixo dela, nunca debaixo.
 * A cada pergunta nova (dar `key` diferente) abre por cima do plano durante o tempo
 * de leitura e recolhe sozinha; tocar na barra volta a abri-la (e aí só fecha quando
 * o candidato tocar em "Ver o plano").
 *
 * - `timer(compacto)`: o cronómetro — ItemTimer com `persistKey`, para o tempo não
 *   voltar ao início quando a pergunta abre ou recolhe. Só há um de cada vez.
 * - `contador`: "2/6" (ou um ícone); `marcas`: por baixo dele (ex.: tentativas).
 * - `detalhe`: segunda linha curta por baixo do resumo (ex.: a dica da fase 1).
 * - `aviso`: ocupa o lugar do resumo enquanto existir (ex.: "Não é essa. Resta 1").
 * - `acao`: botão à direita da barra, no lugar de "Ver" (ex.: "Começar").
 * - `comResposta`: há uma barra de resposta em baixo (fase 2) — a pergunta aberta
 *   pára acima dela, para se poder responder sem a fechar.
 */
export function PerguntaFlutuante({
  tempoLeituraMs,
  etiqueta,
  contador,
  marcas,
  resumo,
  detalhe,
  aviso,
  rotuloVer = 'Ver',
  timer,
  acao,
  comResposta = false,
  children,
}) {
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
    <div className={CELULA_PERGUNTA}>
      {/* Barra recolhida: está sempre no seu lugar (reserva a altura, o plano não salta);
          com a pergunta aberta fica tapada por ela */}
      <div
        inert={aberta}
        className="relative flex h-[3.25rem] items-center gap-1.5 overflow-hidden rounded-xl bg-white pr-1.5 shadow-sm ring-1 ring-mp-borda"
      >
        <button
          type="button"
          onClick={abrir}
          aria-expanded={false}
          className="flex h-full min-w-0 flex-1 items-center gap-2 py-1.5 pl-1.5 text-left active:bg-mp-creme"
        >
          <span className="flex h-full w-9 shrink-0 flex-col items-center justify-center gap-1 rounded-lg bg-mp-navy-50 font-mono text-[11px] font-bold leading-none text-mp-navy-700">
            {contador}
            {marcas}
          </span>
          <span className="min-w-0 flex-1">
            {aviso || (
              <>
                {/* line-clamp já define o display (-webkit-box): não juntar `block` */}
                <span className={cn('text-[13px] font-bold leading-tight text-mp-navy-800', detalhe ? 'line-clamp-1' : 'line-clamp-2')}>
                  {resumo}
                </span>
                {detalhe && <span className="mt-0.5 block truncate text-[11px] font-semibold text-mp-navy-600">{detalhe}</span>}
              </>
            )}
          </span>
          <span className="flex shrink-0 flex-col items-end gap-1">
            {!aberta && timer(true)}
            {!acao && (
              <span className="flex items-center gap-0.5 rounded-md bg-mp-navy-50 px-1.5 py-0.5 text-[11px] font-semibold leading-none text-mp-navy-700">
                {rotuloVer} <ChevronDown className="size-3" />
              </span>
            )}
          </span>
        </button>
        {acao}
      </div>

      {aberta && (
        <section
          aria-label="Pergunta"
          className={cn(
            'absolute inset-x-0 top-0 flex flex-col overflow-hidden rounded-2xl bg-white shadow-xl ring-1 ring-mp-borda',
            comResposta ? 'max-h-[calc(100dvh-var(--cab,4rem)-5rem)]' : 'max-h-[calc(100dvh-var(--cab,4rem)-1rem)]',
          )}
        >
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
        </section>
      )}
    </div>
  );
}
