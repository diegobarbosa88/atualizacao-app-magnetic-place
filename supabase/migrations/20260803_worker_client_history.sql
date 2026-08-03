ALTER TABLE workers ADD COLUMN IF NOT EXISTS "assignedClientDates" JSONB DEFAULT '{}';

CREATE TABLE worker_client_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id TEXT NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
  client_id TEXT NOT NULL,
  data_inicio DATE NOT NULL,
  data_fim DATE,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_worker_client_history_worker_id ON worker_client_history(worker_id);
CREATE INDEX idx_worker_client_history_client_id ON worker_client_history(client_id);
CREATE INDEX idx_worker_client_history_dates ON worker_client_history(data_inicio, data_fim);
