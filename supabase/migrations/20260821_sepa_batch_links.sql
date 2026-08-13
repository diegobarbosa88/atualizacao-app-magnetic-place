-- Associação entre uma transação bancária de lote SEPA ("PAGAMENTO
-- SALARIOS N ORDENS...") e os N trabalhadores individuais desse lote —
-- mecanismo separado de movimentacao_recibo_links (deliberadamente: essa
-- tabela tem UNIQUE(run_id, tx_key), assumindo sempre 1 trabalhador por
-- transação; alargar essa constraint quebraria os upserts com
-- onConflict:'run_id,tx_key' em useMovActions.js e autoMatchEngine.js, que
-- ficam intocados). Aqui cada linha representa naturalmente 1 trabalhador
-- do lote — sem necessidade de upsert por (run_id, tx_key) sozinho.
create table if not exists sepa_batch_links (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null,
  tx_key text not null,
  tx_data date,
  sepa_export_id uuid not null references sepa_exports(id) on delete cascade,
  worker_id text,
  worker_name text,
  receipt_validation_id uuid references receipt_validations(id) on delete set null,
  mes text,
  amount numeric(12,2),
  created_at timestamptz not null default now()
);

create index if not exists idx_sepa_batch_links_run_tx
  on sepa_batch_links (run_id, tx_key);
create index if not exists idx_sepa_batch_links_export
  on sepa_batch_links (sepa_export_id);

-- RLS com policy permissiva — gravado a partir do cliente supabase do
-- frontend (SalariosTab.jsx), mesmo padrão de sepa_exports/sepa_export_items.
alter table sepa_batch_links enable row level security;
drop policy if exists "allow_all_sepa_batch_links" on sepa_batch_links;
create policy "allow_all_sepa_batch_links" on sepa_batch_links
  for all using (true) with check (true);
