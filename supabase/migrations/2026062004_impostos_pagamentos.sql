CREATE TABLE IF NOT EXISTS impostos_pagamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  tipo TEXT NOT NULL,
  periodo TEXT,
  valor NUMERIC(12,2) NOT NULL CHECK (valor > 0),
  data_vencimento DATE,
  referencia TEXT,
  iban_destino TEXT NOT NULL,
  descricao TEXT,
  status TEXT NOT NULL DEFAULT 'pendente'
    CHECK (status IN ('pendente','rejeitado','exportado')),
  storage_path TEXT,
  url TEXT,
  notas_rejeicao TEXT,
  sepa_msg_id TEXT
);
