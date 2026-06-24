-- Garantir RLS com políticas permissivas na tabela logs
-- A app usa anon key sem Supabase Auth, logo todas as operações
-- devem ser permitidas ao role anon (USING true / WITH CHECK true).

ALTER TABLE logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow anon select logs"  ON logs;
DROP POLICY IF EXISTS "Allow anon insert logs"  ON logs;
DROP POLICY IF EXISTS "Allow anon update logs"  ON logs;
DROP POLICY IF EXISTS "Allow anon delete logs"  ON logs;
DROP POLICY IF EXISTS "Allow public all logs"   ON logs;

CREATE POLICY "Allow anon select logs"
  ON logs FOR SELECT
  USING (true);

CREATE POLICY "Allow anon insert logs"
  ON logs FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow anon update logs"
  ON logs FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow anon delete logs"
  ON logs FOR DELETE
  USING (true);
