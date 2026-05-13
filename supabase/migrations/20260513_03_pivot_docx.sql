-- Migration: pivot_docx
-- Description: Second pivot — from AcroForm fillable PDFs to Word (.docx) templates
--   rendered client-side with PizZip + docxtemplater. The storage bucket
--   "document-templates" is reused (rename not needed). Only the column name
--   changes for clarity: template_pdf_path → template_docx_path.
-- Created: 2026-05-13

ALTER TABLE document_templates
  RENAME COLUMN template_pdf_path TO template_docx_path;

COMMENT ON COLUMN document_templates.template_docx_path IS
  'Object path inside the "document-templates" storage bucket for the uploaded .docx template (PizZip + docxtemplater).';
COMMENT ON COLUMN document_templates.template_fields IS
  'Array of template tag names extracted from the uploaded .docx at upload time.';
