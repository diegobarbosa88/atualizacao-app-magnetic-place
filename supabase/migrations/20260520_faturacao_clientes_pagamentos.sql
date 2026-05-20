-- Associação entre pagamentos bancários (reconciliação) e linhas de faturação por cliente
CREATE TABLE IF NOT EXISTS faturacao_clientes_pagamentos (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id             TEXT NOT NULL,
  period                TEXT NOT NULL,          -- 'YYYY-MM'
  valor_faturado        NUMERIC,               -- snapshot do valor faturado ao criar o link
  reconciliation_run_id UUID REFERENCES reconciliation_runs(id) ON DELETE SET NULL,
  transaction_section   TEXT,                  -- 'matched' | 'orphan_bank'
  transaction_index     INTEGER,               -- índice no array da secção
  transaction_data      JSONB NOT NULL,        -- snapshot {data, descricao, valor, tipo}
  valor_pago            NUMERIC NOT NULL,
  notas                 TEXT,
  created_at            TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE faturacao_clientes_pagamentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all_faturacao_pagamentos" ON faturacao_clientes_pagamentos
  FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_fat_pag_client_period
  ON faturacao_clientes_pagamentos (client_id, period);
CREATE INDEX IF NOT EXISTS idx_fat_pag_run
  ON faturacao_clientes_pagamentos (reconciliation_run_id);
