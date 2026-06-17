-- Adicionar colunas de suporte para tokens Tink OAuth à tabela system_settings
alter table system_settings 
  add column if not exists tink_access_token text,
  add column if not exists tink_refresh_token text,
  add column if not exists tink_token_expires_at timestamptz;
