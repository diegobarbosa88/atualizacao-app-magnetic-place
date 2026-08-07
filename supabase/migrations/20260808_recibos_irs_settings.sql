-- Migração: configurações IRS por trabalhador + coluna feriado municipal
-- Executar no Supabase SQL Editor

-- 1. Coluna feriado municipal em system_settings (evita 400 na query select feriado_municipal)
ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS feriado_municipal TEXT;

-- 2. Garantir que existe sempre uma linha com id=1 em system_settings
INSERT INTO system_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- 3. Coluna subsidio_alimentacao_tipo nos workers (se ainda não existir)
ALTER TABLE workers ADD COLUMN IF NOT EXISTS subsidio_alimentacao_tipo TEXT DEFAULT 'dinheiro';
ALTER TABLE workers ADD COLUMN IF NOT EXISTS tabela_irs TEXT DEFAULT 'tabelaI';
ALTER TABLE workers ADD COLUMN IF NOT EXISTS n_dependentes INTEGER DEFAULT 0;

-- 4. Actualizar configuração IRS dos trabalhadores específicos
--    Diego Rocha Barbosa    → Tabela II, 1 dependente
--    Jean dos Santos Del Piero → Tabela II, 1 dependente
--    Cassio Costa de Freitas Almeida → Tabela III, 0 dependentes

UPDATE workers
SET tabela_irs = 'tabelaII', n_dependentes = 1
WHERE name ILIKE '%Diego%Barbosa%';

UPDATE workers
SET tabela_irs = 'tabelaII', n_dependentes = 1
WHERE name ILIKE '%Jean%Del Piero%';

UPDATE workers
SET tabela_irs = 'tabelaIII'
WHERE name ILIKE '%Cassio%Freitas%' OR name ILIKE '%Cassio%Almeida%';
