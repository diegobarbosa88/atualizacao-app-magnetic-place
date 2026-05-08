-- Disable RLS for document templates tables (for development)
ALTER TABLE document_templates DISABLE ROW LEVEL SECURITY;
ALTER TABLE worker_documents DISABLE ROW LEVEL SECURITY;
ALTER TABLE worker_document_assignments DISABLE ROW LEVEL SECURITY;