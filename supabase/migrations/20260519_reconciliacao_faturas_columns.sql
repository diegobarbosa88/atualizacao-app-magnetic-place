-- Phase 18: Add reconciliation columns to faturas table
-- Extends the Phase 17 Gmail import table with financial matching fields

ALTER TABLE faturas ADD COLUMN IF NOT EXISTS tipo TEXT
  CHECK (tipo IN ('fatura', 'recibo'));

ALTER TABLE faturas ADD COLUMN IF NOT EXISTS valor NUMERIC;

ALTER TABLE faturas ADD COLUMN IF NOT EXISTS data_documento DATE;

ALTER TABLE faturas ADD COLUMN IF NOT EXISTS descricao TEXT;

ALTER TABLE faturas ADD COLUMN IF NOT EXISTS entidade TEXT;

ALTER TABLE faturas ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'PENDENTE'
  CHECK (status IN ('PENDENTE', 'PAGO'));

ALTER TABLE faturas ADD COLUMN IF NOT EXISTS fonte TEXT NOT NULL DEFAULT 'gmail'
  CHECK (fonte IN ('gmail', 'toc', 'manual'));

ALTER TABLE faturas ADD COLUMN IF NOT EXISTS ficheiro_url TEXT;

-- Index for fast matching queries (matching engine filters by status = 'PENDENTE')
CREATE INDEX IF NOT EXISTS faturas_status_idx ON faturas (status);
CREATE INDEX IF NOT EXISTS faturas_valor_idx ON faturas (valor);
