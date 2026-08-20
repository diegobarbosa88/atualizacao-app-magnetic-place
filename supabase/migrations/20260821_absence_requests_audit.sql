-- Log de auditoria para exclusão de pedidos de falta (worker/admin)
CREATE TABLE IF NOT EXISTS absence_requests_audit_log (
  id TEXT PRIMARY KEY,
  absence_request_id TEXT NOT NULL,
  worker_id TEXT NOT NULL,
  worker_name TEXT NOT NULL,
  client_id TEXT,
  dates JSONB NOT NULL DEFAULT '[]',
  reason TEXT,
  notes TEXT,
  status TEXT NOT NULL,
  original_created_at TIMESTAMPTZ,
  deleted_by TEXT NOT NULL,
  deleted_by_role TEXT NOT NULL,
  deleted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE absence_requests_audit_log DISABLE ROW LEVEL SECURITY;
