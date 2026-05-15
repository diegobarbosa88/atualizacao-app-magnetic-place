-- Migration: Admin email — guardar destinatário de notificações de validação
ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS responsible_email TEXT;
COMMENT ON COLUMN system_settings.responsible_email IS
  'Email do responsável da Magnetic — recebe notificações de validação do relatório.';
