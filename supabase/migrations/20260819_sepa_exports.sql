-- Histórico de exports SEPA de salários — hoje o endpoint gera o XML e
-- devolve-o para download sem gravar rasto nenhum; isto guarda cada export
-- gerado (quem, quando, quanto no total) e a distribuição por trabalhador,
-- para permitir mais tarde ligar uma transação bancária de lote ("PAGAMENTO
-- SALARIOS 20 ORDENS...") aos N pagamentos individuais que a compõem.
create table if not exists sepa_exports (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  created_by text,
  mes_referencia text not null,
  tipo text not null default 'normal', -- 'normal' | 'instant'
  valor_total numeric(12,2) not null,
  filename text,
  worker_count integer not null default 0
);

create table if not exists sepa_export_items (
  id uuid primary key default gen_random_uuid(),
  sepa_export_id uuid not null references sepa_exports(id) on delete cascade,
  worker_id text,
  worker_name text not null,
  iban text,
  receipt_validation_id uuid references receipt_validations(id) on delete set null,
  valor numeric(12,2) not null
);

create index if not exists idx_sepa_export_items_export
  on sepa_export_items (sepa_export_id);
create index if not exists idx_sepa_exports_mes
  on sepa_exports (mes_referencia);

-- RLS ativo, com policy permissiva — SalariosTab.jsx grava aqui a partir do
-- cliente supabase do frontend (mesmo padrão de faturacao_clientes_pagamentos),
-- não de uma rota de API com service role.
alter table sepa_exports enable row level security;
drop policy if exists "allow_all_sepa_exports" on sepa_exports;
create policy "allow_all_sepa_exports" on sepa_exports
  for all using (true) with check (true);

alter table sepa_export_items enable row level security;
drop policy if exists "allow_all_sepa_export_items" on sepa_export_items;
create policy "allow_all_sepa_export_items" on sepa_export_items
  for all using (true) with check (true);
