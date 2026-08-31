-- Segundo mecanismo de assinatura, só para templates novos: HTML → PDF.co
-- num só passo, em vez de docx→PDF.co→pdf-lib (coordenadas fixas, ver nota
-- de contexto no plano desta sessão). "CONTRATO DE TRABALHO" e outros
-- templates existentes continuam formato='docx', sem alteração de
-- comportamento.

ALTER TABLE document_templates ADD COLUMN IF NOT EXISTS formato TEXT NOT NULL DEFAULT 'docx' CHECK (formato IN ('docx','html'));
ALTER TABLE document_templates ADD COLUMN IF NOT EXISTS template_html TEXT;

NOTIFY pgrst, 'reload schema';
