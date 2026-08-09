-- Fase 1 PSI: adicionar 'consulta' ao CHECK de ss_comunicacoes.tipo
-- e tornar worker_id nullable (consultas são ao nível empresa, sem trabalhador específico).
-- Idempotente: usa DO $$...END para dropar apenas se existir.

DO $$
DECLARE
  c_name TEXT;
BEGIN
  -- Encontrar o nome do CHECK constraint de tipo
  SELECT constraint_name INTO c_name
  FROM information_schema.table_constraints tc
  JOIN information_schema.check_constraints cc USING (constraint_catalog, constraint_schema, constraint_name)
  WHERE tc.table_name = 'ss_comunicacoes'
    AND tc.constraint_type = 'CHECK'
    AND cc.check_clause LIKE '%tipo%'
  LIMIT 1;

  IF c_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE ss_comunicacoes DROP CONSTRAINT %I', c_name);
  END IF;
END $$;

ALTER TABLE ss_comunicacoes
  ADD CONSTRAINT ss_comunicacoes_tipo_check
  CHECK (tipo IN ('admissao', 'cessacao', 'consulta'));

-- worker_id já é nullable (sem NOT NULL na criação) — apenas documenta a intenção:
-- consultas têm worker_id = NULL (consulta de empresa, não de trabalhador individual)
COMMENT ON COLUMN ss_comunicacoes.worker_id IS
  'NULL para consultas de empresa (tipo=consulta); obrigatório para admissao/cessacao';
