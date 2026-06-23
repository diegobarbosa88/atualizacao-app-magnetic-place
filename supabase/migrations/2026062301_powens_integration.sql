-- =============================================================================
-- Migração: Motor Unificado de Tesouraria — Powens (Budget Insight)
-- Data: 2026-06-23
-- Descrição: Tabelas para AIS (leitura de contas/movimentos) e PIS (pagamentos)
--            via API Powens. Substitui a integração SaltEdge anterior.
-- =============================================================================

-- ── 1. conexoes_bancarias ─────────────────────────────────────────────────────
-- Regista as ligações AIS ao novobanco / Santander via Powens Webview.
CREATE TABLE IF NOT EXISTS conexoes_bancarias (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  banco                 TEXT        NOT NULL,           -- 'novobanco' | 'santander'
  powens_user_id        TEXT,                           -- ID do utilizador Powens criado para esta conta
  powens_connection_id  TEXT,                           -- ID da conexão devolvida pelo callback AIS
  powens_state          TEXT        UNIQUE,             -- CSRF state gerado antes do redirect
  powens_connector      TEXT,                           -- Nome do conector (ex: 'Novo Banco')
  estado                TEXT        NOT NULL DEFAULT 'pendente',
  -- Valores possíveis de estado:
  --   pendente                  → utilizador ainda não completou o webview
  --   ativa                     → ligação estabelecida com sucesso
  --   cancelado_pelo_utilizador → utilizador cancelou no ecrã do banco
  --   erro_banco                → falha técnica reportada pelo banco (server_error)
  --   erro                      → erro desconhecido
  --   inativa                   → desligada manualmente
  erro_detalhe          TEXT,                           -- Descrição do erro quando aplicável
  dados                 JSONB,                          -- Detalhes da conexão devolvidos pela Powens
  saldos                JSONB,                          -- Saldos das contas (array sincronizado)
  ultima_sincronizacao  TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT conexoes_bancarias_banco_key UNIQUE (banco)
);

COMMENT ON TABLE conexoes_bancarias IS 'Ligações AIS via Powens Webview (novobanco, Santander)';
COMMENT ON COLUMN conexoes_bancarias.estado IS 'pendente|ativa|cancelado_pelo_utilizador|erro_banco|erro|inativa';

-- ── 2. powens_pagamentos_pendentes ────────────────────────────────────────────
-- Regista pagamentos PIS iniciados via Powens.
-- Substitui a tabela toconline_pagamentos_pendentes (removida).
CREATE TABLE IF NOT EXISTS powens_pagamentos_pendentes (
  id                       UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  powens_transfer_id       TEXT,                        -- ID da transferência criada na Powens
  powens_state             TEXT        UNIQUE,          -- CSRF state gerado antes do redirect
  powens_transfer_estado   TEXT,                        -- Estado devolvido pela Powens (created|validated|done|canceled)
  faturas_ids              UUID[]      NOT NULL DEFAULT '{}',
  faturas_snapshot         JSONB,                       -- Cópia dos dados das faturas no momento do pagamento
  total                    NUMERIC(12,2) NOT NULL,
  descricao                TEXT,
  banco                    TEXT,
  estado                   TEXT        NOT NULL DEFAULT 'pendente',
  -- Valores possíveis de estado:
  --   pendente                  → webview ainda não completado
  --   processando               → utilizador aprovou, aguarda liquidação
  --   concluido                 → transferência liquidada
  --   cancelado_pelo_utilizador → utilizador cancelou no banco
  --   erro_banco                → falha técnica do banco
  --   erro                      → erro desconhecido
  erro_detalhe             TEXT,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE powens_pagamentos_pendentes IS 'Pagamentos PIS via Powens Webview';
COMMENT ON COLUMN powens_pagamentos_pendentes.estado IS 'pendente|processando|concluido|cancelado_pelo_utilizador|erro_banco|erro';

-- ── 3. movimentos_bancarios ───────────────────────────────────────────────────
-- Transacções sincronizadas via AIS (POST /api/powens/sync).
CREATE TABLE IF NOT EXISTS movimentos_bancarios (
  id                        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  powens_transaction_id     TEXT        NOT NULL UNIQUE,
  conexao_id                UUID        REFERENCES conexoes_bancarias(id) ON DELETE SET NULL,
  banco                     TEXT        NOT NULL,
  data                      DATE,
  data_valor                DATE,
  valor                     NUMERIC(14,2),
  descricao                 TEXT,
  tipo                      TEXT,       -- card|transfer|order|check|loan_repayment|bank|unknown
  estado                    TEXT,       -- coming|active|future
  categoria                 TEXT,
  dados_raw                 JSONB,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT movimentos_bancarios_powens_id_key UNIQUE (powens_transaction_id)
);

COMMENT ON TABLE movimentos_bancarios IS 'Movimentos bancários sincronizados via Powens AIS';

-- ── 4. Colunas adicionais em faturas_centro_documentos ───────────────────────
ALTER TABLE faturas_centro_documentos
  ADD COLUMN IF NOT EXISTS powens_transfer_id  TEXT,
  ADD COLUMN IF NOT EXISTS estado_pagamento    TEXT DEFAULT 'pendente',
  ADD COLUMN IF NOT EXISTS updated_at          TIMESTAMPTZ DEFAULT NOW();

-- Valores de estado_pagamento:
--   pendente | processando | pago | cancelado_pelo_utilizador | erro

-- ── 5. Índices de suporte ─────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_conexoes_state         ON conexoes_bancarias (powens_state);
CREATE INDEX IF NOT EXISTS idx_conexoes_banco         ON conexoes_bancarias (banco);
CREATE INDEX IF NOT EXISTS idx_pag_state              ON powens_pagamentos_pendentes (powens_state);
CREATE INDEX IF NOT EXISTS idx_pag_transfer           ON powens_pagamentos_pendentes (powens_transfer_id);
CREATE INDEX IF NOT EXISTS idx_mov_conexao            ON movimentos_bancarios (conexao_id);
CREATE INDEX IF NOT EXISTS idx_mov_data               ON movimentos_bancarios (data);
CREATE INDEX IF NOT EXISTS idx_mov_banco              ON movimentos_bancarios (banco);
CREATE INDEX IF NOT EXISTS idx_fcd_pagamento          ON faturas_centro_documentos (estado_pagamento);

-- ── 6. Row Level Security ─────────────────────────────────────────────────────
-- Estas tabelas são acedidas apenas server-side (service_role).
-- Nenhuma linha é lida diretamente pelo cliente anónimo.
ALTER TABLE conexoes_bancarias          ENABLE ROW LEVEL SECURITY;
ALTER TABLE powens_pagamentos_pendentes ENABLE ROW LEVEL SECURITY;
ALTER TABLE movimentos_bancarios        ENABLE ROW LEVEL SECURITY;

-- Políticas apenas para service_role (bypass automático); bloquear anon/authenticated
CREATE POLICY "deny_anon_conexoes"   ON conexoes_bancarias          FOR ALL TO anon USING (false);
CREATE POLICY "deny_anon_pagamentos" ON powens_pagamentos_pendentes FOR ALL TO anon USING (false);
CREATE POLICY "deny_anon_movimentos" ON movimentos_bancarios        FOR ALL TO anon USING (false);
