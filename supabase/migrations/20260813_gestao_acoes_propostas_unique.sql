-- Impede mais do que uma ação proposta por alerta (evita duplicados por duplo-clique)
-- Nota: se no futuro for preciso permitir múltiplas ações históricas por alerta
-- (ex: uma rejeitada e depois outra aprovada), trocar para unique index parcial.
alter table gestao_acoes_propostas
  add constraint gestao_acoes_propostas_alerta_id_unique unique (alerta_id);
