-- Garante que os valores monetários das ajudas são sempre não-negativos
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'check_valor_ajudas_nn'
  ) THEN
    ALTER TABLE ajudas_faturadas_clientes
      ADD CONSTRAINT check_valor_ajudas_nn CHECK (valor_ajudas >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'check_total_fatura_nn'
  ) THEN
    ALTER TABLE ajudas_faturadas_clientes
      ADD CONSTRAINT check_total_fatura_nn CHECK (total_fatura >= 0);
  END IF;
END;
$$;

-- Índice em receipt_validations.mes para acelerar queries anuais
CREATE INDEX IF NOT EXISTS idx_receipt_val_mes ON receipt_validations (mes);
