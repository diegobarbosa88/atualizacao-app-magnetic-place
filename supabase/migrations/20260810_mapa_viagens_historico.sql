-- Histórico de mapas de ajudas de custo por trabalhador/mês
-- Persistido ao clicar "Validar e concluir" na calculadora de recibos
-- PRIMARY KEY (worker_id, mes) para onConflict funcionar via PostgREST
DROP TABLE IF EXISTS mapa_viagens_historico;

CREATE TABLE mapa_viagens_historico (
  worker_id    TEXT        NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
  mes          TEXT        NOT NULL,          -- 'YYYY-MM'
  data_partida DATE        NOT NULL,
  data_chegada DATE        NOT NULL,
  hora_partida TEXT,
  hora_chegada TEXT,
  n_dias       INTEGER,
  created_at   TIMESTAMPTZ DEFAULT now(),
  updated_at   TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (worker_id, mes)
);

ALTER TABLE mapa_viagens_historico DISABLE ROW LEVEL SECURITY;
