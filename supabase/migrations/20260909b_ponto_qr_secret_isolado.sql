-- Corrige uma falha de segurança da migração anterior (20260909_ponto_qr.sql):
-- clients.qr_secret_key era lido por `select('*')` no fetch geral de
-- `clients` (AppContext.jsx, fetchTable), enviado ao browser de QUALQUER
-- pessoa autenticada na app — incluindo trabalhadores, que poderiam ler a
-- chave e forjar QR tokens válidos sem nunca apontar a câmara ao kiosk
-- físico (anula o propósito de provar presença).

-- Segredo isolado numa tabela sem policy nenhuma para `anon` — RLS ativa
-- e sem policies nega tudo por defeito; só a service role (usada nos
-- endpoints serverless) consegue ler/escrever, RLS não se aplica a ela.
CREATE TABLE IF NOT EXISTS clients_qr_secrets (
  client_id TEXT PRIMARY KEY REFERENCES clients(id),
  secret TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE clients_qr_secrets ENABLE ROW LEVEL SECURITY;

-- Flag pública (sem valor secreto nenhum) — usada pelo frontend para saber
-- se o kiosk deste cliente está ativo, e para decidir se os trabalhadores
-- afetos a este cliente veem o botão "Picar Ponto". Isto é o mecanismo de
-- "atribuir a opção por cliente" pedido.
ALTER TABLE clients ADD COLUMN IF NOT EXISTS ponto_qr_ativo BOOLEAN DEFAULT false;

-- Migra o segredo já gravado (se algum) para a tabela isolada.
INSERT INTO clients_qr_secrets (client_id, secret)
SELECT id, qr_secret_key FROM clients WHERE qr_secret_key IS NOT NULL
ON CONFLICT (client_id) DO NOTHING;

UPDATE clients SET ponto_qr_ativo = true WHERE qr_secret_key IS NOT NULL;

ALTER TABLE clients DROP COLUMN IF EXISTS qr_secret_key;
