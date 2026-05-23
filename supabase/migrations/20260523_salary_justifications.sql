CREATE TABLE IF NOT EXISTS salary_justifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_name TEXT NOT NULL,
  month TEXT NOT NULL,
  justification TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(employee_name, month)
);

ALTER TABLE salary_justifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anon select salary_justifications"
  ON salary_justifications FOR SELECT
  USING (true);

CREATE POLICY "Allow anon insert salary_justifications"
  ON salary_justifications FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow anon update salary_justifications"
  ON salary_justifications FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow anon delete salary_justifications"
  ON salary_justifications FOR DELETE
  USING (true);
