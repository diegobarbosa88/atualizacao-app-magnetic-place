-- Migration: Add notification_preferences column to system_settings
-- This column stores granular notification preferences per notification type

ALTER TABLE system_settings
ADD COLUMN IF NOT EXISTS notification_preferences JSONB DEFAULT '{
  "correction_applied": { "db": false, "email": false },
  "correction_resolved": { "db": false, "email": false },
  "creation_request_approved": { "db": false, "email": false },
  "correction_rejected": { "db": false, "email": false },
  "correcao_aplicada": { "db": false, "email": false },
  "correcao_aplicada_precision": { "db": false, "email": false },
  "correcao_rejeitada": { "db": false, "email": false },
  "reporte_divergencia_rejeitado": { "db": false, "email": false },
  "validacao_anulada": { "db": false, "email": false }
}'::JSONB;

COMMENT ON COLUMN system_settings.notification_preferences IS 'Granular notification preferences for client notifications. Format: { "notification_type": { "db": boolean, "email": boolean } }';