-- Phase 21: Extend faturas tipo to include cliente and fornecedor
-- Needed for client invoice management and virtual link for bank commissions

ALTER TABLE faturas DROP CONSTRAINT IF EXISTS faturas_tipo_check;

ALTER TABLE faturas ADD COLUMN IF NOT EXISTS tipo TEXT
  CHECK (tipo IN ('fatura', 'recibo', 'cliente', 'fornecedor'));

-- Also ensure PAGO status works for all tipos
ALTER TABLE faturas DROP CONSTRAINT IF EXISTS faturas_status_check;
ALTER TABLE faturas ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'PENDENTE'
  CHECK (status IN ('PENDENTE', 'PAGO'));