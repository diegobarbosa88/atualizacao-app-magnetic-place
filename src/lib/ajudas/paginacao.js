// Auditoria de 2026-08-20: o PostgREST do Supabase limita cada resposta a
// 1000 linhas por omissão — sem paginação explícita, queries sobre tabelas
// grandes (`logs`, `receipt_validations`) sobre períodos largos ou sem
// filtro de worker truncam SILENCIOSAMENTE, sem erro nenhum (confirmado
// com dados reais: a query de `logs` em elegibilidade.js devolvia 1000 de
// 1445 linhas — 31% em falta). Este helper pagina com `.range()` até
// esgotar os resultados. Usar sempre que uma query da calculadora não tem
// um filtro que garanta com certeza <1000 linhas (ex: um único mês, um
// único client_id).
//
// `builderFn` tem de ser uma função que devolve um query builder NOVO a
// cada chamada (nunca um builder já construído/reutilizado) — os métodos
// do supabase-js não são seguros para reencadear `.range()` duas vezes
// sobre o mesmo objeto.
export async function fetchTudoPaginado(builderFn, pageSize = 1000) {
  const todos = [];
  let from = 0;
  while (true) {
    const { data, error } = await builderFn().range(from, from + pageSize - 1);
    if (error) throw error;
    todos.push(...(data || []));
    if (!data || data.length < pageSize) break;
    from += pageSize;
  }
  return todos;
}
