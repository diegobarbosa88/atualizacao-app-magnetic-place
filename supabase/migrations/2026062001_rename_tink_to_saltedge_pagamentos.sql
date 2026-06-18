-- Migrar pagamentos_fornecedores de Tink para Salt Edge

-- Renomear colunas (idempotente: só faz se a coluna antiga ainda existe)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='pagamentos_fornecedores' AND column_name='tink_payment_request_id') THEN
    ALTER TABLE pagamentos_fornecedores RENAME COLUMN tink_payment_request_id TO saltedge_payment_id;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='pagamentos_fornecedores' AND column_name='tink_auth_url') THEN
    ALTER TABLE pagamentos_fornecedores RENAME COLUMN tink_auth_url TO saltedge_auth_url;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='pagamentos_fornecedores' AND column_name='tink_status') THEN
    ALTER TABLE pagamentos_fornecedores RENAME COLUMN tink_status TO saltedge_status;
  END IF;
END $$;
ALTER TABLE pagamentos_fornecedores DROP COLUMN IF EXISTS tink_payment_id;

-- Remover constraint actual para permitir actualizar os dados sem restrição
ALTER TABLE pagamentos_fornecedores DROP CONSTRAINT IF EXISTS pagamentos_fornecedores_status_check;

-- Migrar dados de status existentes
UPDATE pagamentos_fornecedores SET status = 'iniciado_saltedge' WHERE status = 'iniciado_tink';
UPDATE pagamentos_fornecedores SET status = 'falhado_saltedge' WHERE status = 'falhado_tink';

-- Adicionar nova constraint com os valores Salt Edge
ALTER TABLE pagamentos_fornecedores ADD CONSTRAINT pagamentos_fornecedores_status_check
  CHECK (status IN ('pendente', 'exportado', 'enviado', 'confirmado', 'iniciado_saltedge', 'falhado_saltedge'));
