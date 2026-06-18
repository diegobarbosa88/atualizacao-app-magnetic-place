-- Migration: signature_serial
-- Description: Adiciona uma sequência global e duas colunas em worker_documents para
--   identificar de forma única e legível cada documento assinado:
--     - signature_serial         (BIGINT, valor cru do nextval)
--     - signature_serial_label   (TEXT, formatado MGN-{YYYY}-{NNNNNN})
--   O label é construído em JS no momento da assinatura. A sequência é global
--   (não por-template) — pode ser revista no futuro se preciso.
-- Created: 2026-05-13

CREATE SEQUENCE IF NOT EXISTS worker_document_signatures_seq START 1;

ALTER TABLE worker_documents
  ADD COLUMN IF NOT EXISTS signature_serial BIGINT,
  ADD COLUMN IF NOT EXISTS signature_serial_label TEXT;

COMMENT ON COLUMN worker_documents.signature_serial IS
  'Número sequencial global atribuído no momento da assinatura (via nextval).';
COMMENT ON COLUMN worker_documents.signature_serial_label IS
  'Label formatado MGN-{YYYY}-{NNNNNN} construído a partir de signature_serial.';

-- RPC para o cliente JS obter o próximo número da sequência.
-- O cliente Supabase JS não consegue chamar nextval() directamente; expomos via RPC.
CREATE OR REPLACE FUNCTION next_signature_serial()
RETURNS BIGINT
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT nextval('worker_document_signatures_seq');
$$;

GRANT EXECUTE ON FUNCTION next_signature_serial() TO anon, authenticated, public;

NOTIFY pgrst, 'reload schema';
