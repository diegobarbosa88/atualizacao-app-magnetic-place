-- Terceira origem para ajudas_valores_por_cliente_mes: 'sistema' — daqui
-- em diante, confirmarEEmitirFatura (emitirFaturaComAjudas.js) grava aqui
-- o valor de ajuda de custo decidido pelo próprio sistema (via %
-- histórica ativa) no momento da emissão de cada fatura nova. Distingue-se
-- de 'declarado' (valor já estava escrito manualmente na observação, lido
-- retroativamente no backfill do período de saneamento) e 'distribuido'
-- (fatia do resíduo real dos recibos, também do backfill) — 'sistema' não
-- é retroativo nem manual, é o cálculo em tempo real da Fase 2b.
ALTER TABLE ajudas_valores_por_cliente_mes
  DROP CONSTRAINT IF EXISTS ajudas_valores_por_cliente_mes_origem_check;

ALTER TABLE ajudas_valores_por_cliente_mes
  ADD CONSTRAINT ajudas_valores_por_cliente_mes_origem_check
  CHECK (origem IN ('declarado', 'distribuido', 'sistema'));
