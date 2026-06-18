-- Regista as ajudas de custo faturadas a cada cliente por mês,
-- permitindo controlar que o acumulado anual não ultrapassa o total pago em recibos.
CREATE TABLE IF NOT EXISTS ajudas_faturadas_clientes (
  id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  mes         TEXT    NOT NULL,             -- 'YYYY-MM'
  client_id   TEXT    NOT NULL,
  valor_ajudas NUMERIC NOT NULL DEFAULT 0,  -- valor incluído na fatura deste cliente
  confirmado  BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(mes, client_id)
);

CREATE INDEX IF NOT EXISTS idx_ajudas_fat_mes ON ajudas_faturadas_clientes (mes);
CREATE INDEX IF NOT EXISTS idx_ajudas_fat_client ON ajudas_faturadas_clientes (client_id);
