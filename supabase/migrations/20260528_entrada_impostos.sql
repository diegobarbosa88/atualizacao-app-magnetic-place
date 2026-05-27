CREATE TABLE IF NOT EXISTS entrada_impostos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL,
  tx_key TEXT NOT NULL,
  imposto_tipo TEXT DEFAULT 'Imposto' CHECK (imposto_tipo IN ('IRC', 'SS', 'IRS', 'Imposto Selo', 'Imposto')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(run_id, tx_key)
);

ALTER TABLE entrada_impostos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anon select entrada_impostos"
  ON entrada_impostos FOR SELECT USING (true);

CREATE POLICY "Allow anon insert entrada_impostos"
  ON entrada_impostos FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow anon update entrada_impostos"
  ON entrada_impostos FOR UPDATE USING (true);

CREATE POLICY "Allow anon delete entrada_impostos"
  ON entrada_impostos FOR DELETE USING (true);

COMMENT ON TABLE entrada_impostos IS 'Tax payments matched in movimentacoes tab (IRC, SS, IRS, etc.)';