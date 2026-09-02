// Elegibilidade de EPI por profissão + exceções individuais, e helpers de
// stock. Partilhado entre o admin (Catálogo, EPI por Trabalhador, Pedidos)
// e o dashboard do trabalhador (Solicitar EPI) — a mesma lógica não pode
// divergir entre os dois lados.

export const LOW_STOCK_THRESHOLD = 2;

export function isBaseEligible(type, worker) {
  if (!type || !worker) return false;
  return !!type.eligibility_all || (type.eligibility_professions || []).includes(worker.profissao);
}

export function eligibleTypesForWorker(types, worker) {
  if (!worker) return types || [];
  const overrides = worker.epi_overrides || { add: [], remove: [] };
  return (types || []).filter((t) => {
    const base = isBaseEligible(t, worker);
    const removed = (overrides.remove || []).includes(t.id);
    const added = (overrides.add || []).includes(t.id);
    return (base && !removed) || added;
  });
}

export function typeStockList(type) {
  if (type?.sizes?.length) return type.sizes;
  return [{ name: null, stock: type?.stock || 0 }];
}

export function typeTotalStock(type) {
  return typeStockList(type).reduce((sum, s) => sum + (s.stock || 0), 0);
}

export function getStock(type, sizeName) {
  if (type?.sizes?.length) {
    const s = type.sizes.find((x) => x.name === sizeName);
    return s ? s.stock : 0;
  }
  return type?.stock || 0;
}

export function lowStockEntries(types) {
  const out = [];
  (types || []).forEach((t) => {
    typeStockList(t).forEach((s) => {
      if (s.stock <= LOW_STOCK_THRESHOLD) {
        out.push({ label: t.label + (s.name ? ` (${s.name})` : ''), stock: s.stock });
      }
    });
  });
  return out;
}
