-- Garantir colunas existem (idempotente)
ALTER TABLE resumo_observacoes
  ADD COLUMN IF NOT EXISTS completo     BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS ajuste_bruto NUMERIC DEFAULT 0;

-- Remover RLS para acesso com anon key (igual a resumo_config)
ALTER TABLE resumo_observacoes DISABLE ROW LEVEL SECURITY;
