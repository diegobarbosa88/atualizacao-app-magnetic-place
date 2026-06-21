-- Adiciona campo conta_origem para separar movimentações por conta bancária
ALTER TABLE faturas_centro_documentos
  ADD COLUMN IF NOT EXISTS conta_origem TEXT;

CREATE INDEX IF NOT EXISTS idx_fcd_conta_origem
  ON faturas_centro_documentos(conta_origem)
  WHERE conta_origem IS NOT NULL;
