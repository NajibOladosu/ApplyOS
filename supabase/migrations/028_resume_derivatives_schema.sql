-- Migration: Extend resume_versions for derivative resume editing
-- Adds: TipTap JSON content, template selection, source filetype tracking,
-- starring, and parent-document linkage. Original `documents` row stays untouched
-- so users can always reset to source.
--
-- Compatibility: keeps legacy `blocks` JSONB column populated by existing editor
-- until the TipTap migration ships in Phase 2. Once Phase 2 lands, new versions
-- store `content_json`; the older `blocks` column becomes optional.

ALTER TABLE resume_versions
    ADD COLUMN IF NOT EXISTS content_json JSONB,
    ADD COLUMN IF NOT EXISTS template_id TEXT NOT NULL DEFAULT 'modern',
    ADD COLUMN IF NOT EXISTS source_format TEXT NOT NULL DEFAULT 'pdf'
        CHECK (source_format IN ('pdf', 'docx', 'txt', 'json')),
    ADD COLUMN IF NOT EXISTS is_starred BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS parent_document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS detected_layout JSONB;

-- Backfill parent_document_id from existing document_id link so derivatives
-- always resolve to their source even if the editor stops touching document_id.
UPDATE resume_versions
SET parent_document_id = document_id
WHERE parent_document_id IS NULL;

-- Make legacy `blocks` column nullable for new TipTap-only versions.
ALTER TABLE resume_versions
    ALTER COLUMN blocks DROP NOT NULL,
    ALTER COLUMN blocks SET DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_resume_versions_parent_document_id
    ON resume_versions(parent_document_id);

CREATE INDEX IF NOT EXISTS idx_resume_versions_template_id
    ON resume_versions(template_id);

-- Per-application starring: one starred version per application at most.
CREATE UNIQUE INDEX IF NOT EXISTS idx_resume_versions_starred_per_app
    ON resume_versions(application_id)
    WHERE is_starred = TRUE AND application_id IS NOT NULL;

COMMENT ON COLUMN resume_versions.content_json IS 'TipTap document JSON (Phase 2+). Source of truth for new versions.';
COMMENT ON COLUMN resume_versions.blocks IS 'Legacy block-editor format (pre-Phase 2). Read-only after Phase 2 ships.';
COMMENT ON COLUMN resume_versions.template_id IS 'Template renderer id: modern | classic | compact | two-column | photo-header';
COMMENT ON COLUMN resume_versions.source_format IS 'Original uploaded file type. Drives default export format.';
COMMENT ON COLUMN resume_versions.parent_document_id IS 'Source document for this derivative. Original document is never overwritten.';
COMMENT ON COLUMN resume_versions.detected_layout IS 'Heuristic layout detection output (column count, photo, sidebar) used to suggest template.';
