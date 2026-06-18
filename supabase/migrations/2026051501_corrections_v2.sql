-- Migration: Corrections v2 — single source of truth for client reports & admin corrections
-- Replaces the dispersed model (correcoes + app_notifications.payload + logs) with two
-- explicit tables: corrections (one row per submission) and correction_items (one row per
-- worker/day inside that submission). Legacy data is migrated; old `correcoes` is kept
-- read-only as `correcoes_legacy` for one release.

-- 1. corrections: one row per client submission
CREATE TABLE IF NOT EXISTS corrections (
  id              TEXT PRIMARY KEY,
  client_id       TEXT NOT NULL,
  month           TEXT NOT NULL,                  -- YYYY-MM
  type            TEXT NOT NULL DEFAULT 'quick',  -- 'quick' | 'precision'
  status          TEXT NOT NULL DEFAULT 'submitted',
                                                  -- submitted | under_review | applied | rejected
  submitted_at    TIMESTAMPTZ DEFAULT NOW(),
  submitted_by    TEXT,
  reviewed_at     TIMESTAMPTZ,
  reviewed_by     TEXT,
  justification   TEXT,
  CONSTRAINT corrections_status_check
    CHECK (status IN ('submitted','under_review','applied','rejected'))
);

CREATE INDEX IF NOT EXISTS corrections_client_month_idx ON corrections(client_id, month);
CREATE INDEX IF NOT EXISTS corrections_status_idx ON corrections(status);

COMMENT ON TABLE corrections IS 'One row per client correction submission. Granular per-day items live in correction_items.';

-- 2. correction_items: one row per worker/day inside a correction
CREATE TABLE IF NOT EXISTS correction_items (
  id              TEXT PRIMARY KEY,
  correction_id   TEXT NOT NULL REFERENCES corrections(id) ON DELETE CASCADE,
  worker_id       TEXT,
  worker_name     TEXT,
  date            DATE,
  before          JSONB,           -- snapshot of the log: { startTime, endTime, breakStart, breakEnd, hours }
  proposed        JSONB,           -- client's requested values (same shape)
  final           JSONB,           -- admin's applied values (null until applied)
  item_status     TEXT NOT NULL DEFAULT 'pending',
                                   -- pending | accepted | edited | rejected
  admin_note      TEXT,
  CONSTRAINT correction_items_status_check
    CHECK (item_status IN ('pending','accepted','edited','rejected'))
);

CREATE INDEX IF NOT EXISTS correction_items_correction_idx ON correction_items(correction_id);
CREATE INDEX IF NOT EXISTS correction_items_status_idx ON correction_items(item_status);

COMMENT ON TABLE correction_items IS 'Per-day, per-worker entries inside a correction. Each item has its own resolution state.';

-- 3. RLS policies (permissive for current app model)
ALTER TABLE corrections ENABLE ROW LEVEL SECURITY;
ALTER TABLE correction_items ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Public read corrections" ON corrections FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Public insert corrections" ON corrections FOR INSERT WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Public update corrections" ON corrections FOR UPDATE USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Public delete corrections" ON corrections FOR DELETE USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Public read correction_items" ON correction_items FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Public insert correction_items" ON correction_items FOR INSERT WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Public update correction_items" ON correction_items FOR UPDATE USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Public delete correction_items" ON correction_items FOR DELETE USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 4. Migrate legacy `correcoes` rows (idempotent — skips ids already present)
DO $$
DECLARE
  rec RECORD;
  worker_obj JSONB;
  day_obj JSONB;
  new_status TEXT;
  new_type TEXT;
  item_id TEXT;
  before_obj JSONB;
  proposed_obj JSONB;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'correcoes') THEN
    RETURN;
  END IF;

  FOR rec IN SELECT * FROM correcoes LOOP
    -- Skip if already migrated
    IF EXISTS (SELECT 1 FROM corrections WHERE id = rec.id) THEN
      CONTINUE;
    END IF;

    new_status := CASE
      WHEN rec.status = 'applied' THEN 'applied'
      WHEN rec.status = 'rejected' THEN 'rejected'
      ELSE 'submitted'
    END;
    new_type := COALESCE(rec.payload->>'reportType', 'quick');

    INSERT INTO corrections (id, client_id, month, type, status, submitted_at, justification)
    VALUES (
      rec.id,
      COALESCE(rec.client_id::TEXT, ''),
      COALESCE(rec.month, to_char(rec.created_at, 'YYYY-MM')),
      new_type,
      new_status,
      COALESCE(rec.created_at, NOW()),
      rec.message
    );

    -- Expand payload.changes[] (workers) → payload.changes[].dailyRecords[] (days)
    IF rec.payload ? 'changes' THEN
      FOR worker_obj IN SELECT * FROM jsonb_array_elements(rec.payload->'changes') LOOP
        IF worker_obj ? 'dailyRecords' THEN
          FOR day_obj IN SELECT * FROM jsonb_array_elements(worker_obj->'dailyRecords') LOOP
            -- Only migrate days that show an actual proposal (edited fields present)
            CONTINUE WHEN
              (day_obj->>'editedEntry') IS NULL
              AND (day_obj->>'editedExit') IS NULL
              AND (day_obj->>'editedBreakStart') IS NULL
              AND (day_obj->>'editedBreakEnd') IS NULL
              AND new_type = 'precision';

            item_id := rec.id || '_' || COALESCE(worker_obj->>'id','w') || '_' ||
                       COALESCE(day_obj->>'rawDate', day_obj->>'date', md5(day_obj::TEXT));

            before_obj := jsonb_build_object(
              'startTime', day_obj->>'entry',
              'endTime',   day_obj->>'exit',
              'breakStart', day_obj->>'breakStart',
              'breakEnd',   day_obj->>'breakEnd',
              'hours',      day_obj->'hours'
            );
            proposed_obj := jsonb_build_object(
              'startTime', COALESCE(day_obj->>'editedEntry', day_obj->>'entry'),
              'endTime',   COALESCE(day_obj->>'editedExit',  day_obj->>'exit'),
              'breakStart', COALESCE(day_obj->>'editedBreakStart', day_obj->>'breakStart'),
              'breakEnd',   COALESCE(day_obj->>'editedBreakEnd',   day_obj->>'breakEnd'),
              'hours',      COALESCE(day_obj->'editedHours',       day_obj->'hours')
            );

            INSERT INTO correction_items (
              id, correction_id, worker_id, worker_name, date,
              before, proposed, final, item_status
            ) VALUES (
              item_id,
              rec.id,
              worker_obj->>'id',
              worker_obj->>'name',
              NULLIF(COALESCE(day_obj->>'rawDate', day_obj->>'date'), '')::DATE,
              before_obj,
              proposed_obj,
              CASE WHEN new_status = 'applied' THEN proposed_obj ELSE NULL END,
              CASE WHEN new_status = 'applied' THEN 'accepted'
                   WHEN new_status = 'rejected' THEN 'rejected'
                   ELSE 'pending' END
            ) ON CONFLICT (id) DO NOTHING;
          END LOOP;
        END IF;
      END LOOP;
    END IF;
  END LOOP;
END $$;

-- 5. Rename legacy table for one-release fallback. New code reads ONLY from `corrections`.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'correcoes')
     AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'correcoes_legacy') THEN
    ALTER TABLE correcoes RENAME TO correcoes_legacy;
  END IF;
END $$;
