-- Piloto: terminal de picagem NFC fixo na obra. O trabalhador aproxima o
-- SEU cartão (um por trabalhador) de um dispositivo Android fixo, associado a
-- um cliente. Escreve em `logs` tal como o QR (source='nfc') — `logs`
-- continua a ser a única fonte de verdade das horas.
--
-- As 3 tabelas ficam com RLS ativa e SEM policies: só a service role (os
-- endpoints serverless em api/formacao/index.js) as lê/escreve. Tokens e
-- UIDs de cartão nunca chegam ao browser via anon key.

CREATE TABLE IF NOT EXISTS ponto_terminais (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id TEXT NOT NULL REFERENCES clients(id),
  nome TEXT NOT NULL,
  -- sha256 do token longo guardado no dispositivo (o token em claro nunca é gravado)
  token_hash TEXT UNIQUE,
  -- sha256 do código de ativação de uso único (8 caracteres), com expiração
  codigo_hash TEXT UNIQUE,
  codigo_expira_em TIMESTAMPTZ,
  -- associação de cartão pendente: o próximo cartão desconhecido lido neste
  -- terminal fica associado a este trabalhador (pedido feito no admin)
  associar_worker_id TEXT REFERENCES workers(id),
  associar_expira_em TIMESTAMPTZ,
  ativo BOOLEAN NOT NULL DEFAULT true,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  ativado_em TIMESTAMPTZ,
  ultimo_contacto TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_ponto_terminais_client ON ponto_terminais(client_id);
ALTER TABLE ponto_terminais ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS cartoes_ponto (
  uid TEXT PRIMARY KEY,           -- serial NFC normalizado (hex maiúsculo, sem ':')
  worker_id TEXT NOT NULL REFERENCES workers(id),
  ativo BOOLEAN NOT NULL DEFAULT true,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cartoes_ponto_worker ON cartoes_ponto(worker_id);
ALTER TABLE cartoes_ponto ENABLE ROW LEVEL SECURITY;

-- Auditoria de cada toque, incluindo rejeitados. NÃO é fonte de horas.
CREATE TABLE IF NOT EXISTS ponto_terminal_picagens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  terminal_id UUID NOT NULL REFERENCES ponto_terminais(id),
  uid TEXT NOT NULL,
  worker_id TEXT,
  tipo TEXT,                      -- entrada | inicio_pausa | fim_pausa | saida
  resultado TEXT NOT NULL,        -- ok | repetido | cartao_desconhecido | cartao_bloqueado | nao_afeto | transicao_invalida | associado
  log_id TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ponto_terminal_picagens_uid ON ponto_terminal_picagens(uid, criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_ponto_terminal_picagens_terminal ON ponto_terminal_picagens(terminal_id, criado_em DESC);
ALTER TABLE ponto_terminal_picagens ENABLE ROW LEVEL SECURITY;

NOTIFY pgrst, 'reload schema';
