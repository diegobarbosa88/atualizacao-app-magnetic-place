CREATE TABLE IF NOT EXISTS fatura_pagamento_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fatura_id UUID NOT NULL,
  run_id UUID NOT NULL,
  tx_key TEXT NOT NULL,
  auto_matched BOOLEAN DEFAULT FALSE,
  notas TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(fatura_id)
);

ALTER TABLE fatura_pagamento_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anon select fatura_pagamento_links"
  ON fatura_pagamento_links FOR SELECT
  USING (true);

CREATE POLICY "Allow anon insert fatura_pagamento_links"
  ON fatura_pagamento_links FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow anon update fatura_pagamento_links"
  ON fatura_pagamento_links FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow anon delete fatura_pagamento_links"
  ON fatura_pagamento_links FOR DELETE
  USING (true);
