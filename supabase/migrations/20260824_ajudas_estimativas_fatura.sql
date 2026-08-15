-- Necessária já na Fase 1 (não só na Fase 2): o passo "Rateio Proporcional
-- Histórico" do saneamento grava aqui uma linha por fatura já emitida no
-- período de saneamento, com origem='historico' e status='historico'
-- (auditoria retroativa — nunca entra no fail-closed nem no rateio de
-- resíduo). Ver documento de arquitetura, secção 1.3.
--
-- status: 'calculado' | 'bloqueado' | 'confirmado' | 'faturado' | 'historico'.
-- 'confirmado' é estado intermédio explícito (decisão registada em
-- src/lib/ajudas/DECISIONS.md) — não escrito nesta sessão, só reservado.
CREATE TABLE IF NOT EXISTS ajudas_estimativas_fatura (
  id                              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mes                             TEXT NOT NULL,   -- 'YYYY-MM' — mês de referência
  client_id                       TEXT NOT NULL,
  fatura_id                       TEXT,            -- nº documento TOConline; NULL enquanto não existe fatura
  percentagem_historica_id        UUID REFERENCES ajudas_percentagem_historica(id),
  residuo_mes_anterior_aplicado   NUMERIC NOT NULL DEFAULT 0,
  valor_estimado_bruto            NUMERIC NOT NULL DEFAULT 0,
  valor_final                     NUMERIC NOT NULL DEFAULT 0,
  status                          TEXT NOT NULL DEFAULT 'calculado'
                                   CHECK (status IN ('calculado', 'bloqueado', 'confirmado', 'faturado', 'historico')),
  origem                          TEXT NOT NULL DEFAULT 'estimativa'
                                   CHECK (origem IN ('estimativa', 'historico')),
  motivo_bloqueio                 TEXT,
  valor_observacao_manual         NUMERIC,
  criado_em                       TIMESTAMPTZ NOT NULL DEFAULT now(),
  confirmado_por                  TEXT,
  confirmado_em                   TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ajudas_estim_fatura_unico
  ON ajudas_estimativas_fatura (mes, client_id, fatura_id);

CREATE INDEX IF NOT EXISTS idx_ajudas_estim_fatura_mes ON ajudas_estimativas_fatura (mes);
CREATE INDEX IF NOT EXISTS idx_ajudas_estim_fatura_client ON ajudas_estimativas_fatura (client_id);
CREATE INDEX IF NOT EXISTS idx_ajudas_estim_fatura_status ON ajudas_estimativas_fatura (status);
