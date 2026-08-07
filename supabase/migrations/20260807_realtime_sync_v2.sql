-- Adicionar tabelas à publicação realtime (safe: verifica antes de adicionar)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='worker_documents') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE worker_documents;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='document_templates') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE document_templates;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='system_settings') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE system_settings;
  END IF;
END $$;

-- REPLICA IDENTITY FULL: payload.old nos eventos DELETE inclui a linha completa
ALTER TABLE worker_documents   REPLICA IDENTITY FULL;
ALTER TABLE document_templates REPLICA IDENTITY FULL;
ALTER TABLE system_settings    REPLICA IDENTITY FULL;
