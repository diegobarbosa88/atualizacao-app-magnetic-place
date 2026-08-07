-- Adicionar tabelas à publicação realtime (safe: verifica antes de adicionar)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='workers') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE workers;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='clients') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE clients;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='documents') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE documents;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='schedules') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE schedules;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='personalschedules') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE personalschedules;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='approvals') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE approvals;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='expenses') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE expenses;
  END IF;
END $$;

-- REPLICA IDENTITY FULL: payload.old nos eventos DELETE inclui a linha completa
ALTER TABLE workers           REPLICA IDENTITY FULL;
ALTER TABLE clients           REPLICA IDENTITY FULL;
ALTER TABLE documents         REPLICA IDENTITY FULL;
ALTER TABLE schedules         REPLICA IDENTITY FULL;
ALTER TABLE personalschedules REPLICA IDENTITY FULL;
ALTER TABLE approvals         REPLICA IDENTITY FULL;
ALTER TABLE expenses          REPLICA IDENTITY FULL;
