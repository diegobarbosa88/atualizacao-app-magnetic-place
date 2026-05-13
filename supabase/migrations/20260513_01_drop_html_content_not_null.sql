-- Migration: drop_html_content_not_null
-- Description: Removes the NOT NULL constraint on document_templates.html_content
--   to support blocks-only templates. The column is left in place for backward
--   compatibility with legacy rows; new templates store content in `blocks` JSONB.
-- Created: 2026-05-13

ALTER TABLE document_templates
ALTER COLUMN html_content DROP NOT NULL;
