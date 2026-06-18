-- Migration: pivot_docx
-- Description: Second pivot — from AcroForm fillable PDFs to Word (.docx) templates
--   rendered client-side with PizZip + docxtemplater. The storage bucket
--   "document-templates" is reused (rename not needed). Only the column name
--   changes for clarity: template_pdf_path → template_docx_path.
-- Created: 2026-05-13

DO $$ BEGIN
  -- Só renomeia se a coluna de origem existe E o destino ainda não existe
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'document_templates' AND column_name = 'template_pdf_path'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'document_templates' AND column_name = 'template_docx_path'
  ) THEN
    ALTER TABLE document_templates RENAME COLUMN template_pdf_path TO template_docx_path;
  END IF;
END $$;

COMMENT ON COLUMN document_templates.template_docx_path IS
  'Object path inside the "document-templates" storage bucket for the uploaded .docx template (PizZip + docxtemplater).';
COMMENT ON COLUMN document_templates.template_fields IS
  'Array of template tag names extracted from the uploaded .docx at upload time.';
