import { describe, it, expect } from 'vitest';
import { fetchTudoPaginado } from '../../src/lib/ajudas/paginacao.js';

// Bug real confirmado em produção (2026-08-20): queries sem paginação sobre
// `logs`/`receipt_validations` truncavam silenciosamente no limite de 1000
// linhas do PostgREST (Supabase), sem erro nenhum — 31% dos logs em falta
// num período de 8 meses em elegibilidade.js. fetchTudoPaginado corrige
// isto com `.range()` em loop.

function makeBuilderComTotal(total, pageSize = 1000) {
  const todosOsDados = Array.from({ length: total }, (_, i) => ({ id: i }));
  return () => ({
    range: (from, to) => Promise.resolve({ data: todosOsDados.slice(from, to + 1), error: null }),
  });
}

describe('fetchTudoPaginado', () => {
  it('menos de 1000 linhas → uma única página, devolve tudo', async () => {
    const resultado = await fetchTudoPaginado(makeBuilderComTotal(50));
    expect(resultado).toHaveLength(50);
  });

  it('exatamente 1000 linhas (página cheia) → pede uma segunda página vazia para confirmar que não há mais nada', async () => {
    let chamadas = 0;
    const dados = Array.from({ length: 1000 }, (_, i) => ({ id: i }));
    const builderFn = () => {
      chamadas += 1;
      return { range: (from, to) => Promise.resolve({ data: dados.slice(from, to + 1), error: null }) };
    };
    const resultado = await fetchTudoPaginado(builderFn);
    expect(resultado).toHaveLength(1000);
    expect(chamadas).toBe(2); // página cheia (1000) + página seguinte (0) confirma o fim
  });

  it('mais de 1000 linhas (o bug real) → pagina até esgotar, nunca trunca', async () => {
    const resultado = await fetchTudoPaginado(makeBuilderComTotal(1445));
    expect(resultado).toHaveLength(1445);
    expect(resultado[0].id).toBe(0);
    expect(resultado[1444].id).toBe(1444);
  });

  it('builderFn é chamado de novo a cada página (query fresca, nunca reencadeada)', async () => {
    let chamadas = 0;
    const dados = Array.from({ length: 2500 }, (_, i) => ({ id: i }));
    const builderFn = () => {
      chamadas += 1;
      return { range: (from, to) => Promise.resolve({ data: dados.slice(from, to + 1), error: null }) };
    };
    const resultado = await fetchTudoPaginado(builderFn);
    expect(resultado).toHaveLength(2500);
    expect(chamadas).toBe(3); // 1000 + 1000 + 500
  });

  it('erro numa página propaga (não engole silenciosamente)', async () => {
    const builderFn = () => ({ range: () => Promise.resolve({ data: null, error: { message: 'falha de rede' } }) });
    await expect(fetchTudoPaginado(builderFn)).rejects.toEqual({ message: 'falha de rede' });
  });
});
