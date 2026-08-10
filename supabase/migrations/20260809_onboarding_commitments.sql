-- Tabela de compromissos de início de atividade assinados no onboarding
CREATE TABLE IF NOT EXISTS onboarding_commitments (
  id                TEXT PRIMARY KEY,
  invite_id         TEXT REFERENCES worker_onboarding_invites(id),
  submission_id     TEXT,  -- preenchido após insert em worker_onboarding_submissions
  nome              TEXT NOT NULL,
  documento_id      TEXT,
  assinatura_base64 TEXT NOT NULL,
  texto_hash        TEXT NOT NULL,   -- SHA-256 do texto legal aceite (versionamento)
  texto_versao      TEXT NOT NULL DEFAULT 'v1.0',
  pdf_url           TEXT,            -- URL público no bucket onboarding-commitments
  ip                TEXT,
  user_agent        TEXT,
  created_at        TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE onboarding_commitments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_insert_commitment" ON onboarding_commitments
  FOR INSERT WITH CHECK (true);

CREATE POLICY "anon_select_commitment" ON onboarding_commitments
  FOR SELECT USING (true);

CREATE POLICY "anon_update_commitment" ON onboarding_commitments
  FOR UPDATE USING (true);

-- Bucket de PDFs de compromisso (público para URLs diretos funcionarem nos emails)
INSERT INTO storage.buckets (id, name, public)
  VALUES ('onboarding-commitments', 'onboarding-commitments', true)
  ON CONFLICT (id) DO NOTHING;
