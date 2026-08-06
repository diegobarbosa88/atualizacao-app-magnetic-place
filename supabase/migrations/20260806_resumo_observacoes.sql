CREATE TABLE IF NOT EXISTS resumo_observacoes (
  worker_id   UUID    NOT NULL,
  mes         TEXT    NOT NULL,
  observacao  TEXT    NOT NULL DEFAULT '',
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (worker_id, mes)
);

-- Activar real-time para esta tabela
ALTER PUBLICATION supabase_realtime ADD TABLE resumo_observacoes;
