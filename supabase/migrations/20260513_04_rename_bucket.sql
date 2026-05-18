-- Migration: rename_bucket
-- Description: Align storage bucket name with the spec (underscored).
--   Old bucket "document-templates" (hyphen) is renamed to "document_templates" (underscore)
--   so it matches the table name and the user-facing convention.
--   If the old bucket never existed (clean install), this just creates the new one.
-- Created: 2026-05-13

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'document-templates') THEN
    UPDATE storage.buckets SET id = 'document_templates', name = 'document_templates'
    WHERE id = 'document-templates';

    UPDATE storage.objects SET bucket_id = 'document_templates'
    WHERE bucket_id = 'document-templates';
  ELSE
    INSERT INTO storage.buckets (id, name, public)
    VALUES ('document_templates', 'document_templates', false)
    ON CONFLICT (id) DO NOTHING;
  END IF;
END $$;

DROP POLICY IF EXISTS "document-templates auth read"   ON storage.objects;
DROP POLICY IF EXISTS "document-templates auth insert" ON storage.objects;
DROP POLICY IF EXISTS "document-templates auth update" ON storage.objects;
DROP POLICY IF EXISTS "document-templates auth delete" ON storage.objects;
DROP POLICY IF EXISTS "document_templates auth read"   ON storage.objects;
DROP POLICY IF EXISTS "document_templates auth insert" ON storage.objects;
DROP POLICY IF EXISTS "document_templates auth update" ON storage.objects;
DROP POLICY IF EXISTS "document_templates auth delete" ON storage.objects;

CREATE POLICY "document_templates auth read"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'document_templates');

CREATE POLICY "document_templates auth insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'document_templates');

CREATE POLICY "document_templates auth update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'document_templates');

CREATE POLICY "document_templates auth delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'document_templates');
