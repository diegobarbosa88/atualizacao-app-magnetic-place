-- Secreto HMAC por cliente para assinar/verificar tokens do QR de picagem
-- (kiosk). NULL = kiosk desativado para esse cliente. Regenerar invalida
-- instantaneamente todos os QRs em exibição desse cliente.
ALTER TABLE clients ADD COLUMN IF NOT EXISTS qr_secret_key TEXT DEFAULT NULL;
COMMENT ON COLUMN clients.qr_secret_key IS 'Secreto HMAC para assinar/verificar tokens do QR de picagem deste cliente.';

-- Lançamento oculto — mesmo padrão já usado para workers.epi_enabled: só
-- quem tiver este campo a true vê o botão "Picar Ponto" no dashboard.
-- Default false, ativado manualmente por worker enquanto a feature está em
-- teste, antes de abrir a todos.
ALTER TABLE workers ADD COLUMN IF NOT EXISTS ponto_qr_enabled BOOLEAN DEFAULT false;

-- Ledger de anti-replay — cada token só pode ser consumido uma vez pelo
-- mesmo trabalhador (dois trabalhadores diferentes podem picar no mesmo QR
-- ainda válido). NÃO é fonte de horas — só existe para rejeitar reprodução
-- de um token já usado; `logs` continua a ser a única fonte de verdade das
-- horas trabalhadas.
CREATE TABLE IF NOT EXISTS qr_ponto_usos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id TEXT NOT NULL,
  worker_id TEXT NOT NULL,
  seq BIGINT NOT NULL,          -- iat (ms) do token — único por emissão
  tipo TEXT NOT NULL,           -- entrada | inicio_pausa | fim_pausa | saida
  log_id TEXT NOT NULL,         -- registo de `logs` afetado (auditoria)
  used_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (client_id, worker_id, seq)
);
CREATE INDEX IF NOT EXISTS idx_qr_ponto_usos_client ON qr_ponto_usos(client_id, used_at);

ALTER TABLE qr_ponto_usos ENABLE ROW LEVEL SECURITY;
-- Mesma política 100% permissiva do resto do projeto (ver comentário em
-- supabase/migrations/20260624_logs_rls_policies.sql) — a app usa anon key
-- sem Supabase Auth, a segurança real vive nas serverless functions.
CREATE POLICY "Allow anon select qr_ponto_usos" ON qr_ponto_usos FOR SELECT USING (true);
CREATE POLICY "Allow anon insert qr_ponto_usos" ON qr_ponto_usos FOR INSERT WITH CHECK (true);
