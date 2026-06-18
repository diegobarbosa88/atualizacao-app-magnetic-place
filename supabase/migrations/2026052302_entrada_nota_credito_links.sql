CREATE TABLE IF NOT EXISTS entrada_nota_credito_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL,
  tx_key TEXT NOT NULL,
  client_id TEXT NOT NULL,
  period TEXT NOT NULL,
  notas TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(run_id, tx_key)
);

ALTER TABLE entrada_nota_credito_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow anon select entrada_nota_credito_links" ON entrada_nota_credito_links;
CREATE POLICY "Allow anon select entrada_nota_credito_links"
  ON entrada_nota_credito_links FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow anon insert entrada_nota_credito_links" ON entrada_nota_credito_links;
CREATE POLICY "Allow anon insert entrada_nota_credito_links"
  ON entrada_nota_credito_links FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anon update entrada_nota_credito_links" ON entrada_nota_credito_links;
CREATE POLICY "Allow anon update entrada_nota_credito_links"
  ON entrada_nota_credito_links FOR UPDATE USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anon delete entrada_nota_credito_links" ON entrada_nota_credito_links;
CREATE POLICY "Allow anon delete entrada_nota_credito_links"
  ON entrada_nota_credito_links FOR DELETE USING (true);
