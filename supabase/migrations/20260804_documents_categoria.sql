ALTER TABLE documents ADD COLUMN IF NOT EXISTS categoria TEXT;
CREATE INDEX IF NOT EXISTS idx_documents_categoria ON documents(categoria);

UPDATE documents SET categoria = 'Remuneração'
  WHERE categoria IS NULL AND tipo ILIKE '%recibo%';
UPDATE documents SET categoria = 'Remuneração'
  WHERE categoria IS NULL AND tipo ILIKE '%vencimento%';
UPDATE documents SET categoria = 'Remuneração'
  WHERE categoria IS NULL AND tipo ILIKE '%deslocamento%';
UPDATE documents SET categoria = 'Contratual'
  WHERE categoria IS NULL AND tipo ILIKE '%contrato%';
UPDATE documents SET categoria = 'Saúde e Segurança no Trabalho'
  WHERE categoria IS NULL AND (tipo ILIKE '%aptidão%' OR tipo ILIKE '%sst%' OR tipo ILIKE '%médica%' OR tipo ILIKE '%saúde%');
UPDATE documents SET categoria = 'Identificação e Legalização'
  WHERE categoria IS NULL AND (tipo ILIKE '%cidadão%' OR tipo ILIKE '%passaporte%' OR tipo ILIKE '%residência%');
UPDATE documents SET categoria = 'Segurança Social e Fiscal'
  WHERE categoria IS NULL AND (tipo ILIKE '%nif%' OR tipo ILIKE '%niss%' OR tipo ILIKE '%iban%' OR tipo ILIKE '%fiscal%');
UPDATE documents SET categoria = 'Outros'
  WHERE categoria IS NULL;
