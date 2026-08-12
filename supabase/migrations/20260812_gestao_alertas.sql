-- Módulo "Gestão de Alertas" — tracking transversal de alertas administrativos/compliance/segurança
-- Acesso restrito à área admin (proteção de rota no frontend, como as restantes tabelas admin-only)

create table if not exists gestao_alertas (
  id uuid primary key default gen_random_uuid(),
  tipo text not null,
  severidade text not null check (severidade in ('baixa', 'media', 'alta')),
  titulo text not null,
  descricao text,
  status text not null default 'pendente' check (status in ('pendente', 'visto', 'resolvido', 'ignorado')),
  acao_sugerida text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists gestao_acoes_propostas (
  id uuid primary key default gen_random_uuid(),
  alerta_id uuid references gestao_alertas(id),
  descricao text not null,
  status text not null default 'pendente' check (status in ('pendente', 'aprovada', 'rejeitada', 'executada')),
  created_at timestamptz default now(),
  resolved_at timestamptz
);

alter table gestao_alertas enable row level security;
create policy "gestao_alertas_all" on gestao_alertas for all using (true) with check (true);

alter table gestao_acoes_propostas enable row level security;
create policy "gestao_acoes_propostas_all" on gestao_acoes_propostas for all using (true) with check (true);

insert into gestao_alertas (tipo, severidade, titulo, descricao, acao_sugerida) values
('seguranca', 'alta',
'Rota /partilha/resumo exposta sem autenticação',
'A rota pública /partilha/resumo expõe dados de trabalhadores sem qualquer autenticação. Risco de exposição de dados pessoais (RGPD) a qualquer pessoa com o link.',
'Adicionar autenticação/token de acesso temporário à rota antes de qualquer nova partilha. Rever se há partilhas já feitas do link em uso ativo.'),

('compliance', 'media',
'Ticket PSI de acesso ao ambiente Quality pendente',
'Ticket II-P002762-08-26 aguarda resposta para acesso ao ambiente de Quality da Segurança Social, necessário para testar integração PSI antes de produção.',
'Fazer follow-up do ticket se não houver resposta em X dias úteis. Definir prazo interno de escalação.');
