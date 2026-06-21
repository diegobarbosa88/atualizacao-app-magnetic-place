create table if not exists fornecedores_debito_automatico (
  nif text primary key,
  nome text,
  created_at timestamptz not null default now()
);
