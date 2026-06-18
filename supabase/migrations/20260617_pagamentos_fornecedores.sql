create table if not exists pagamentos_fornecedores (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  fornecedor_nome text not null,
  fornecedor_iban text not null,
  fornecedor_nif text,
  valor numeric(12, 2) not null check (valor > 0),
  referencia text,
  data_pagamento date not null,
  status text not null default 'pendente' check (status in ('pendente', 'exportado', 'enviado', 'confirmado')),
  enviado_em timestamptz,
  sepa_msg_id text
);

alter table pagamentos_fornecedores enable row level security;

drop policy if exists "Service role full access" on pagamentos_fornecedores;
create policy "Service role full access"
  on pagamentos_fornecedores
  for all
  using (true)
  with check (true);
