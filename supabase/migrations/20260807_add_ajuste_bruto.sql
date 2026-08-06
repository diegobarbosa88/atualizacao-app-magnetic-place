ALTER TABLE resumo_observacoes
  ADD COLUMN IF NOT EXISTS ajuste_bruto NUMERIC DEFAULT 0;
