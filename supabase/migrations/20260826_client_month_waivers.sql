-- Estado "dispensado pelo admin", separado de client_approvals de propósito.
-- client_approvals.signature_base64 é NOT NULL — representa a assinatura
-- digital real do cliente (mesmo peso legal do Fluxo 2, com client_ip/client_ua
-- de auditoria). Uma linha aqui NUNCA deve ser lida como "o cliente assinou":
-- é só o admin a dizer "não vou cobrar a validação deste mês a este cliente",
-- usado pelo lembrete-validacao (api/formacao/index.js) para não voltar a
-- avisar sobre um mês que o admin já decidiu dispensar.

CREATE TABLE IF NOT EXISTS client_month_waivers (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL,
  month TEXT NOT NULL, -- 'YYYY-MM'
  waived_by TEXT NOT NULL, -- email/identificador de quem dispensou
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (client_id, month)
);

CREATE INDEX IF NOT EXISTS idx_client_month_waivers_month ON client_month_waivers (month);

NOTIFY pgrst, 'reload schema';
