create table if not exists reconciliation_classificacao_tags (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  cor text not null default 'indigo',
  created_at timestamptz default now()
);

insert into reconciliation_classificacao_tags (nome, cor) values
  ('Adiantamento', 'violet'),
  ('Pagamento Fatura', 'emerald'),
  ('Despesa Operacional', 'blue'),
  ('Devolução', 'orange'),
  ('Transferência Interna', 'slate'),
  ('Salário', 'cyan'),
  ('Outro', 'gray');

alter table reconciliation_classificacao_tags enable row level security;

create policy "allow read tags"
  on reconciliation_classificacao_tags for select
  using (true);

create policy "allow insert tags"
  on reconciliation_classificacao_tags for insert
  with check (true);
