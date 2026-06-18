-- Phase 18: Reconciliation runs history table
-- Each bank statement import creates one row here

CREATE TABLE IF NOT EXISTS reconciliation_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  filename TEXT NOT NULL,
  transaction_count INTEGER NOT NULL DEFAULT 0,
  matched_count INTEGER NOT NULL DEFAULT 0,
  orphan_bank_count INTEGER NOT NULL DEFAULT 0,
  orphan_system_count INTEGER NOT NULL DEFAULT 0,
  transactions_json JSONB,
  results_json JSONB
);

-- RLS: only authenticated admin users can read
ALTER TABLE reconciliation_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin can read reconciliation_runs" ON reconciliation_runs;
CREATE POLICY "Admin can read reconciliation_runs"
  ON reconciliation_runs FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Service role can insert reconciliation_runs" ON reconciliation_runs;
CREATE POLICY "Service role can insert reconciliation_runs"
  ON reconciliation_runs FOR INSERT
  WITH CHECK (true);

-- Index for history list sorted by date
CREATE INDEX IF NOT EXISTS reconciliation_runs_created_at_idx
  ON reconciliation_runs (created_at DESC);
