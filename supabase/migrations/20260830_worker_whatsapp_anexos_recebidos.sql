-- Bucket dedicado para anexos recebidos de trabalhadores pelo WhatsApp
-- (fotos, documentos, audio, video) -- feito via webhook.js (conselheiro),
-- que os descarrega da Meta e sobe aqui com a service role key (bypassa
-- RLS, mas mantem politicas para o proprio browser conseguir mostrar/ler).
insert into storage.buckets (id, name, public)
values ('whatsapp-anexos', 'whatsapp-anexos', true)
on conflict (id) do nothing;

create policy "whatsapp_anexos_select" on storage.objects for select
  using (bucket_id = 'whatsapp-anexos');
create policy "whatsapp_anexos_insert" on storage.objects for insert
  with check (bucket_id = 'whatsapp-anexos');

alter table worker_whatsapp_messages
  add column if not exists anexo_url text,
  add column if not exists anexo_tipo text,
  add column if not exists anexo_nome text;

comment on column worker_whatsapp_messages.anexo_url is 'URL publica do ficheiro (bucket whatsapp-anexos) quando a mensagem RECEBIDA de um trabalhador trazia uma imagem/documento/audio/video.';
comment on column worker_whatsapp_messages.anexo_tipo is 'image | document | audio | video -- espelha tipoMediaPorMimetype do lado do envio.';
comment on column worker_whatsapp_messages.anexo_nome is 'Nome do ficheiro (quando a Meta o fornece) -- usado como legenda/nome a mostrar.';
