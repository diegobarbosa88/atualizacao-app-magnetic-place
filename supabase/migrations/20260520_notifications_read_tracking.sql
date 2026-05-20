-- Tracking de leitura pelo admin nas notificações gerais
ALTER TABLE app_notifications ADD COLUMN IF NOT EXISTS read_by_admin_ids JSONB DEFAULT '[]';

-- Tracking de visualização pelo admin nas correções
ALTER TABLE corrections ADD COLUMN IF NOT EXISTS viewed_by_admin_ids JSONB DEFAULT '[]';
