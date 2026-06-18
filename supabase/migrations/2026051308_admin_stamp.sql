-- Migration: Admin (Magnetic Place responsible) stamp support
-- Description: Adds tables/columns for the 2-step signature flow
--   1. Worker signs (status='awaiting_admin')
--   2. Admin/Responsible approves & applies institutional stamp (status='signed')

-- 1. Singleton table for company-wide settings (responsible name, role, signature PNG)
CREATE TABLE IF NOT EXISTS system_settings (
  id INTEGER PRIMARY KEY DEFAULT 1,
  responsible_name TEXT,
  responsible_role TEXT,
  company_signature_data_url TEXT, -- base64 data URL of the PNG
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT system_settings_singleton CHECK (id = 1)
);

INSERT INTO system_settings (id)
  VALUES (1)
  ON CONFLICT (id) DO NOTHING;

COMMENT ON TABLE system_settings IS 'Single-row table for company-wide settings (e.g., admin signature data).';
COMMENT ON COLUMN system_settings.company_signature_data_url IS 'PNG data URL of the institutional signature, applied by the admin approval flow.';

-- 2. Admin stamp position on document_templates (parallel to stamp_x/stamp_y)
ALTER TABLE document_templates
  ADD COLUMN IF NOT EXISTS stamp_admin_x NUMERIC DEFAULT 20,
  ADD COLUMN IF NOT EXISTS stamp_admin_y NUMERIC DEFAULT 30,
  ADD COLUMN IF NOT EXISTS stamp_admin_page TEXT DEFAULT 'last';

ALTER TABLE document_templates
  DROP CONSTRAINT IF EXISTS document_templates_stamp_admin_page_check;
ALTER TABLE document_templates
  ADD CONSTRAINT document_templates_stamp_admin_page_check
  CHECK (stamp_admin_page IN ('first', 'last', 'all'));

COMMENT ON COLUMN document_templates.stamp_admin_x IS 'X (mm from left) for the admin/company stamp on the signed PDF.';
COMMENT ON COLUMN document_templates.stamp_admin_y IS 'Y (mm from bottom) for the admin/company stamp.';
COMMENT ON COLUMN document_templates.stamp_admin_page IS 'Which page the admin stamp lands on: first | last | all.';

-- 3. Admin approval state on worker_documents
ALTER TABLE worker_documents
  ADD COLUMN IF NOT EXISTS admin_signed_at TIMESTAMPTZ;

COMMENT ON COLUMN worker_documents.admin_signed_at IS 'Timestamp when the admin/responsible approved and stamped the worker-signed PDF.';

-- Note: status values are stored as TEXT and not constrained at the DB level,
-- so adding the new 'awaiting_admin' state requires no DDL.

-- 4. RLS Policies for system_settings
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read system_settings"   ON system_settings;
DROP POLICY IF EXISTS "Allow public insert system_settings" ON system_settings;
DROP POLICY IF EXISTS "Allow public update system_settings" ON system_settings;

CREATE POLICY "Allow public read system_settings"   ON system_settings FOR SELECT USING (true);
CREATE POLICY "Allow public insert system_settings" ON system_settings FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update system_settings" ON system_settings FOR UPDATE USING (true);
