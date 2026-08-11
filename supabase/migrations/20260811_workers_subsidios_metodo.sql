-- Migração: método de cálculo IRS para subsídios de férias e natal
-- "duodecimos" → art. 99.º-C CIRS: escalão pelo total anual, proporcionalizado
-- "valor"      → escalão pelo valor pago no mês (abaixo de 920€ → IRS = 0%)

ALTER TABLE workers ADD COLUMN IF NOT EXISTS subsidios_metodo TEXT DEFAULT 'duodecimos';

-- Trabalhadores com "Subsídio Férias (Valor)" no TOConline (Julho 2026)
UPDATE workers SET subsidios_metodo = 'valor' WHERE name ILIKE '%Rafael%Schwenck%';
UPDATE workers SET subsidios_metodo = 'valor' WHERE name ILIKE '%Gabriel%Gois%';
UPDATE workers SET subsidios_metodo = 'valor' WHERE name ILIKE '%Idemilton%';
UPDATE workers SET subsidios_metodo = 'valor' WHERE name ILIKE '%Lucilene%';
UPDATE workers SET subsidios_metodo = 'valor' WHERE name ILIKE '%Adriel%';
UPDATE workers SET subsidios_metodo = 'valor' WHERE name ILIKE '%Zeljko%';
UPDATE workers SET subsidios_metodo = 'valor' WHERE name ILIKE '%Francisco%Wanderlilson%';
UPDATE workers SET subsidios_metodo = 'valor' WHERE name ILIKE '%Josue%' OR name ILIKE '%Josu%';
UPDATE workers SET subsidios_metodo = 'valor' WHERE name ILIKE '%Jose%Osvaldo%';
UPDATE workers SET subsidios_metodo = 'valor' WHERE name ILIKE '%Francisco%Inacio%' OR name ILIKE '%Francisco%Ina%io%';

-- Nota: Cassio → tabelaIII (já definido em 20260808_recibos_irs_settings.sql)
-- Na tabelaIII c/ 0 dep, irsFerias usando duodécimos ≈ 0 de qualquer forma (escalão baixo),
-- mas manter 'valor' por consistência com TOConline.
UPDATE workers SET subsidios_metodo = 'valor' WHERE name ILIKE '%Cassio%';
