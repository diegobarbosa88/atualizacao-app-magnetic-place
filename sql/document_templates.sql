-- Drop existing tables if they exist (run in order)
DROP TABLE IF EXISTS worker_document_assignments CASCADE;
DROP TABLE IF EXISTS worker_documents CASCADE;
DROP TABLE IF EXISTS document_templates CASCADE;

-- =============================================
-- 1. document_templates
-- =============================================
CREATE TABLE document_templates (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name TEXT NOT NULL,
  description TEXT,
  html_content TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 2. worker_documents
-- =============================================
CREATE TABLE worker_documents (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  template_id TEXT REFERENCES document_templates(id) ON DELETE CASCADE,
  worker_id TEXT REFERENCES workers(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  generated_html TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'viewed', 'signed', 'archived')),
  signed_pdf_url TEXT,
  signed_at TIMESTAMPTZ,
  signed_ip TEXT,
  signature_data TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 3. worker_document_assignments
-- =============================================
CREATE TABLE worker_document_assignments (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  template_id TEXT REFERENCES document_templates(id) ON DELETE CASCADE,
  worker_id TEXT REFERENCES workers(id) ON DELETE CASCADE,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(template_id, worker_id)
);

-- INDEXES
CREATE INDEX idx_worker_documents_worker ON worker_documents(worker_id);
CREATE INDEX idx_worker_documents_status ON worker_documents(status);
CREATE INDEX idx_worker_documents_template ON worker_documents(template_id);
CREATE INDEX idx_worker_document_assignments_worker ON worker_document_assignments(worker_id);
CREATE INDEX idx_document_templates_active ON document_templates(is_active);

-- RLS (simplified - enable for production)
ALTER TABLE document_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE worker_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE worker_document_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins_full_access_templates" ON document_templates FOR ALL USING (true);
CREATE POLICY "workers_read_own_documents" ON worker_documents FOR SELECT USING (true);
CREATE POLICY "workers_update_own_documents" ON worker_documents FOR UPDATE USING (true);
CREATE POLICY "workers_read_own_assignments" ON worker_document_assignments FOR SELECT USING (true);

-- TRIGGER
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_document_templates_updated
  BEFORE UPDATE ON document_templates FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_worker_documents_updated
  BEFORE UPDATE ON worker_documents FOR EACH ROW EXECUTE FUNCTION update_updated_at();