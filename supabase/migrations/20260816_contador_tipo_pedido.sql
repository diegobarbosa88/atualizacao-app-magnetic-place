-- Classificação de tipo de pedido do contador (Fase A da reescrita da automação de
-- resposta a emails) — antes assumia-se sempre "cobrança de fatura única"; agora
-- classifica-se o email antes de decidir que lógica de extração/cruzamento aplicar.
alter table emails_contador
  add column if not exists tipo_pedido text
    check (tipo_pedido in ('faturas_em_falta', 'extratos_bancarios_em_falta', 'cobranca', 'outro'));

-- Faturas já encontradas no sistema para um pedido de "faturas em falta" — guardadas
-- aqui para o fluxo de aprovação (api/contador?tipo=aprovar) saber que ficheiros
-- anexar ao enviar a resposta real via Gmail.
alter table respostas_contador_pendentes
  add column if not exists anexos_faturas_ids uuid[];
