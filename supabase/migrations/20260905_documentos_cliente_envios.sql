-- Auditoria de envios do pacote "Documentos para Cliente" (Registo de
-- Formação Interna + Termo de Responsabilidade EPI + Registo de Riscos)
-- por email ao cliente atual do trabalhador. Também usada pelo frontend
-- para mostrar "Enviado em DD/MM" sem depender só do Gmail.
create table if not exists documentos_cliente_envios (
  id uuid primary key default gen_random_uuid(),
  worker_id text not null references workers(id) on delete cascade,
  client_id text not null references clients(id) on delete cascade,
  enviado_em timestamptz not null default now(),
  enviado_por text,
  gmail_message_id text,
  tipos_incluidos jsonb not null default '[]'::jsonb
);
create index if not exists documentos_cliente_envios_worker_idx on documentos_cliente_envios(worker_id, enviado_em desc);
