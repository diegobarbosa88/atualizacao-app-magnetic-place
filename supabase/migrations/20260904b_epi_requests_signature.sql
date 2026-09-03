ALTER TABLE epi_requests ADD COLUMN IF NOT EXISTS signature_data TEXT;
ALTER TABLE epi_requests ADD COLUMN IF NOT EXISTS signed_at TIMESTAMPTZ;
COMMENT ON COLUMN epi_requests.signature_data IS 'Assinatura do trabalhador (dataURL PNG) confirmando a receção física do EPI, capturada no dispositivo do admin no momento da entrega.';
