CREATE TABLE IF NOT EXISTS reconciliacao_entity_aliases (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  bank_name TEXT NOT NULL,
  system_entity TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(bank_name, system_entity)
);

ALTER TABLE reconciliacao_entity_aliases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role only" ON reconciliacao_entity_aliases;
CREATE POLICY "Service role only" ON reconciliacao_entity_aliases
  USING (auth.role() = 'service_role');
