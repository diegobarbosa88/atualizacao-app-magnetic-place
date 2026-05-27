CREATE TABLE IF NOT EXISTS entrada_impostos (
  run_id UUID NOT NULL REFERENCES reconciliation_runs(id) ON DELETE CASCADE,
  tx_key TEXT NOT NULL,
  imposto_tipo TEXT DEFAULT 'Imposto' CHECK (imposto_tipo IN ('IRC', 'SS', 'IRS', 'Imposto Selo', 'Imposto')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (run_id, tx_key)
);

COMMENT ON TABLE entrada_impostos IS 'Tax payments matched in movimentacoes tab (IRC, SS, IRS, etc.)';