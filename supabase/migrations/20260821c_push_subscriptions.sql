-- Subscrições de push notifications reais (P2 da proposta de notificações).
-- role: 'admin' | 'worker' | 'client'. user_id fica null para admin (conta única);
-- para worker/client guarda o id respetivo. Um utilizador pode ter várias
-- subscrições (um por browser/dispositivo).
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id TEXT PRIMARY KEY,
  role TEXT NOT NULL,
  user_id TEXT,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE push_subscriptions DISABLE ROW LEVEL SECURITY;
