-- Ligar pagamentos de fornecedores a faturas para fechar o ciclo automaticamente
ALTER TABLE pagamentos_fornecedores ADD COLUMN IF NOT EXISTS fatura_id UUID;
