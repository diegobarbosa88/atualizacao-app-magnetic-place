-- Formação Interna — extensão para cobrir certificações formais externas
-- com validade (ISO 9606, GWO, etc.), além da formação interna simples já
-- suportada (Art. 131.º CT). Complementa 20260820_formacao_interna.sql.

ALTER TABLE formacoes_internas ADD COLUMN IF NOT EXISTS categoria TEXT;
ALTER TABLE formacoes_internas ADD COLUMN IF NOT EXISTS tipo_formacao TEXT;
ALTER TABLE formacoes_internas ADD COLUMN IF NOT EXISTS entidade_externa TEXT;
ALTER TABLE formacoes_internas ADD COLUMN IF NOT EXISTS exige_entidade_externa BOOLEAN NOT NULL DEFAULT false;

-- Backfill de segurança para linhas eventualmente já existentes antes de
-- tornar as colunas obrigatórias.
UPDATE formacoes_internas
  SET categoria = 'onboarding', tipo_formacao = titulo
  WHERE categoria IS NULL;

ALTER TABLE formacoes_internas ALTER COLUMN categoria SET NOT NULL;
ALTER TABLE formacoes_internas ALTER COLUMN tipo_formacao SET NOT NULL;

ALTER TABLE formacoes_internas ADD CONSTRAINT formacoes_internas_categoria_check
  CHECK (categoria IN ('soldadura','caldeiraria','certificacao_formal','hst','equipamentos','gwo','onboarding'));

ALTER TABLE formacoes_internas ADD CONSTRAINT formacoes_internas_entidade_externa_check
  CHECK (NOT exige_entidade_externa OR entidade_externa IS NOT NULL);

ALTER TABLE formacao_participantes ADD COLUMN IF NOT EXISTS data_validade DATE;
-- Nota: sem coluna 'estado' — calculado em tempo real (view abaixo e
-- endpoints api/formacao/*.js), evitando a necessidade de um cron job.

CREATE INDEX IF NOT EXISTS idx_formacao_participantes_data_validade ON formacao_participantes(data_validade);
CREATE INDEX IF NOT EXISTS idx_formacoes_internas_categoria ON formacoes_internas(categoria);

-- View agregada de certificações ativas por trabalhador — só inclui
-- participações com data_validade definida (certificações com caducidade).
CREATE OR REPLACE VIEW worker_certificacoes_ativas AS
SELECT
  fp.worker_id,
  w.name AS worker_nome,
  fi.categoria,
  fi.tipo_formacao,
  fi.data_fim AS data_obtencao,
  fp.data_validade,
  CASE
    WHEN fp.data_validade < CURRENT_DATE THEN 'expirado'
    WHEN fp.data_validade <= CURRENT_DATE + INTERVAL '60 days' THEN 'a_expirar'
    ELSE 'valido'
  END AS estado
FROM formacao_participantes fp
JOIN formacoes_internas fi ON fi.id = fp.formacao_id
JOIN workers w ON w.id = fp.worker_id
WHERE fp.data_validade IS NOT NULL;
