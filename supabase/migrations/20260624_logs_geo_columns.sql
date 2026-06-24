-- Adicionar colunas GPS à tabela logs
-- Estas colunas foram adicionadas ao payload do AppContext em Maio 2026
-- mas nunca foram criadas via migração formal.
-- O uso de IF NOT EXISTS garante segurança se já existirem.

ALTER TABLE logs
  ADD COLUMN IF NOT EXISTS check_in_lat      DOUBLE PRECISION DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS check_in_lng      DOUBLE PRECISION DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS geo_verified      BOOLEAN DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS break_start_lat   DOUBLE PRECISION DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS break_start_lng   DOUBLE PRECISION DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS break_end_lat     DOUBLE PRECISION DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS break_end_lng     DOUBLE PRECISION DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS check_out_lat     DOUBLE PRECISION DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS check_out_lng     DOUBLE PRECISION DEFAULT NULL;

COMMENT ON COLUMN logs.check_in_lat    IS 'Latitude GPS na entrada';
COMMENT ON COLUMN logs.check_in_lng    IS 'Longitude GPS na entrada';
COMMENT ON COLUMN logs.geo_verified    IS 'True se entrada foi verificada dentro do geofence do cliente';
COMMENT ON COLUMN logs.break_start_lat IS 'Latitude GPS no início da pausa';
COMMENT ON COLUMN logs.break_start_lng IS 'Longitude GPS no início da pausa';
COMMENT ON COLUMN logs.break_end_lat   IS 'Latitude GPS no fim da pausa';
COMMENT ON COLUMN logs.break_end_lng   IS 'Longitude GPS no fim da pausa';
COMMENT ON COLUMN logs.check_out_lat   IS 'Latitude GPS na saída';
COMMENT ON COLUMN logs.check_out_lng   IS 'Longitude GPS na saída';
