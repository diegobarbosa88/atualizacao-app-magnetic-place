ALTER TABLE documents ADD COLUMN IF NOT EXISTS data_validade DATE;
CREATE INDEX IF NOT EXISTS idx_documents_data_validade ON documents(data_validade);
