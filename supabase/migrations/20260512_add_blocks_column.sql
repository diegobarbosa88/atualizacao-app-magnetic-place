-- Migration: add_blocks_column_to_document_templates
-- Description: Adds JSONB blocks column for block-based document templates
-- Created: 2026-05-12

ALTER TABLE document_templates
ADD COLUMN IF NOT EXISTS blocks JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN document_templates.blocks IS 'Array of document blocks (title, subtitle, paragraph, signature) for block-based editing';
