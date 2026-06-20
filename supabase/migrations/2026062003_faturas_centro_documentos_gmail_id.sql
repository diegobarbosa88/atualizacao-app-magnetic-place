-- Add gmail_message_id to deduplicate NovoBanco comprovativo imports
ALTER TABLE faturas_centro_documentos
  ADD COLUMN IF NOT EXISTS gmail_message_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS faturas_centro_documentos_gmail_message_id_unique
  ON faturas_centro_documentos (gmail_message_id);
