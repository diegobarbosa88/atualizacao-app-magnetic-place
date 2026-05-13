## Goal
Finalize transition from HTML legacy to JSON blocks-only system for document templates.

## Constraints & Preferences
- JSON storage: `document_templates.blocks` JSONB column (no html_content)
- PDF: pdfmake only (no html2pdf.js), 50mm/60mm margins, "Página X de Y" footer, unbreakable signature
- AI: OpenAI with `response_format: { type: 'json_object' }`, fallback to Gemini
- Variables: `{{variavel}}` syntax
- Block types: title, subtitle, paragraph, signature
- Tech: React, Tailwind CSS, lucide-react, pdfmake

## Progress
### Done
- `blocksToPdfMake()` in pdfGenerator.js for PDF generation from blocks
- `blocksToHtml()` in useDocumentTemplates.js for converting blocks to HTML for document generation
- `handleSave()` updated: removes html_content, saves only blocks JSON
- `handleGenerateAI()` refactored: OpenAI with json_object format, Gemini fallback, returns blocks array
- Migration SQL: `supabase/migrations/20260512_add_blocks_column.sql`
- pdfmake vfs fonts initialized in DocumentTemplatesAdmin
- PDF preview with iframe, loading spinner, error handling added
- BlockEditor redesigned: action buttons (+ Título, + Parágrafo, etc.), variables sidebar, Notion-style
- Modal tabs: Editar | Pré-visualizar PDF
- **HTML tab removed** from template modal (removed `activeEditorTab` state and HTML textarea)
- **AI button added** in Edit tab toolbar with loading overlay
- BlockEditor shows loading spinner when AI is generating

### Block margins applied to PDF:
- title: margin: [0, 0, 0, 20]
- subtitle: margin: [0, 15, 0, 8]
- paragraph: margin: [0, 0, 0, 12]
- signature: margin: [0, 40, 0, 0]
- Page margins: [50, 60, 50, 60] (50mm horizontal, 60mm vertical)

### In Progress
- (none)

### Blocked
- (none)

## Key Decisions
- AI prompt now forces JSON output: `{ "blocks": [...] }` with 4 block types
- PDF preview generates blob URL and displays in iframe
- Blocks-only storage (no html_content column needed)
- pdfmake vfs initialized in component (not just utility) for preview to work
- Edit tab now shows AI loading overlay over BlockEditor instead of separate HTML tab
- All html_content references removed from codebase
- `handleGenerateDocuments` now requires blocks-only (no fallback to html_content)

## Next Steps
1. Clean up unused imports (showAIPanel, previewPositions, previewZoom, iframeRef, etc.)
2. Remove showPreviewSettings, previewHeight state
3. Verify build passes

## Critical Context
- Build passes with blocks-only system
- html_content completely removed from codebase
- html2pdf.js removed from package.json
- AI returns JSON blocks directly to BlockEditor state
- Document generation uses blocksToHtml() exclusively

## Relevant Files
- `src/components/admin/DocumentTemplatesAdmin.jsx` — modal with Editar/Pré-visualizar tabs, PDF preview iframe, AI wrapper, blocks-only editing
- `src/hooks/useDocumentTemplates.js` — handleSave (blocks only), handleGenerateAI (JSON blocks), blocksToHtml
- `src/components/admin/BlockEditor.jsx` — redesigned with action buttons, variables sidebar
- `src/utils/pdfGenerator.js` — blocksToPdfMake with block-specific margins, blocksToPdfMake, downloadPdfFromBlocks
- `supabase/migrations/20260512_add_blocks_column.sql` — migration for blocks JSONB column