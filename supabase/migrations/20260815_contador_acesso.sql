-- Correção urgente: /partilha/resumo expunha dados pessoais de todos os
-- trabalhadores (NIF, NIS, salário, IRS, SS) sem qualquer controlo de acesso.
-- Modelo: token único e persistente para o contabilista, validado sempre
-- server-side (nunca client-side com anon key), com audit log de acessos.

create table contador_acesso (
  id uuid primary key default gen_random_uuid(),
  token uuid unique not null default gen_random_uuid(),
  descricao text default 'Acesso resumo mensal - contabilista',
  ativo boolean not null default true,
  created_at timestamptz default now(),
  revoked_at timestamptz
);

create table contador_portal_audit_logs (
  id uuid primary key default gen_random_uuid(),
  token uuid not null,
  mes_acedido date,
  ip_address text,
  user_agent text,
  acedido_em timestamptz default now()
);

-- RLS: SELECT anónimo bloqueado por completo em ambas as tabelas — nem para
-- validar o token. Toda a leitura/escrita passa por api/contador-resumo.js e
-- api/contador-acesso.js com a service role key (que ignora RLS por natureza).
-- Mesmo padrão já usado em ss_comunicacoes (service_only, USING (false)).
alter table contador_acesso enable row level security;
create policy "service_only_contador_acesso" on contador_acesso using (false);

alter table contador_portal_audit_logs enable row level security;
create policy "service_only_contador_portal_audit_logs" on contador_portal_audit_logs using (false);

-- Token único inicial do contabilista (o admin obtém o valor via
-- api/contador-acesso.js — action "obter" — para montar o link a enviar).
insert into contador_acesso (descricao) values ('Acesso resumo mensal - contabilista');
