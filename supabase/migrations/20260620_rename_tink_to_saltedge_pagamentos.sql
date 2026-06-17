-- Migrar pagamentos_fornecedores de Tink para Salt Edge

-- Renomear colunas
ALTER TABLE pagamentos_fornecedores RENAME COLUMN tink_payment_request_id TO saltedge_payment_id;
ALTER TABLE pagamentos_fornecedores RENAME COLUMN tink_auth_url TO saltedge_auth_url;
ALTER TABLE pagamentos_fornecedores RENAME COLUMN tink_status TO saltedge_status;
ALTER TABLE pagamentos_fornecedores DROP COLUMN IF EXISTS tink_payment_id;

-- Migrar dados de status existentes antes de actualizar a constraint
UPDATE pagamentos_fornecedores SET status = 'iniciado_saltedge' WHERE status = 'iniciado_tink';
UPDATE pagamentos_fornecedores SET status = 'falhado_saltedge' WHERE status = 'falhado_tink';

-- Actualizar constraint de status
ALTER TABLE pagamentos_fornecedores DROP CONSTRAINT IF EXISTS pagamentos_fornecedores_status_check;
ALTER TABLE pagamentos_fornecedores ADD CONSTRAINT pagamentos_fornecedores_status_check
  CHECK (status IN ('pendente', 'exportado', 'enviado', 'confirmado', 'iniciado_saltedge', 'falhado_saltedge'));
