-- Novo método do numerador da % histórica (substitui a atribuição por
-- horas em logs, via distribuicaoHoras.js — ver DECISIONS.md e
-- src/lib/ajudas/valoresPorFatura.js). Uma linha por fatura de venda real
-- do mês (todos os clientes, elegíveis e não elegíveis), com o valor de
-- ajuda de custo que lhe foi atribuído: declarado na própria observação da
-- fatura, ou uma fatia do resíduo (total real de recibos do mês menos o
-- total já declarado), rateada proporcionalmente ao valor da fatura.
--
-- Corre de forma contínua (passado e futuro), não só no saneamento
-- inicial — ao contrário de ajudas_estimativas_fatura (origem='historico'),
-- que só cobre o período de saneamento da Fase 1.
--
-- calcularValoresPorClienteMes é uma função pura de leitura — não escreve
-- aqui sozinha; a gravação nesta tabela é sempre uma ação explícita de
-- quem chama (ainda não gravada nesta sessão — só a tabela foi criada).
CREATE TABLE IF NOT EXISTS ajudas_valores_por_cliente_mes (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mes               TEXT NOT NULL,      -- 'YYYY-MM'
  client_id         TEXT NOT NULL,
  fatura_id         TEXT NOT NULL,      -- nº documento TOConline
  valor_fatura      NUMERIC NOT NULL,   -- valor total da fatura
  valor_declarado   NUMERIC,            -- extraído da observação, quando existir; NULL senão
  valor_atribuido   NUMERIC NOT NULL,   -- valor final: declarado, ou fatia do resíduo
  origem            TEXT NOT NULL CHECK (origem IN ('declarado', 'distribuido')),
  elegivel_na_data  BOOLEAN,            -- snapshot de clients.elegivel_ajudas_custo no momento do cálculo (auditoria)
  calculado_em      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ajudas_valores_cliente_mes_unico
  ON ajudas_valores_por_cliente_mes (mes, client_id, fatura_id);

CREATE INDEX IF NOT EXISTS idx_ajudas_valores_cliente_mes_mes ON ajudas_valores_por_cliente_mes (mes);
CREATE INDEX IF NOT EXISTS idx_ajudas_valores_cliente_mes_client ON ajudas_valores_por_cliente_mes (client_id);
