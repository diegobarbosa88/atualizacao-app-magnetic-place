-- Documentos da EMPRESA (não por trabalhador) que clientes por vezes exigem
-- — certidões fiscal/SS, RLC/RNT/TC2 (mensais), certificado SPA, normas do
-- cliente assinadas. "Mais recente" por tipo (e por período, para os
-- mensais) é o que conta como o documento ativo.
create table if not exists company_documents (
  id text primary key,
  tipo text not null,
  periodo text, -- 'YYYY-MM', só para RLC/RNT/TC2 (documentos mensais)
  nome_ficheiro text,
  url text not null,
  data_validade date,
  data_emissao timestamptz not null default now(),
  uploaded_por text,
  created_at timestamptz not null default now()
);

create index if not exists company_documents_tipo_idx on company_documents(tipo, data_emissao desc);
create index if not exists company_documents_tipo_periodo_idx on company_documents(tipo, periodo);

-- Auditoria de envio do pacote de documentos da empresa a um cliente —
-- mesmo espírito de documentos_cliente_envios, mas sem worker_id (não há
-- trabalhador associado, o admin escolhe o cliente destinatário).
create table if not exists documentos_empresa_envios (
  id uuid primary key default gen_random_uuid(),
  client_id text not null references clients(id) on delete cascade,
  enviado_em timestamptz not null default now(),
  enviado_por text,
  gmail_message_id text,
  tipos_incluidos jsonb not null default '[]'::jsonb
);

create index if not exists documentos_empresa_envios_client_idx on documentos_empresa_envios(client_id, enviado_em desc);

-- Bucket de storage dedicado — o bucket "documentos" está estruturado por
-- {workerId}/... em todos os call sites, sem segmento neutro para ficheiros
-- sem trabalhador.
insert into storage.buckets (id, name, public)
values ('documentos-empresa', 'documentos-empresa', true)
on conflict (id) do nothing;

create policy "docs_empresa_select" on storage.objects for select using (bucket_id = 'documentos-empresa');
create policy "docs_empresa_insert" on storage.objects for insert with check (bucket_id = 'documentos-empresa');
create policy "docs_empresa_update" on storage.objects for update using (bucket_id = 'documentos-empresa');
create policy "docs_empresa_delete" on storage.objects for delete using (bucket_id = 'documentos-empresa');
