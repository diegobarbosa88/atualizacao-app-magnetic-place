-- Guarda o ID real da mensagem na Meta (wamid) -- necessário para reagir a
-- uma mensagem, responder a uma mensagem específica (reply/context), e
-- marcar como lida no WhatsApp real do trabalhador (tudo isso referencia a
-- mensagem pelo wamid, não pelo id interno nosso).

alter table worker_whatsapp_messages add column if not exists wamid text;
create index if not exists idx_worker_whatsapp_messages_wamid on worker_whatsapp_messages(wamid);
