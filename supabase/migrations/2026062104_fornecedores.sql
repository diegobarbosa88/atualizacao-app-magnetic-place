create table if not exists fornecedores (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  nome text not null,
  nif text unique,
  email text,
  telefone text,
  morada text,
  iban text,
  swift text,
  website text,
  notas text,
  status text not null default 'ativo',
  debito_automatico boolean not null default false
);

alter table fornecedores add constraint if not exists chk_forn_status check (status in ('ativo', 'inativo'));
