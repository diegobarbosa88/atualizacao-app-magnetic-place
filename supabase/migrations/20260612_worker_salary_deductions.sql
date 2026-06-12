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
