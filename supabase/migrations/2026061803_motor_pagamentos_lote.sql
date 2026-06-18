-- Motor Unificado de Pagamentos: tabelas de suporte ao lote Salt Edge

-- 1. Faturas internacionais vindas do e-mail (centro de documentos)
CREATE TABLE IF NOT EXISTS faturas_centro_documentos (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at           TIMESTAMPTZ NOT NULL    DEFAULT now(),
  fornecedor           TEXT        NOT NULL,
  fornecedor_nif       TEXT,
  fornecedor_iban      TEXT,
  valor                NUMERIC(12, 2) NOT NULL CHECK (valor > 0),
  data_documento       DATE,
  referencia           TEXT,
  descricao            TEXT,
  moeda                TEXT        NOT NULL    DEFAULT 'EUR',
  estado_pagamento     TEXT        NOT NULL    DEFAULT 'pendente',
  salt_edge_payment_id TEXT,
  storage_path         TEXT,
  url                  TEXT
);

CREATE INDEX IF NOT EXISTS idx_fcd_estado
  ON faturas_centro_documentos(estado_pagamento);

CREATE INDEX IF NOT EXISTS idx_fcd_salt_edge
  ON faturas_centro_documentos(salt_edge_payment_id)
  WHERE salt_edge_payment_id IS NOT NULL;

-- 2. Tabela ponte: relaciona pagamentos Salt Edge com documentos TOConline
CREATE TABLE IF NOT EXISTS toconline_pagamentos_pendentes (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at           TIMESTAMPTZ NOT NULL    DEFAULT now(),
  salt_edge_payment_id TEXT        NOT NULL,
  toconline_doc_id     TEXT        NOT NULL,
  estado               TEXT        NOT NULL    DEFAULT 'processando'
    CHECK (estado IN ('processando', 'pago', 'erro'))
);

CREATE INDEX IF NOT EXISTS idx_tpp_salt_edge
  ON toconline_pagamentos_pendentes(salt_edge_payment_id);
