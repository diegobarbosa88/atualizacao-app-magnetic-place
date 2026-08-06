CREATE TABLE IF NOT EXISTS resumo_config (
  chave      TEXT PRIMARY KEY,
  valor      JSONB        NOT NULL DEFAULT '[]',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Activar real-time para esta tabela
ALTER PUBLICATION supabase_realtime ADD TABLE resumo_config;
