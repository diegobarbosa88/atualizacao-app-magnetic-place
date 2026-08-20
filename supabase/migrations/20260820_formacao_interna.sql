-- Formação Interna — ações de formação dadas diretamente pela empresa aos
-- trabalhadores, para cumprimento do Art. 131.º CT (40h/ano), sem passar
-- por entidade certificada DGERT/SIGO.

CREATE TABLE IF NOT EXISTS formacoes_internas (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo                   TEXT NOT NULL,
  data_inicio              DATE NOT NULL,
  data_fim                 DATE NOT NULL,
  duracao_horas            NUMERIC NOT NULL CHECK (duracao_horas > 0),
  local                    TEXT,
  formador_id              TEXT REFERENCES workers(id),
  objetivos                TEXT,
  conteudo_programatico    TEXT,
  justificativa_afinidade  TEXT,
  metodo_avaliacao         TEXT,
  resultado_avaliacao      TEXT,
  evidencias_url           TEXT,
  criado_em                TIMESTAMPTZ DEFAULT now(),
  CHECK (data_fim >= data_inicio)
);

CREATE TABLE IF NOT EXISTS formacao_participantes (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  formacao_id    UUID NOT NULL REFERENCES formacoes_internas(id) ON DELETE CASCADE,
  worker_id      TEXT NOT NULL REFERENCES workers(id),
  assinatura_url TEXT,
  assinado_em    TIMESTAMPTZ,
  UNIQUE (formacao_id, worker_id)
);

CREATE INDEX IF NOT EXISTS idx_formacao_participantes_worker ON formacao_participantes(worker_id);
CREATE INDEX IF NOT EXISTS idx_formacao_participantes_formacao ON formacao_participantes(formacao_id);
CREATE INDEX IF NOT EXISTS idx_formacoes_internas_data_inicio ON formacoes_internas(data_inicio);

-- RLS fechada: sem policies para anon/authenticated. Todo o acesso passa
-- pelos endpoints api/formacao/*.js (requireAuth + service role), seguindo
-- o padrão de api/toconline/create-fatura.js — não o padrão legado
-- "using(true)" usado nas tabelas admin mais antigas.
ALTER TABLE formacoes_internas ENABLE ROW LEVEL SECURITY;
ALTER TABLE formacao_participantes ENABLE ROW LEVEL SECURITY;

-- Bucket de assinaturas e evidências das ações de formação (privado —
-- acesso só via service role nos endpoints api/formacao/*.js).
INSERT INTO storage.buckets (id, name, public)
  VALUES ('formacao-interna', 'formacao-interna', false)
  ON CONFLICT (id) DO NOTHING;
