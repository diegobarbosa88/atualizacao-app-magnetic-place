-- Alarga o CHECK de ss_comunicacoes.tipo para os 3 novos serviços de
-- escrita real da PSI (Alterar Contrato, Cancelar/Emitir Documento de
-- Pagamento). Confirmado ao vivo (2026-08-25) que a coluna TEM CHECK
-- constraint (ss_comunicacoes_tipo_check, restrito a
-- admissao/cessacao/consulta) — ao contrário do que se assumia ao escrever
-- api/seguranca-social/index.js. Sem esta migração, qualquer insert com os
-- novos valores de tipo falha silenciosamente só no momento do envio real.
-- Idempotente, mesmo padrão de 20260809_ss_consultas_fase1.sql.

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
    'alteracao_contrato', 'cancelamento_documento_pagamento', 'emissao_documento_pagamento'
  ));

NOTIFY pgrst, 'reload schema';
