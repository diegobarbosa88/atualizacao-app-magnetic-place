-- Requisitos de Formação Interna por profissão — permite ao admin marcar
-- quais ações e-learning são obrigatórias para cada profissão do catálogo
-- (src/data/profissoesEmpresa.js), e disparar a atribuição automática ao
-- criar um trabalhador novo com essa profissão (ver api/formacao/index.js,
-- ações "requisitos"/"requisitos-set"/"auto-atribuir").

CREATE TABLE IF NOT EXISTS formacao_requisitos_profissao (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profissao_cnp  TEXT NOT NULL,
  formacao_id    UUID NOT NULL REFERENCES formacoes_internas(id) ON DELETE CASCADE,
  ativo          BOOLEAN NOT NULL DEFAULT true,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (profissao_cnp, formacao_id)
);

CREATE INDEX IF NOT EXISTS idx_formacao_requisitos_profissao_cnp ON formacao_requisitos_profissao(profissao_cnp);

-- RLS fechada, mesmo padrão de formacoes_internas/formacao_participantes
-- (20260820_formacao_interna.sql) — todo o acesso passa por api/formacao/*.js
-- (requireAuth + service role), nunca policies para anon/authenticated.
ALTER TABLE formacao_requisitos_profissao ENABLE ROW LEVEL SECURITY;
