-- Migration: Backfill all system_settings columns used by the app
-- The base table was created in 20260513_08_admin_stamp.sql with only
-- (id, company_signature_data_url). All columns below were being sent by
-- the app but had no committed migration, causing PostgREST 400 (PGRST204)
-- on upserts to system_settings.
--
-- This migration is idempotent (ADD COLUMN IF NOT EXISTS) and safe to
-- re-apply. It also adds nav_mode (admin layout toggle: sidebar/topbar).

ALTER TABLE system_settings
  ADD COLUMN IF NOT EXISTS admin_password        TEXT,
  ADD COLUMN IF NOT EXISTS company_name          TEXT,
  ADD COLUMN IF NOT EXISTS company_address       TEXT,
  ADD COLUMN IF NOT EXISTS company_nif           TEXT,
  ADD COLUMN IF NOT EXISTS dark_mode             BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS app_width             TEXT,
  ADD COLUMN IF NOT EXISTS gemini_api_key        TEXT,
  ADD COLUMN IF NOT EXISTS tolerancia_valido     NUMERIC DEFAULT 0.77,
  ADD COLUMN IF NOT EXISTS tolerancia_aviso      INTEGER DEFAULT 10,
  ADD COLUMN IF NOT EXISTS minute_interval       INTEGER DEFAULT 30,
  ADD COLUMN IF NOT EXISTS entry_tolerance_minutes INTEGER DEFAULT 10,
  ADD COLUMN IF NOT EXISTS nav_mode              TEXT NOT NULL DEFAULT 'sidebar'
    CHECK (nav_mode IN ('sidebar', 'topbar')),
  ADD COLUMN IF NOT EXISTS updated_at            TIMESTAMPTZ;

COMMENT ON COLUMN system_settings.nav_mode IS
  'Layout de navegação do admin: sidebar (lateral) ou topbar (horizontal superior).';
COMMENT ON COLUMN system_settings.minute_interval IS
  'Intervalo (minutos) usado para arredondar startTime/endTime de logs.';
COMMENT ON COLUMN system_settings.entry_tolerance_minutes IS
  'Tolerância (minutos) para aceitação da hora de entrada.';
COMMENT ON COLUMN system_settings.tolerancia_valido IS
  'Tolerância numérica para validação (ex.: 0.77).';
COMMENT ON COLUMN system_settings.tolerancia_aviso IS
  'Tolerância (inteiro) para avisos (ex.: 10).';

NOTIFY pgrst, 'reload schema';
