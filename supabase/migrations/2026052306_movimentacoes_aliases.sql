CREATE TABLE IF NOT EXISTS movimentacoes_aliases (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_name   TEXT NOT NULL,
  resolucao   TEXT NOT NULL CHECK (resolucao IN ('nota_credito', 'interno')),
  client_id   TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(bank_name)
);

ALTER TABLE movimentacoes_aliases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow anon select movimentacoes_aliases" ON movimentacoes_aliases;
CREATE POLICY "Allow anon select movimentacoes_aliases"
  ON movimentacoes_aliases FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow anon insert movimentacoes_aliases" ON movimentacoes_aliases;
CREATE POLICY "Allow anon insert movimentacoes_aliases"
  ON movimentacoes_aliases FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anon update movimentacoes_aliases" ON movimentacoes_aliases;
CREATE POLICY "Allow anon update movimentacoes_aliases"
  ON movimentacoes_aliases FOR UPDATE USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anon delete movimentacoes_aliases" ON movimentacoes_aliases;
CREATE POLICY "Allow anon delete movimentacoes_aliases"
  ON movimentacoes_aliases FOR DELETE USING (true);
