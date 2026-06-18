CREATE TABLE IF NOT EXISTS worker_salary_deductions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id TEXT NOT NULL,
  worker_name TEXT NOT NULL,
  month TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  motivo TEXT NOT NULL DEFAULT 'outro',
  descricao TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS worker_salary_deductions_month_idx
  ON worker_salary_deductions (month);

ALTER TABLE worker_salary_deductions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow anon select worker_salary_deductions" ON worker_salary_deductions;
CREATE POLICY "Allow anon select worker_salary_deductions"
  ON worker_salary_deductions FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Allow anon insert worker_salary_deductions" ON worker_salary_deductions;
CREATE POLICY "Allow anon insert worker_salary_deductions"
  ON worker_salary_deductions FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anon update worker_salary_deductions" ON worker_salary_deductions;
CREATE POLICY "Allow anon update worker_salary_deductions"
  ON worker_salary_deductions FOR UPDATE
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anon delete worker_salary_deductions" ON worker_salary_deductions;
CREATE POLICY "Allow anon delete worker_salary_deductions"
  ON worker_salary_deductions FOR DELETE
  USING (true);
