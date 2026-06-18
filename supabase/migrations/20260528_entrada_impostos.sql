CREATE TABLE IF NOT EXISTS entrada_impostos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL,
  tx_key TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(run_id, tx_key)
);

ALTER TABLE entrada_impostos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow anon select entrada_impostos" ON entrada_impostos;
CREATE POLICY "Allow anon select entrada_impostos"
  ON entrada_impostos FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow anon insert entrada_impostos" ON entrada_impostos;
CREATE POLICY "Allow anon insert entrada_impostos"
  ON entrada_impostos FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anon delete entrada_impostos" ON entrada_impostos;
CREATE POLICY "Allow anon delete entrada_impostos"
  ON entrada_impostos FOR DELETE USING (true);

COMMENT ON TABLE entrada_impostos IS 'Tax payments matched in movimentacoes tab (IRC, SS, IRS, etc.)';