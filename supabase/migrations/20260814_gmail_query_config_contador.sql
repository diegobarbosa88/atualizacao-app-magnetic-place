-- Query Gmail configurável para o novo mode 'contador' (mesmo padrão de gmail_query_config)
ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS gmail_query_config_contador JSONB;
