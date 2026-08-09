-- Campos obrigatórios pela PSI (Plataforma de Serviços de Interoperabilidade)
-- que faltam no schema actual da tabela workers
ALTER TABLE workers
  ADD COLUMN IF NOT EXISTS tipo_contrato TEXT DEFAULT 'sem_termo',
  -- valores: 'sem_termo' | 'termo_certo' | 'termo_incerto' | 'muito_curta_duracao'
  ADD COLUMN IF NOT EXISTS regime TEXT DEFAULT 'tempo_inteiro',
  -- valores: 'tempo_inteiro' | 'tempo_parcial'
  ADD COLUMN IF NOT EXISTS horas_semanais NUMERIC DEFAULT 40,
  ADD COLUMN IF NOT EXISTS modo_trabalho TEXT DEFAULT 'presencial',
  -- valores: 'presencial' | 'remoto' | 'hibrido' (exigido desde abril 2022)

  -- Estado de comunicação à SS (null = ainda não comunicado)
  ADD COLUMN IF NOT EXISTS ss_admissao_comunicada_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ss_admissao_num_registo TEXT,
  ADD COLUMN IF NOT EXISTS ss_cessacao_comunicada_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ss_cessacao_num_registo TEXT;

-- Tabela de auditoria completa de todas as tentativas de comunicação à SS
CREATE TABLE IF NOT EXISTS ss_comunicacoes (
  id              BIGSERIAL PRIMARY KEY,
  worker_id       TEXT REFERENCES workers(id) ON DELETE CASCADE,
  tipo            TEXT NOT NULL CHECK (tipo IN ('admissao', 'cessacao')),
  status          TEXT NOT NULL CHECK (status IN ('sucesso', 'erro', 'pendente')),
  payload_xml     TEXT,
  resposta_ss     TEXT,
  num_registo     TEXT,
  motivo_cessacao TEXT,
  confirmado_por  TEXT,
  ambiente        TEXT NOT NULL CHECK (ambiente IN ('teste', 'producao')),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- RLS restritivo: apenas funções server-side (service role) podem ler/escrever
ALTER TABLE ss_comunicacoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_only_ss_comunicacoes" ON ss_comunicacoes USING (false);
