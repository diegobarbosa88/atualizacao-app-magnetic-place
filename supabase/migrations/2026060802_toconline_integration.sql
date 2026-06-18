-- TOConline API integration
-- 1. Allow faturas without gmail_message_id, storage_path or url (TOConline imports have no Gmail ID or file)
ALTER TABLE faturas ALTER COLUMN gmail_message_id DROP NOT NULL;
ALTER TABLE faturas ALTER COLUMN storage_path DROP NOT NULL;
ALTER TABLE faturas ALTER COLUMN url DROP NOT NULL;

-- 2. Unique ID from TOConline for deduplication
ALTER TABLE faturas ADD COLUMN IF NOT EXISTS toconline_doc_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS faturas_toconline_doc_id_idx
  ON faturas (toconline_doc_id)
  WHERE toconline_doc_id IS NOT NULL;

-- 3. Store OAuth tokens in system_settings (single-row config table, id=1)
ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS toconline_access_token  TEXT;
ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS toconline_refresh_token TEXT;
ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS toconline_token_expires_at TIMESTAMPTZ;
ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS toconline_oauth_state    TEXT;
