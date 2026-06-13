-- Guarda o valor total faturado a cada cliente no mês, ao lado das ajudas.
-- Permite mostrar o "Total Fatura" no histórico mesmo para meses faturados
-- via TOConline (sem horas registadas na plataforma).
ALTER TABLE ajudas_faturadas_clientes
  ADD COLUMN IF NOT EXISTS total_fatura NUMERIC NOT NULL DEFAULT 0;
