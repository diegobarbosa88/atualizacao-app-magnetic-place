-- Tabela de convites de onboarding gerados pelo admin
CREATE TABLE IF NOT EXISTS worker_onboarding_invites (
  id          TEXT PRIMARY KEY,
  token       TEXT UNIQUE NOT NULL,
  email       TEXT,
  created_by  TEXT,
  created_at  TIMESTAMPTZ DEFAULT now(),
  expires_at  TIMESTAMPTZ DEFAULT (now() + INTERVAL '7 days'),
  used_at     TIMESTAMPTZ,
  status      TEXT DEFAULT 'pending'
);

ALTER TABLE worker_onboarding_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_select_invite" ON worker_onboarding_invites
  FOR SELECT USING (true);

CREATE POLICY "anon_insert_invite" ON worker_onboarding_invites
  FOR INSERT WITH CHECK (true);

CREATE POLICY "anon_update_invite" ON worker_onboarding_invites
  FOR UPDATE USING (true);

-- Tabela de submissões preenchidas pelos trabalhadores
CREATE TABLE IF NOT EXISTS worker_onboarding_submissions (
  id               TEXT PRIMARY KEY,
  invite_id        TEXT REFERENCES worker_onboarding_invites(id),
  nome             TEXT NOT NULL,
  profissao        TEXT,
  tel              TEXT,
  email            TEXT,
  dni              TEXT,
  address          TEXT,
  tabela_irs       TEXT DEFAULT 'tabelaI',
  n_dependentes    INTEGER DEFAULT 0,
  nis              TEXT,
  nif              TEXT,
  iban             TEXT,
  submitted_at     TIMESTAMPTZ DEFAULT now(),
  status           TEXT DEFAULT 'pending',
  rejection_reason TEXT,
  reviewed_at      TIMESTAMPTZ,
  data_inicio      DATE,
  vencimento_base  NUMERIC,
  valorHora        NUMERIC
);

ALTER TABLE worker_onboarding_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_insert_submission" ON worker_onboarding_submissions
  FOR INSERT WITH CHECK (true);

CREATE POLICY "anon_select_submission" ON worker_onboarding_submissions
  FOR SELECT USING (true);

CREATE POLICY "anon_update_submission" ON worker_onboarding_submissions
  FOR UPDATE USING (true);
