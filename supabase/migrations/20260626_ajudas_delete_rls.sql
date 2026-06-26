-- Adiciona política DELETE em falta para ajudas_faturadas_clientes.
-- Necessário para handleConfirmar e guardarHistDb que fazem DELETE antes de INSERT.
DROP POLICY IF EXISTS "auth_delete" ON ajudas_faturadas_clientes;
CREATE POLICY "auth_delete" ON ajudas_faturadas_clientes
  FOR DELETE TO authenticated USING (true);

-- Garante que a coluna total_fatura existe (caso a migration 20260610 não tenha sido aplicada).
ALTER TABLE ajudas_faturadas_clientes
  ADD COLUMN IF NOT EXISTS total_fatura NUMERIC NOT NULL DEFAULT 0;
