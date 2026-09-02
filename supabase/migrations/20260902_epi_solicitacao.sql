-- Solicitação de EPI (equipamento de proteção individual) self-service:
-- trabalhador pede, admin aprova/rejeita/marca como entregue. Catálogo
-- editável pelo admin (ícone, tamanhos com stock, elegibilidade por
-- profissão); exceções individuais + medidas pessoais vivem no próprio
-- `workers` (mesmo molde de "assignedClientDates" — coluna jsonb por
-- trabalhador, sem tabela à parte). Lançamento oculto: só visível no
-- dashboard do trabalhador para quem tiver epi_enabled=true (ver UPDATE
-- no fim, aplicado só ao trabalhador Diego Rocha Barbosa, w1775216030576).

CREATE TABLE IF NOT EXISTS epi_types (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  icon TEXT NOT NULL,
  sizes JSONB,
  stock INTEGER,
  eligibility_all BOOLEAN NOT NULL DEFAULT true,
  eligibility_professions JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS epi_requests (
  id TEXT PRIMARY KEY,
  worker_id TEXT NOT NULL,
  worker_name TEXT NOT NULL,
  client_id TEXT,
  type_id TEXT NOT NULL,
  qty INTEGER NOT NULL DEFAULT 1,
  size TEXT,
  motivo TEXT NOT NULL,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','delivered')),
  approved_by TEXT,
  approved_at TIMESTAMPTZ,
  rejected_by TEXT,
  rejected_at TIMESTAMPTZ,
  reject_reason TEXT,
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_epi_requests_worker_id ON epi_requests(worker_id);
CREATE INDEX IF NOT EXISTS idx_epi_requests_status ON epi_requests(status);

ALTER TABLE workers ADD COLUMN IF NOT EXISTS epi_enabled BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE workers ADD COLUMN IF NOT EXISTS epi_overrides JSONB NOT NULL DEFAULT '{"add":[],"remove":[]}'::jsonb;
ALTER TABLE workers ADD COLUMN IF NOT EXISTS epi_sizes JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Catálogo inicial — 9 tipos comuns, o admin pode editar/adicionar/remover
-- livremente a partir daqui (ver Catálogo de EPI em /admin/epi).
INSERT INTO epi_types (id, label, icon, sizes, stock, eligibility_all, eligibility_professions) VALUES
  ('capacete',  'Capacete',            'HardHat',   NULL, 14, true,  '[]'),
  ('luvas',     'Luvas',               'Hand',      '[{"name":"P","stock":6},{"name":"M","stock":9},{"name":"G","stock":3},{"name":"GG","stock":0}]'::jsonb, NULL, true, '[]'),
  ('botas',     'Botas biqueira aço',  'Footprints', '[{"name":"38","stock":2},{"name":"39","stock":4},{"name":"40","stock":5},{"name":"41","stock":3},{"name":"42","stock":4},{"name":"43","stock":2},{"name":"44","stock":1},{"name":"45","stock":0}]'::jsonb, NULL, true, '[]'),
  ('oculos',    'Óculos de proteção',  'Glasses',   NULL, 20, false, '["Soldador","Serralheiro"]'),
  ('colete',    'Colete refletor',     'Shirt',     NULL, 25, true,  '[]'),
  ('auricular', 'Protetor auricular',  'Ear',       NULL, 10, false, '["Soldador","Montador de Estruturas Metálicas"]'),
  ('mascara',   'Máscara respiratória', 'Wind',     NULL, 8,  false, '["Soldador"]'),
  ('avental',   'Avental soldador',    'Flame',     NULL, 4,  false, '["Soldador"]'),
  ('arnes',     'Arnês de segurança',  'Anchor',    NULL, 6,  false, '["Montador de Estruturas Metálicas","Montador de Andaimes"]')
ON CONFLICT (id) DO NOTHING;

UPDATE workers SET epi_enabled = true WHERE id = 'w1775216030576';

NOTIFY pgrst, 'reload schema';
