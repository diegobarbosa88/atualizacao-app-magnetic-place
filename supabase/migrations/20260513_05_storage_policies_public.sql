-- Migration: storage_policies_public
-- Description: The app uses the anon Supabase key (no Supabase Auth integration),
--   so policies restricted to the "authenticated" role reject all uploads with
--   "new row violates RLS policy". Recreate the document_templates policies for
--   the public role so the anon key can read/write within this bucket.
-- Created: 2026-05-13

DROP POLICY IF EXISTS "document_templates auth read"   ON storage.objects;
DROP POLICY IF EXISTS "document_templates auth insert" ON storage.objects;
DROP POLICY IF EXISTS "document_templates auth update" ON storage.objects;
DROP POLICY IF EXISTS "document_templates auth delete" ON storage.objects;

DROP POLICY IF EXISTS "document_templates public read"   ON storage.objects;
DROP POLICY IF EXISTS "document_templates public insert" ON storage.objects;
DROP POLICY IF EXISTS "document_templates public update" ON storage.objects;
DROP POLICY IF EXISTS "document_templates public delete" ON storage.objects;

CREATE POLICY "document_templates public read"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'document_templates');

CREATE POLICY "document_templates public insert"
  ON storage.objects FOR INSERT TO public
  WITH CHECK (bucket_id = 'document_templates');

CREATE POLICY "document_templates public update"
  ON storage.objects FOR UPDATE TO public
  USING (bucket_id = 'document_templates');

CREATE POLICY "document_templates public delete"
  ON storage.objects FOR DELETE TO public
  USING (bucket_id = 'document_templates');
