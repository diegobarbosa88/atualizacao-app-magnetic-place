ALTER TABLE worker_documents ADD COLUMN IF NOT EXISTS categoria TEXT;
CREATE INDEX IF NOT EXISTS idx_worker_documents_categoria ON worker_documents(categoria);
