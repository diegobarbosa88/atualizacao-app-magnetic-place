-- Adicionar campos de integração Tink à tabela pagamentos_fornecedores
alter table pagamentos_fornecedores 
  add column if not exists tink_payment_request_id text,
  add column if not exists tink_payment_id text,
  add column if not exists tink_status text,
  add column if not exists tink_auth_url text;

-- Atualizar a constraint de status para incluir os estados relacionados ao Tink
alter table pagamentos_fornecedores 
  drop constraint if exists pagamentos_fornecedores_status_check;

alter table pagamentos_fornecedores 
  add constraint pagamentos_fornecedores_status_check 
  check (status in ('pendente', 'exportado', 'enviado', 'confirmado', 'iniciado_tink', 'falhado_tink'));
