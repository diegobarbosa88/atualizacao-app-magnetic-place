-- Padronização de notificações (P0): campo genérico de "lido", válido para
-- qualquer perfil (admin/client/worker), a substituir gradualmente
-- read_by_admin_ids / viewed_by_ids consoante os consumidores forem migrados.
ALTER TABLE app_notifications
  ADD COLUMN IF NOT EXISTS read_by_ids JSONB DEFAULT '[]'::jsonb;
