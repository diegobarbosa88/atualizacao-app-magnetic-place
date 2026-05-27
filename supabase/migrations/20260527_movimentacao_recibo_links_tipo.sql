ALTER TABLE movimentacao_recibo_links ADD COLUMN IF NOT EXISTS tipo TEXT;

COMMENT ON COLUMN movimentacao_recibo_links.tipo IS 'Override do tipo de pagamento: Adiantamento ou Liquidação. Se NULL, o tipo é calculado pelo classifyTransfer.';