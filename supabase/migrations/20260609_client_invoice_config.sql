-- Configuração de serviços predefinidos por cliente para faturação
ALTER TABLE clients ADD COLUMN IF NOT EXISTS invoice_config JSONB DEFAULT NULL;
