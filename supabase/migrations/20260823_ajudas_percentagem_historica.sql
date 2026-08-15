-- Fase 1 da Calculadora de Ajudas de Custo — Saneamento do Histórico.
-- Cada linha é um cálculo imutável de percentagem histórica; só um
-- registo pode estar ativo (ativo=true) de cada vez — é o que a Fase 2
-- vai consultar para estimar as faturas do mês corrente.
CREATE TABLE IF NOT EXISTS ajudas_percentagem_historica (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  calculado_em            TIMESTAMPTZ NOT NULL DEFAULT now(),
  periodo_inicio          TEXT NOT NULL,   -- 'YYYY-MM'
  periodo_fim             TEXT NOT NULL,   -- 'YYYY-MM'
  percentagem             NUMERIC NOT NULL,
  total_ajudas_real       NUMERIC NOT NULL DEFAULT 0,
  total_bruto_referencia  NUMERIC NOT NULL DEFAULT 0,
  clientes_elegiveis      JSONB NOT NULL DEFAULT '[]',
  meses_incluidos         JSONB NOT NULL DEFAULT '[]',
  meses_excluidos         JSONB NOT NULL DEFAULT '[]',
  ativo                   BOOLEAN NOT NULL DEFAULT false,
  criado_por              TEXT,
  notas                   TEXT
);

-- Nunca dois registos ativos em simultâneo.
CREATE UNIQUE INDEX IF NOT EXISTS idx_ajudas_pct_hist_unico_ativo
  ON ajudas_percentagem_historica (ativo) WHERE ativo;

CREATE INDEX IF NOT EXISTS idx_ajudas_pct_hist_calculado_em
  ON ajudas_percentagem_historica (calculado_em DESC);
