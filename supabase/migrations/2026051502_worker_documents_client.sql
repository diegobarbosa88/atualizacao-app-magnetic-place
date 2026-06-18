-- Migration: associar cliente a documentos gerados (para tags {{client_*}})
ALTER TABLE worker_documents
  ADD COLUMN IF NOT EXISTS client_id TEXT;

COMMENT ON COLUMN worker_documents.client_id IS
  'Cliente associado ao documento — usado para resolver tags {{client_*}} no template.';

CREATE INDEX IF NOT EXISTS worker_documents_client_id_idx ON worker_documents(client_id);
