-- Elegibilidade de clientes para a Calculadora de Ajudas de Custo (Fase 0 —
-- pré-requisito bloqueante da Fase 1: ver secção 1.1 do documento de
-- arquitetura "Calculadora de Ajudas de Custo e Emissão de Faturas").
--
-- elegivel_ajudas_custo: NULL = ainda não decidido; true/false = decisão
-- manual final. É este campo, e só este, que percentagemHistorica.js e
-- estimativaMensal.js usam para filtrar faturamento.
--
-- elegibilidade_sugestao: reservado para uma versão futura com limiar
-- automático. Na v1 fica sempre NULL — não é escrito por nenhum módulo
-- (elegibilidade.js devolve só evidência bruta, sem sugestão calculada).
ALTER TABLE clients ADD COLUMN IF NOT EXISTS elegivel_ajudas_custo BOOLEAN DEFAULT NULL;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS elegibilidade_sugestao BOOLEAN DEFAULT NULL;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS elegibilidade_evidencia JSONB DEFAULT NULL;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS elegibilidade_confirmado_em TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS elegibilidade_confirmado_por TEXT DEFAULT NULL;
