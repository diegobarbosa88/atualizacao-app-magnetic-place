-- Gate de Onboarding do Trabalhador — bloqueia o dashboard normal até o
-- trabalhador assinar os documentos obrigatórios e concluir as formações
-- obrigatórias, na primeira vez que acede. Fonte de verdade única do que é
-- "obrigatório": onboarding_gate_itens, referenciando document_templates ou
-- formacoes_internas por slug (referência soft, sem FK cruzada — mesmo
-- padrão de formacao_requisitos_profissao.profissao_cnp).

ALTER TABLE document_templates ADD COLUMN IF NOT EXISTS slug TEXT UNIQUE;
ALTER TABLE formacoes_internas ADD COLUMN IF NOT EXISTS slug TEXT UNIQUE;
ALTER TABLE workers ADD COLUMN IF NOT EXISTS onboarding_gate_concluido_em TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS onboarding_gate_itens (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo       TEXT NOT NULL CHECK (tipo IN ('documento', 'formacao')),
  slug       TEXT NOT NULL,
  label      TEXT NOT NULL,
  ativo      BOOLEAN NOT NULL DEFAULT true,
  criado_em  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tipo, slug)
);
ALTER TABLE onboarding_gate_itens ENABLE ROW LEVEL SECURITY;

-- Backfill dos slugs das 14 ações e-learning criadas em 2026-08-30
-- (tipo_formacao é único hoje entre essas 14, confirmado antes de escrever
-- esta migração).
UPDATE formacoes_internas SET slug = 'sst-acolhimento' WHERE tipo_formacao = 'Formação de Acolhimento em SST';
UPDATE formacoes_internas SET slug = 'epi-uso-conservacao' WHERE tipo_formacao = 'Uso e Conservação de EPI''s';
UPDATE formacoes_internas SET slug = 'leitura-desenho-tecnico' WHERE tipo_formacao = 'Leitura de Desenho Técnico';
UPDATE formacoes_internas SET slug = 'ergonomia-postura' WHERE tipo_formacao = 'Ergonomia e Postura no Trabalho';
UPDATE formacoes_internas SET slug = 'prevencao-incendio' WHERE tipo_formacao = 'Prevenção de Incêndio';
UPDATE formacoes_internas SET slug = 'primeiros-socorros' WHERE tipo_formacao = 'Primeiros Socorros (Introdução)';
UPDATE formacoes_internas SET slug = 'manuseamento-cargas' WHERE tipo_formacao = 'Manuseamento Manual de Cargas';
UPDATE formacoes_internas SET slug = 'riscos-eletricos' WHERE tipo_formacao = 'Riscos Elétricos — Noções Básicas';
UPDATE formacoes_internas SET slug = 'riscos-quimicos' WHERE tipo_formacao = 'Riscos Químicos e Fichas de Segurança de Produtos';
UPDATE formacoes_internas SET slug = 'simbologia-soldadura' WHERE tipo_formacao = 'Interpretação de Simbologia de Soldadura';
UPDATE formacoes_internas SET slug = 'metrologia-instrumentos' WHERE tipo_formacao = 'Metrologia e Instrumentos de Medição';
UPDATE formacoes_internas SET slug = 'nocoes-metalurgia' WHERE tipo_formacao = 'Noções de Metalurgia';
UPDATE formacoes_internas SET slug = 'prep-exame-soldador' WHERE tipo_formacao = 'Preparação Teórica — Exame de Qualificação de Soldador';
UPDATE formacoes_internas SET slug = 'hidraulica-pneumatica' WHERE tipo_formacao = 'Noções de Hidráulica e Pneumática';

-- Seed: as 2 formações obrigatórias para todos, independentemente de
-- profissão. Os 3 documentos (contrato, termo EPI, RGPD) ficam por ligar
-- manualmente pelo admin em Definições — Templates, porque dependem de
-- document_templates reais já existentes, cujos UUIDs não são conhecidos
-- nesta migração.
INSERT INTO onboarding_gate_itens (tipo, slug, label, ativo) VALUES
  ('formacao', 'sst-acolhimento', 'Formação de Acolhimento em SST', true),
  ('formacao', 'epi-uso-conservacao', 'Uso e Conservação de EPI''s', true)
ON CONFLICT (tipo, slug) DO NOTHING;

-- Cláusula de avô: os trabalhadores já existentes nunca passaram por este
-- gate e não têm os documentos/formações provisionados automaticamente
-- (isso só acontece na criação, ver TeamContext.handleSaveWorker) — sem
-- isto, todos ficariam bloqueados no próximo login por algo que nunca lhes
-- foi pedido. O gate só se aplica a trabalhadores criados a partir de agora.
UPDATE workers SET onboarding_gate_concluido_em = now() WHERE onboarding_gate_concluido_em IS NULL;

NOTIFY pgrst, 'reload schema';
