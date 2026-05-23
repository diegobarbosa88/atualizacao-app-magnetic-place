CREATE TABLE IF NOT EXISTS fatura_justifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fatura_id UUID NOT NULL,
  justification TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(fatura_id)
);

ALTER TABLE fatura_justifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anon select fatura_justifications"
  ON fatura_justifications FOR SELECT
  USING (true);

CREATE POLICY "Allow anon insert fatura_justifications"
  ON fatura_justifications FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow anon update fatura_justifications"
  ON fatura_justifications FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow anon delete fatura_justifications"
  ON fatura_justifications FOR DELETE
  USING (true);
