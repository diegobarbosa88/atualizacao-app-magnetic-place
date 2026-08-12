-- Suporte para envio mensal proativo ao contador (faturas reconciliadas do
-- mês anterior, geradas pelo cron do dia 5, sem partir de um email recebido).
alter table respostas_contador_pendentes
  alter column email_contador_id drop not null;

alter table respostas_contador_pendentes
  add column if not exists tipo_resposta text not null default 'resposta_email'
    check (tipo_resposta in ('resposta_email', 'envio_mensal_proativo'));

alter table respostas_contador_pendentes
  add column if not exists periodo_referente date; -- primeiro dia do mês a que se refere
