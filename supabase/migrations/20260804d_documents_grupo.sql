ALTER TABLE documents ADD COLUMN IF NOT EXISTS grupo_id TEXT;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS lado TEXT;
CREATE INDEX IF NOT EXISTS idx_documents_grupo_id ON documents(grupo_id);
