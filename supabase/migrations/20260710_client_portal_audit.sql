-- Auditoria de ações do cliente no portal
-- Regista tudo: CRUD de logs, aprovações/rejeições de pedidos de trabalhadores

CREATE TABLE IF NOT EXISTS client_portal_audit_logs (
  id          TEXT PRIMARY KEY,
  client_id   TEXT NOT NULL,
  client_name TEXT,
  action      TEXT NOT NULL,
  -- 'log_criado' | 'log_editado' | 'log_eliminado' | 'pedido_aprovado' | 'pedido_rejeitado'
  worker_id   TEXT,
  worker_name TEXT,
  log_id      TEXT,
  date        DATE,
  before_data JSONB,
  after_data  JSONB,
  note        TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE client_portal_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "client_portal_audit_all"
  ON client_portal_audit_logs
  FOR ALL
  USING (true)
  WITH CHECK (true);
