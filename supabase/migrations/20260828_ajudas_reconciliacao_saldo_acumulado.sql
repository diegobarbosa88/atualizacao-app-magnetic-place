-- Fase 3 (reconciliacao.js) — o resíduo mensal deixa de ser um valor
-- isolado, forçado a zero a cada mês; passa a ser CUMULATIVO desde o
-- início. saldo_acumulado grava o saldo corrido depois de aplicar o
-- resíduo deste mês ao saldo do fecho anterior (ou à semente inicial,
-- SALDO_ACUMULADO_INICIAL em reconciliacao.js, quando não há nenhum
-- registo anterior — ver DECISIONS.md).
ALTER TABLE ajudas_reconciliacao_mensal
  ADD COLUMN IF NOT EXISTS saldo_acumulado NUMERIC NOT NULL DEFAULT 0;
