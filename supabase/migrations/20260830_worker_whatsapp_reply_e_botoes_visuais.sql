alter table worker_whatsapp_messages
  add column if not exists resposta_a_texto text,
  add column if not exists botoes jsonb;

comment on column worker_whatsapp_messages.resposta_a_texto is 'Texto (recortado) da mensagem citada, quando esta mensagem foi enviada/recebida como resposta a outra -- so para mostrar o bloco de citacao na UI, ao estilo do WhatsApp real.';
comment on column worker_whatsapp_messages.botoes is 'Array [{id,title}] quando esta mensagem foi enviada como pergunta com botoes de resposta rapida -- para desenhar os botoes na UI em vez de so mostrar o corpo como texto simples.';
