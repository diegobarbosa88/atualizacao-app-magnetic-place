// Fake mínimo do cliente supabase-js em memória — só as operações que
// api/_avaliacoes.js usa (select/insert/update/delete com eq/in/gt, order,
// limit, single/maybeSingle). Não é um PostgREST: serve para testar as
// transições de estado dos endpoints sem tocar na base de dados real.
import crypto from 'node:crypto';

export function createFakeSupabase() {
  const tables = { avaliacoes_tecnicas: [], app_notifications: [] };

  const DEFAULTS = {
    avaliacoes_tecnicas: () => ({ id: crypto.randomUUID(), status: 'pending', created_at: new Date().toISOString(), reaberturas: 0 }),
    app_notifications: () => ({}),
  };

  function query(table) {
    let op = 'select';
    let payload = null;
    let columns = '*';
    let returning = false;
    const filters = [];
    let order = null;
    let limit = null;

    const pick = (row) => {
      if (columns === '*') return { ...row };
      const out = {};
      for (const c of columns.split(',').map((s) => s.trim()).filter(Boolean)) out[c] = row[c] ?? null;
      return out;
    };

    const run = () => {
      const rows = tables[table];
      const match = (r) => filters.every((f) => f(r));
      let result;
      if (op === 'insert') {
        const list = (Array.isArray(payload) ? payload : [payload]).map((p) => ({ ...DEFAULTS[table](), ...p }));
        if (table === 'avaliacoes_tecnicas' && list.some((n) => rows.some((r) => r.token === n.token))) {
          return { data: null, error: { message: 'duplicate key value violates unique constraint' } };
        }
        rows.push(...list);
        result = list;
      } else if (op === 'update') {
        result = rows.filter(match);
        result.forEach((r) => Object.assign(r, payload));
      } else if (op === 'delete') {
        result = rows.filter(match);
        tables[table] = rows.filter((r) => !match(r));
      } else {
        result = rows.filter(match);
      }
      if (order) result = [...result].sort((a, b) => (a[order.col] < b[order.col] ? -1 : 1) * (order.asc ? 1 : -1));
      if (limit != null) result = result.slice(0, limit);
      return { data: op === 'select' || returning ? result.map(pick) : null, error: null };
    };

    const builder = {
      select(cols = '*') {
        columns = cols;
        if (op !== 'select') returning = true;
        return builder;
      },
      insert(p) {
        op = 'insert';
        payload = p;
        return builder;
      },
      update(p) {
        op = 'update';
        payload = p;
        return builder;
      },
      delete() {
        op = 'delete';
        return builder;
      },
      eq(col, v) {
        filters.push((r) => r[col] === v);
        return builder;
      },
      in(col, vs) {
        filters.push((r) => vs.includes(r[col]));
        return builder;
      },
      gt(col, v) {
        filters.push((r) => r[col] > v);
        return builder;
      },
      order(col, { ascending = true } = {}) {
        order = { col, asc: ascending };
        return builder;
      },
      limit(n) {
        limit = n;
        return builder;
      },
      single() {
        const r = run();
        if (r.error) return Promise.resolve(r);
        return Promise.resolve(r.data?.length === 1 ? { data: r.data[0], error: null } : { data: null, error: { message: 'not single' } });
      },
      maybeSingle() {
        const r = run();
        if (r.error) return Promise.resolve(r);
        return Promise.resolve({ data: r.data?.[0] ?? null, error: null });
      },
      then(resolve, reject) {
        return Promise.resolve(run()).then(resolve, reject);
      },
    };
    return builder;
  }

  return { tables, from: (t) => query(t) };
}
