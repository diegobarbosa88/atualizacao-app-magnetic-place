-- Schema da Fase 3 (Reconciliação Mensal), criado antecipadamente na Fase 2a
-- só para estimativaMensal.js poder consultar resíduo pendente sem tratar
-- "tabela inexistente" como caso especial — a tabela fica vazia até
-- reconciliacao.js ser implementado (fora do âmbito desta sessão).
-- Ver documento de arquitetura, secção 1.4.
CREATE TABLE IF NOT EXISTS ajudas_reconciliacao_mensal (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mes             TEXT NOT NULL UNIQUE,   -- 'YYYY-MM' — mês que fechou
  total_real      NUMERIC NOT NULL DEFAULT 0,
  total_estimado  NUMERIC NOT NULL DEFAULT 0,
  residuo         NUMERIC NOT NULL DEFAULT 0,
  mes_aplicacao   TEXT,                   -- 'YYYY-MM' — mês seguinte onde o resíduo é/foi aplicado
  status          TEXT NOT NULL DEFAULT 'pendente'
                  CHECK (status IN ('pendente', 'aplicado', 'ignorado')),
  aplicado_em     TIMESTAMPTZ,
  aplicado_por    TEXT
);

CREATE INDEX IF NOT EXISTS idx_ajudas_reconc_mes_aplicacao
  ON ajudas_reconciliacao_mensal (mes_aplicacao, status);
