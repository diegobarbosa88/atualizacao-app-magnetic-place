-- Valor total da fatura (não só o valor de ajudas de custo escrito na
-- observação) — pedido para o ecrã "Faturas com Observações"
-- (FaturasComObservacoesTab, AjudasCustoAdmin.jsx) poder mostrar os dois
-- lado a lado. Preenchido nos três pontos de escrita: ratearHistorico
-- (Fase 1, percentagemHistorica.js), EstimativaMensalTab.simular (Fase 2a)
-- e confirmarEEmitirFatura (Fase 2b, emitirFaturaComAjudas.js). NULL em
-- registos gravados antes desta coluna existir — nunca reconstruído
-- retroativamente aqui (fora do âmbito desta migração).
ALTER TABLE ajudas_estimativas_fatura ADD COLUMN IF NOT EXISTS valor_fatura NUMERIC;
