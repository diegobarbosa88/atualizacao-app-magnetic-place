-- Tabela de pedidos de falta dos workers
CREATE TABLE IF NOT EXISTS absence_requests (
  id TEXT PRIMARY KEY,
  worker_id TEXT NOT NULL,
  worker_name TEXT NOT NULL,
  client_id TEXT,
  dates JSONB NOT NULL DEFAULT '[]',
  reason TEXT NOT NULL,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  seen_at TIMESTAMPTZ,
  seen_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE absence_requests DISABLE ROW LEVEL SECURITY;

-- Habilitar realtime para a tabela (idempotente)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'absence_requests'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE absence_requests;
  END IF;
END $$;

-- Coluna absence_config na tabela system_settings (JSONB com motivos e toggle)
ALTER TABLE system_settings
  ADD COLUMN IF NOT EXISTS absence_config JSONB DEFAULT '{
    "absence_reasons": ["Doença", "Consulta médica", "Emergência familiar", "Férias", "Assunto pessoal", "Outro"],
    "absence_notify_client": false
  }'::jsonb;
