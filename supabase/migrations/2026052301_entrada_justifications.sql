CREATE TABLE IF NOT EXISTS entrada_justifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL,
  tx_key TEXT NOT NULL,
  justification TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(run_id, tx_key)
);

ALTER TABLE entrada_justifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow anon select entrada_justifications" ON entrada_justifications;
CREATE POLICY "Allow anon select entrada_justifications"
  ON entrada_justifications FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Allow anon insert entrada_justifications" ON entrada_justifications;
CREATE POLICY "Allow anon insert entrada_justifications"
  ON entrada_justifications FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anon update entrada_justifications" ON entrada_justifications;
CREATE POLICY "Allow anon update entrada_justifications"
  ON entrada_justifications FOR UPDATE
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anon delete entrada_justifications" ON entrada_justifications;
CREATE POLICY "Allow anon delete entrada_justifications"
  ON entrada_justifications FOR DELETE
  USING (true);
