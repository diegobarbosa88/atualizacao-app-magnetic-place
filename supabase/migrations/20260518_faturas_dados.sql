-- Phase 17: add extracted invoice data column
ALTER TABLE faturas ADD COLUMN IF NOT EXISTS dados JSONB;
