-- Formação Interna — conteúdo e-learning renderizado na app (não só
-- PDF/vídeo embutido). Cada elemento de `seccoes`: { "titulo": text,
-- "paragrafos": [text, ...] } e/ou { "titulo": text, "lista": [text, ...] }.
-- conteudo_url continua a existir para vídeo/PDF de apoio (opcional quando
-- há conteudo_estruturado) — ver constraint abaixo.

ALTER TABLE formacoes_internas ADD COLUMN IF NOT EXISTS conteudo_estruturado JSONB;

ALTER TABLE formacoes_internas DROP CONSTRAINT IF EXISTS formacoes_internas_elearning_completo_check;
ALTER TABLE formacoes_internas ADD CONSTRAINT formacoes_internas_elearning_completo_check
  CHECK (formato != 'e-learning' OR (
    (conteudo_url IS NOT NULL OR conteudo_estruturado IS NOT NULL)
    AND questionario IS NOT NULL
    AND nota_minima_aprovacao IS NOT NULL
  ));
