-- Inbox de WhatsApp por trabalhador — nova aba no admin para o Diego mandar
-- e receber mensagens de trabalhadores individuais, pelo mesmo número
-- "Trabalhador Virtual" já usado pelo agente (repo conselheiro).
--
-- As mensagens ENVIADAS vêm de api/whatsapp/enviar.js (app-magnetic), que
-- fala diretamente com a Graph API da Meta usando WHATSAPP_TOKEN/
-- WHATSAPP_PHONE_NUMBER_ID próprios deste projeto (duplicados dos do
-- conselheiro, por decisão do Diego — simplicidade em vez de partilhar
-- credenciais entre os dois projetos).
--
-- As mensagens RECEBIDAS vêm de um 3º ramo em api/whatsapp/webhook.js do
-- conselheiro (a par do onboarding e da whitelist do Diego): quando o
-- número que escreve bate com workers.tel, grava aqui usando o
-- getMagneticSupabase() que esse projeto já tem — sem credenciais novas
-- desse lado.

create table if not exists worker_whatsapp_messages (
  id text primary key,
  worker_id text not null references workers(id),
  direcao text not null check (direcao in ('recebida', 'enviada')),
  texto text not null,
  criado_em timestamptz not null default now()
);

create index if not exists idx_worker_whatsapp_messages_worker on worker_whatsapp_messages(worker_id, criado_em);

alter table worker_whatsapp_messages enable row level security;

create policy "Permitir leitura pública de worker_whatsapp_messages"
  on worker_whatsapp_messages for select
  using (true);

create policy "Permitir tudo para admin em worker_whatsapp_messages"
  on worker_whatsapp_messages for all
  using (true)
  with check (true);

-- Realtime, mesmo padrão de app_notifications/corrections — a aba atualiza
-- sozinha quando chega uma resposta nova, sem polling.
alter publication supabase_realtime add table worker_whatsapp_messages;

notify pgrst, 'reload schema';
