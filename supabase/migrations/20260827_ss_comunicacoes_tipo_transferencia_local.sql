-- Alarga o CHECK de ss_comunicacoes.tipo para o novo serviço de escrita
-- "Transferir Local de Trabalho" (transferirLocalTrabalhoTrabalhadorEE,
-- REST PUT). Mesmo padrão de 20260830_ss_comunicacoes_tipo_escrita.sql —
-- idempotente, dropa e recria o CHECK em vez de assumir o nome dele.

DO $$
DECLARE
  c_name TEXT;
BEGIN
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
  CHECK (tipo IN (
    'admissao', 'cessacao', 'consulta',
    'alteracao_contrato', 'cancelamento_documento_pagamento', 'emissao_documento_pagamento',
    'transferencia_local_trabalho'
  ));

NOTIFY pgrst, 'reload schema';
