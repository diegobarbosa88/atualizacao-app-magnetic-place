-- Migration: Add stamp position configuration to document_templates
-- Description: Allows admins to configure where the validation stamp appears in the signed PDF

-- Add stamp position columns
ALTER TABLE document_templates
  ADD COLUMN IF NOT EXISTS stamp_x NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS stamp_y NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS stamp_page TEXT DEFAULT 'last' CHECK (stamp_page IN ('first', 'last', 'all'));

-- Comments
COMMENT ON COLUMN document_templates.stamp_x IS 'X position (in mm from left) where stamp should be placed in PDF';
COMMENT ON COLUMN document_templates.stamp_y IS 'Y position (in mm from bottom) where stamp should be placed in PDF';
COMMENT ON COLUMN document_templates.stamp_page IS 'Which page(s) to place the stamp: first, last, or all';
