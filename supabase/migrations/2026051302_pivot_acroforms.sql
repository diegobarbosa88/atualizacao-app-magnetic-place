-- Migration: pivot_acroforms
-- Description: Pivot from block-based templates to AcroForms (fillable PDF templates).
--   - Drops the blocks-based pipeline columns from document_templates
--   - Adds template_pdf_path (storage path) and template_fields (JSONB array of field names)
--   - Creates a private storage bucket "document-templates" for uploaded PDFs
--   - Adds RLS policies allowing authenticated users to upload, read, and delete
-- Created: 2026-05-13

-- ---------- document_templates columns ----------
ALTER TABLE document_templates
  DROP COLUMN IF EXISTS blocks;

ALTER TABLE document_templates
  ADD COLUMN IF NOT EXISTS template_pdf_path TEXT,
  ADD COLUMN IF NOT EXISTS template_fields JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN document_templates.template_pdf_path IS
  'Object path inside the "document-templates" storage bucket for the uploaded fillable PDF.';
COMMENT ON COLUMN document_templates.template_fields IS
  'Array of AcroForm field names extracted from the uploaded PDF at upload time.';

-- ---------- worker_documents: keep generated_html nullable; AcroForm flow stores nothing here pre-sign ----------
ALTER TABLE worker_documents
  ALTER COLUMN generated_html DROP NOT NULL;

-- ---------- storage bucket ----------
INSERT INTO storage.buckets (id, name, public)
VALUES ('document-templates', 'document-templates', false)
ON CONFLICT (id) DO NOTHING;

-- ---------- storage policies (idempotent) ----------
DROP POLICY IF EXISTS "document-templates auth read"   ON storage.objects;
DROP POLICY IF EXISTS "document-templates auth insert" ON storage.objects;
DROP POLICY IF EXISTS "document-templates auth update" ON storage.objects;
DROP POLICY IF EXISTS "document-templates auth delete" ON storage.objects;

DROP POLICY IF EXISTS "document-templates auth read" ON storage;
CREATE POLICY "document-templates auth read"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'document-templates');

DROP POLICY IF EXISTS "document-templates auth insert" ON storage;
CREATE POLICY "document-templates auth insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'document-templates');

DROP POLICY IF EXISTS "document-templates auth update" ON storage;
CREATE POLICY "document-templates auth update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'document-templates');

DROP POLICY IF EXISTS "document-templates auth delete" ON storage;
CREATE POLICY "document-templates auth delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'document-templates');
