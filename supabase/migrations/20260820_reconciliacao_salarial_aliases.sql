CREATE TABLE IF NOT EXISTS reconciliacao_salarial_aliases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pattern TEXT NOT NULL,
  worker_name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS reconciliacao_salarial_aliases_created_at_idx
  ON reconciliacao_salarial_aliases (created_at);

ALTER TABLE reconciliacao_salarial_aliases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow anon select reconciliacao_salarial_aliases" ON reconciliacao_salarial_aliases;
CREATE POLICY "Allow anon select reconciliacao_salarial_aliases"
  ON reconciliacao_salarial_aliases FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Allow anon insert reconciliacao_salarial_aliases" ON reconciliacao_salarial_aliases;
CREATE POLICY "Allow anon insert reconciliacao_salarial_aliases"
  ON reconciliacao_salarial_aliases FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anon delete reconciliacao_salarial_aliases" ON reconciliacao_salarial_aliases;
CREATE POLICY "Allow anon delete reconciliacao_salarial_aliases"
  ON reconciliacao_salarial_aliases FOR DELETE
  USING (true);
