-- Garante que os valores monetários das ajudas são sempre não-negativos
ALTER TABLE ajudas_faturadas_clientes
  ADD CONSTRAINT IF NOT EXISTS check_valor_ajudas_nn CHECK (valor_ajudas >= 0),
  ADD CONSTRAINT IF NOT EXISTS check_total_fatura_nn CHECK (total_fatura >= 0);

-- Índice em receipt_validations.mes para acelerar queries anuais
CREATE INDEX IF NOT EXISTS idx_receipt_val_mes ON receipt_validations (mes);
