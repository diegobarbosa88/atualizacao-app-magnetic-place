-- Phase 17: Gmail invoice import table
CREATE TABLE IF NOT EXISTS faturas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gmail_message_id TEXT NOT NULL,
  filename TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  url TEXT NOT NULL,
  mime_type TEXT,
  tamanho INTEGER,
  importado_em TIMESTAMPTZ DEFAULT NOW(),
  processado BOOLEAN DEFAULT FALSE
);

-- Prevent duplicate imports on re-runs
CREATE UNIQUE INDEX IF NOT EXISTS faturas_message_filename_idx
  ON faturas (gmail_message_id, filename);

-- RLS: only service role can insert; admin can read
ALTER TABLE faturas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin can read faturas" ON faturas;
CREATE POLICY "Admin can read faturas"
  ON faturas FOR SELECT
  USING (true);
