-- Formação Interna — e-learning: conteúdo (vídeo/PDF) + questionário com
-- correção automática, para ações formato = 'e-learning'. A assinatura só
-- é permitida depois de estado_conclusao = 'concluido' (ver api/formacao/sign.js).

ALTER TABLE formacoes_internas ADD COLUMN IF NOT EXISTS formato TEXT NOT NULL DEFAULT 'presencial';
ALTER TABLE formacoes_internas ADD CONSTRAINT formacoes_internas_formato_check
  CHECK (formato IN ('presencial', 'e-learning'));

ALTER TABLE formacoes_internas ADD COLUMN IF NOT EXISTS conteudo_url TEXT;
ALTER TABLE formacoes_internas ADD COLUMN IF NOT EXISTS questionario JSONB;
ALTER TABLE formacoes_internas ADD COLUMN IF NOT EXISTS nota_minima_aprovacao NUMERIC;

-- Cada elemento de `questionario`: { "pergunta": text, "opcoes": [text, ...],
-- "resposta_correta": <índice em opcoes> }. resposta_correta nunca é
-- devolvida ao worker antes da submissão — ver api/formacao/minhas.js.
ALTER TABLE formacoes_internas ADD CONSTRAINT formacoes_internas_elearning_completo_check
  CHECK (formato != 'e-learning' OR (conteudo_url IS NOT NULL AND questionario IS NOT NULL AND nota_minima_aprovacao IS NOT NULL));

ALTER TABLE formacao_participantes ADD COLUMN IF NOT EXISTS iniciado_em TIMESTAMPTZ;
ALTER TABLE formacao_participantes ADD COLUMN IF NOT EXISTS concluido_em TIMESTAMPTZ;
ALTER TABLE formacao_participantes ADD COLUMN IF NOT EXISTS respostas_questionario JSONB;
ALTER TABLE formacao_participantes ADD COLUMN IF NOT EXISTS nota_obtida NUMERIC;

ALTER TABLE formacao_participantes ADD COLUMN IF NOT EXISTS estado_conclusao TEXT NOT NULL DEFAULT 'nao_iniciado';
ALTER TABLE formacao_participantes ADD CONSTRAINT formacao_participantes_estado_conclusao_check
  CHECK (estado_conclusao IN ('nao_iniciado', 'em_progresso', 'concluido', 'reprovado'));
