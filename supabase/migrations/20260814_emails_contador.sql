-- Automação de leitura/resposta a emails do contador (cobrança de faturas mensais)
-- Extensão do sistema de importação Gmail já existente (api/gmail/import-faturas.js)

create table emails_contador (
  id uuid primary key default gen_random_uuid(),
  gmail_message_id text unique not null,
  fornecedor_id uuid references fornecedores(id) not null,
  assunto text,
  remetente text,
  recebido_em timestamptz,
  dados_extraidos jsonb, -- output do Gemini: numero_fatura, valor, mes_referencia, etc.
  anexo_path text, -- path no Storage
  status text not null default 'importado' check (status in ('importado', 'rascunho_gerado', 'aprovado', 'enviado', 'rejeitado')),
  created_at timestamptz default now()
);

create table respostas_contador_pendentes (
  id uuid primary key default gen_random_uuid(),
  email_contador_id uuid references emails_contador(id) not null,
  rascunho text not null, -- texto gerado pelo Claude
  editado_manualmente boolean default false,
  status text not null default 'pendente' check (status in ('pendente', 'aprovado', 'rejeitado', 'enviado')),
  gmail_thread_id text, -- para responder na mesma thread
  -- audit trail de aprovação humana (mesmo princípio do confirmado_por em ss_comunicacoes) —
  -- coluna adicional face ao schema fornecido, necessária para cumprir o requisito de
  -- "nunca envio sem confirmação humana registada" (ver relatório de implementação)
  confirmado_por text,
  created_at timestamptz default now(),
  resolved_at timestamptz
);

-- RLS: mesmo padrão USING (true) já usado no resto do app-magnetic
-- (admin-only via proteção de rota /admin/*, não Supabase Auth)
alter table emails_contador enable row level security;
create policy "emails_contador_all" on emails_contador for all using (true) with check (true);

alter table respostas_contador_pendentes enable row level security;
create policy "respostas_contador_pendentes_all" on respostas_contador_pendentes for all using (true) with check (true);
