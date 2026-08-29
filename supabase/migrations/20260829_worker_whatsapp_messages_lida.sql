-- Indicador de não lidas na aba de WhatsApp do admin.

alter table worker_whatsapp_messages add column if not exists lida boolean not null default false;

-- Mensagens enviadas pelo próprio admin já estão "lidas" por definição --
-- só as recebidas de trabalhadores é que ficam por marcar até o Diego
-- abrir a conversa.
update worker_whatsapp_messages set lida = true where direcao = 'enviada';

create index if not exists idx_worker_whatsapp_messages_nao_lidas
  on worker_whatsapp_messages(worker_id) where direcao = 'recebida' and lida = false;

notify pgrst, 'reload schema';
