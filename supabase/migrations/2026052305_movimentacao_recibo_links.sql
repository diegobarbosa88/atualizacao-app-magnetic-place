CREATE TABLE IF NOT EXISTS movimentacao_recibo_links (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id       UUID NOT NULL,
  tx_key       TEXT NOT NULL,
  worker_id    TEXT,
  worker_name  TEXT NOT NULL,
  mes          TEXT NOT NULL,
  auto_matched BOOLEAN DEFAULT FALSE,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(run_id, tx_key)
);

ALTER TABLE movimentacao_recibo_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow anon select movimentacao_recibo_links" ON movimentacao_recibo_links;
CREATE POLICY "Allow anon select movimentacao_recibo_links"
  ON movimentacao_recibo_links FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow anon insert movimentacao_recibo_links" ON movimentacao_recibo_links;
CREATE POLICY "Allow anon insert movimentacao_recibo_links"
  ON movimentacao_recibo_links FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anon update movimentacao_recibo_links" ON movimentacao_recibo_links;
CREATE POLICY "Allow anon update movimentacao_recibo_links"
  ON movimentacao_recibo_links FOR UPDATE USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anon delete movimentacao_recibo_links" ON movimentacao_recibo_links;
CREATE POLICY "Allow anon delete movimentacao_recibo_links"
  ON movimentacao_recibo_links FOR DELETE USING (true);
