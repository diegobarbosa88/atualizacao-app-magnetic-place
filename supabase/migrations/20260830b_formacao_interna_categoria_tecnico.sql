-- Nova categoria "tecnico" (Técnico) em Formação Interna — cursos
-- e-learning de metalomecânica geral (desenho técnico, metrologia,
-- metalurgia, simbologia de soldadura, preparação para exame de
-- qualificação, hidráulica/pneumática) que não são só sobre soldadura nem
-- sobre equipamentos específicos, e por isso não encaixavam em nenhuma das
-- 7 categorias existentes.

ALTER TABLE formacoes_internas DROP CONSTRAINT formacoes_internas_categoria_check;

ALTER TABLE formacoes_internas ADD CONSTRAINT formacoes_internas_categoria_check
  CHECK (categoria = ANY (ARRAY['soldadura', 'caldeiraria', 'certificacao_formal', 'hst', 'equipamentos', 'gwo', 'onboarding', 'tecnico']));
