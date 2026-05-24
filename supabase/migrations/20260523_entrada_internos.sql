CREATE TABLE IF NOT EXISTS entrada_internos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL,
  tx_key TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(run_id, tx_key)
);

ALTER TABLE entrada_internos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anon select entrada_internos"
  ON entrada_internos FOR SELECT USING (true);

CREATE POLICY "Allow anon insert entrada_internos"
  ON entrada_internos FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow anon delete entrada_internos"
  ON entrada_internos FOR DELETE USING (true);
