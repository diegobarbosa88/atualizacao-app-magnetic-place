-- Migration: system_settings.company_email / company_phone
-- saveSystemSettings() (src/context/AppContext.jsx) já enviava estas duas
-- colunas em todo o upsert de Configurações desde sempre, mas nunca tinham
-- sido criadas — qualquer gravação em Configurações (Geral e Integrações,
-- incluindo a chave API Gemini) falhava sempre com PGRST204 ("Could not
-- find the 'company_email' column"), sem nunca aparecer ao admin (o erro só
-- ia para console.error). Usadas por FaturaConfigPanel.jsx/faturasExport.js
-- como contacto da empresa mostrado nas faturas — distintas de
-- responsible_email (quem assina/recebe notificações de validação).
ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS company_email TEXT;
ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS company_phone TEXT;
COMMENT ON COLUMN system_settings.company_email IS 'Email de contacto da empresa, mostrado em faturas (distinto de responsible_email, que é quem assina/recebe notificações).';
COMMENT ON COLUMN system_settings.company_phone IS 'Telefone de contacto da empresa, mostrado em faturas.';
