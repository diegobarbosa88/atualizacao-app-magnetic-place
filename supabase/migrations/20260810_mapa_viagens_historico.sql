-- Histórico de mapas de ajudas de custo por trabalhador/mês
-- Persistido ao exportar o PDF do mapa (individual ou batch)
CREATE TABLE IF NOT EXISTS mapa_viagens_historico (
  id          BIGSERIAL PRIMARY KEY,
  worker_id   TEXT NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
  mes         TEXT NOT NULL,          -- 'YYYY-MM'
  data_partida DATE NOT NULL,
  data_chegada DATE NOT NULL,
  hora_partida TEXT,
  hora_chegada TEXT,
  n_dias       INTEGER,
  created_at   TIMESTAMPTZ DEFAULT now(),
  updated_at   TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS mapa_viagens_historico_worker_mes
  ON mapa_viagens_historico (worker_id, mes);

CREATE INDEX IF NOT EXISTS mapa_viagens_historico_mes
  ON mapa_viagens_historico (mes);

ALTER TABLE mapa_viagens_historico ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_all" ON mapa_viagens_historico
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
