-- Recriar com worker_id TEXT (IDs da app são strings, não UUIDs)
DROP TABLE IF EXISTS resumo_observacoes;

CREATE TABLE resumo_observacoes (
  worker_id    TEXT        NOT NULL,
  mes          TEXT        NOT NULL,
  observacao   TEXT        NOT NULL DEFAULT '',
  completo     BOOLEAN     NOT NULL DEFAULT FALSE,
  ajuste_bruto NUMERIC     DEFAULT 0,
  updated_at   TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (worker_id, mes)
);

ALTER TABLE resumo_observacoes DISABLE ROW LEVEL SECURITY;
ALTER PUBLICATION supabase_realtime ADD TABLE resumo_observacoes;
