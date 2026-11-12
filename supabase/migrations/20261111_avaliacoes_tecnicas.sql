-- Avaliação técnica de candidatos (Caldeireiro Industrial — interpretação de plano).
--
-- Fluxo: o admin cria um convite (Equipa › Avaliações) e escolhe o nível; o
-- candidato abre /avaliacao/<token>, preenche os dados e faz a prova; as respostas
-- são corrigidas no servidor (api/_avaliacoes.js → src/features/avaliacao-tecnica/
-- lib/grading.js) e o resultado fica gravado aqui.
--
-- RLS ativa e SEM policies: nem `anon` nem `authenticated` leem ou escrevem esta
-- tabela diretamente. Todo o acesso passa pelos endpoints serverless com a service
-- role (mesmo padrão de clients_qr_secrets, 20260909b). O token do link é o único
-- segredo que o candidato tem, e só serve para os 3 endpoints públicos.
CREATE TABLE IF NOT EXISTS avaliacoes_tecnicas (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token                 TEXT UNIQUE NOT NULL,
  nivel                 TEXT NOT NULL CHECK (nivel IN ('meio-oficial', 'pleno', 'especialista')),
  -- Variante do plano (as medidas mudam de prova para prova). Sorteada no servidor
  -- ao criar o convite; só é revelada ao navegador quando a prova começa.
  seed                  INTEGER NOT NULL,
  plan_variant          TEXT NOT NULL,
  status                TEXT NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
  vaga                  TEXT,
  created_by            TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at            TIMESTAMPTZ NOT NULL,
  -- Quantas vezes o admin reabriu o link (prova interrompida, link expirado)
  reaberturas           INTEGER NOT NULL DEFAULT 0,

  -- Dados do candidato: nome/telefone podem vir pré-preenchidos pelo admin; o
  -- candidato confirma/preenche o resto ao iniciar.
  candidato_nome        TEXT,
  candidato_telefone    TEXT,
  candidato_email       TEXT,
  candidato_experiencia TEXT,
  candidato_localidade  TEXT,
  rgpd_consentido_em    TIMESTAMPTZ,

  started_at            TIMESTAMPTZ,
  completed_at          TIMESTAMPTZ,
  user_agent            TEXT,

  -- Resultado (corrigido no servidor). `resultado` guarda o registo completo
  -- (respostas por pergunta, plano da variante, integridade) para o relatório.
  overall_score         SMALLINT,
  score_localizacao     SMALLINT,
  score_calculo         SMALLINT,
  score_simbologia      SMALLINT,
  score_agilidade       SMALLINT,
  classification        TEXT CHECK (classification IN ('apto', 'em-avaliacao', 'nao-recomendado')),
  abandonada            BOOLEAN,
  resultado             JSONB
);

CREATE INDEX IF NOT EXISTS avaliacoes_tecnicas_created_at_idx ON avaliacoes_tecnicas (created_at DESC);

ALTER TABLE avaliacoes_tecnicas ENABLE ROW LEVEL SECURITY;

NOTIFY pgrst, 'reload schema';
