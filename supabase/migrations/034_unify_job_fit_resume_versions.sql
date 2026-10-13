-- Unify application analysis around a concrete resume version.
--
-- Every uploaded document is version 1 (the immutable original). Edited copies
-- are additional rows in resume_versions and analyses are stored per version,
-- allowing the Job Fit tab to compare any saved revision with the posting.

ALTER TABLE public.resume_versions
  ADD COLUMN IF NOT EXISTS is_original BOOLEAN NOT NULL DEFAULT FALSE;

-- Backfill an immutable original for documents created before resume versioning.
-- The original row intentionally has no content_json: the source file and its
-- extracted/parsed content remain the source of truth for version 1.
INSERT INTO public.resume_versions (
  user_id,
  document_id,
  application_id,
  version_name,
  blocks,
  content_json,
  template_id,
  source_format,
  is_original,
  parent_document_id,
  created_at,
  updated_at
)
SELECT
  d.user_id,
  d.id,
  NULL,
  'Original upload',
  NULL,
  NULL,
  'modern',
  CASE
    WHEN lower(d.file_name) ~ '\.(doc|docx)$' THEN 'docx'
    WHEN lower(d.file_name) ~ '\.txt$' THEN 'txt'
    WHEN lower(d.file_name) ~ '\.json$' THEN 'json'
    ELSE 'pdf'
  END,
  TRUE,
  d.id,
  COALESCE(d.created_at, NOW()),
  COALESCE(d.created_at, NOW())
FROM public.documents d
WHERE NOT EXISTS (
  SELECT 1
  FROM public.resume_versions rv
  WHERE rv.document_id = d.id
    AND rv.is_original = TRUE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_resume_versions_one_original_per_document
  ON public.resume_versions(document_id)
  WHERE is_original = TRUE;

COMMENT ON COLUMN public.resume_versions.is_original IS
  'True only for immutable version 1 created from the uploaded source file.';

ALTER TABLE public.resume_versions
  ADD COLUMN IF NOT EXISTS version_number INTEGER;

WITH ranked_versions AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY document_id
      ORDER BY is_original DESC, created_at ASC, id ASC
    ) AS position
  FROM public.resume_versions
)
UPDATE public.resume_versions rv
SET version_number = ranked_versions.position::INTEGER
FROM ranked_versions
WHERE rv.id = ranked_versions.id
  AND rv.version_number IS NULL;

ALTER TABLE public.resume_versions
  ALTER COLUMN version_number SET NOT NULL;

ALTER TABLE public.resume_versions
  ADD CONSTRAINT resume_versions_positive_version_number
  CHECK (version_number > 0);

ALTER TABLE public.resume_versions
  ADD CONSTRAINT resume_versions_document_version_number_key
  UNIQUE (document_id, version_number);

COMMENT ON COLUMN public.resume_versions.version_number IS
  'Stable, monotonically increasing version number within a source document.';

CREATE OR REPLACE FUNCTION public.assign_resume_version_number()
RETURNS TRIGGER AS $$
BEGIN
  -- Serialize version allocation per document so two simultaneous saves cannot
  -- receive the same version number. Ignore client-supplied numbering.
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.document_id::TEXT, 0));
  SELECT COALESCE(MAX(version_number), 0) + 1
  INTO NEW.version_number
  FROM public.resume_versions
  WHERE document_id = NEW.document_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trigger_assign_resume_version_number ON public.resume_versions;
CREATE TRIGGER trigger_assign_resume_version_number
  BEFORE INSERT ON public.resume_versions
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_resume_version_number();

-- Guarantee that every upload surface (web app, extension, or a future client)
-- creates version 1. Keeping this invariant in the database avoids relying on
-- each uploader to remember a second insert.
CREATE OR REPLACE FUNCTION public.create_original_resume_version()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.resume_versions (
    user_id,
    document_id,
    application_id,
    version_name,
    blocks,
    content_json,
    template_id,
    source_format,
    is_original,
    parent_document_id,
    created_at,
    updated_at
  ) VALUES (
    NEW.user_id,
    NEW.id,
    NULL,
    'Original upload',
    NULL,
    NULL,
    'modern',
    CASE
      WHEN lower(NEW.file_name) ~ '\.(doc|docx)$' THEN 'docx'
      WHEN lower(NEW.file_name) ~ '\.txt$' THEN 'txt'
      WHEN lower(NEW.file_name) ~ '\.json$' THEN 'json'
      ELSE 'pdf'
    END,
    TRUE,
    NEW.id,
    COALESCE(NEW.created_at, NOW()),
    COALESCE(NEW.created_at, NOW())
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trigger_create_original_resume_version ON public.documents;
CREATE TRIGGER trigger_create_original_resume_version
  AFTER INSERT ON public.documents
  FOR EACH ROW
  EXECUTE FUNCTION public.create_original_resume_version();

CREATE OR REPLACE FUNCTION public.protect_resume_version_snapshot()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.document_id IS DISTINCT FROM NEW.document_id
    OR OLD.application_id IS DISTINCT FROM NEW.application_id
    OR OLD.blocks IS DISTINCT FROM NEW.blocks
    OR OLD.content_json IS DISTINCT FROM NEW.content_json
    OR OLD.template_id IS DISTINCT FROM NEW.template_id
    OR OLD.source_format IS DISTINCT FROM NEW.source_format
    OR OLD.parent_document_id IS DISTINCT FROM NEW.parent_document_id
    OR OLD.detected_layout IS DISTINCT FROM NEW.detected_layout
    OR OLD.is_original IS DISTINCT FROM NEW.is_original
    OR OLD.version_number IS DISTINCT FROM NEW.version_number
  THEN
    RAISE EXCEPTION 'Resume version snapshots are immutable; create a new version instead';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS trigger_protect_resume_version_snapshot ON public.resume_versions;
CREATE TRIGGER trigger_protect_resume_version_snapshot
  BEFORE UPDATE ON public.resume_versions
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_resume_version_snapshot();

-- Originals are created only by the trusted document trigger and cannot be
-- overwritten or removed through the client. Document deletion still cascades
-- at the database level.
DROP POLICY IF EXISTS "Users can insert their own resume versions" ON public.resume_versions;
DROP POLICY IF EXISTS "Users can update their own resume versions" ON public.resume_versions;
DROP POLICY IF EXISTS "Users can delete their own resume versions" ON public.resume_versions;

CREATE POLICY "Users can insert their own resume versions"
  ON public.resume_versions FOR INSERT
  WITH CHECK ((SELECT auth.uid()) = user_id AND is_original = FALSE);

CREATE POLICY "Users can update their own resume versions"
  ON public.resume_versions FOR UPDATE
  USING ((SELECT auth.uid()) = user_id AND is_original = FALSE)
  WITH CHECK ((SELECT auth.uid()) = user_id AND is_original = FALSE);

CREATE POLICY "Users can delete their own resume versions"
  ON public.resume_versions FOR DELETE
  USING ((SELECT auth.uid()) = user_id AND is_original = FALSE);

ALTER TABLE public.document_analyses
  ADD COLUMN IF NOT EXISTS resume_version_id UUID
    REFERENCES public.resume_versions(id) ON DELETE CASCADE;

-- Existing analyses were run against the uploaded document, so associate them
-- with that document's original version.
UPDATE public.document_analyses da
SET resume_version_id = rv.id
FROM public.resume_versions rv
WHERE da.resume_version_id IS NULL
  AND rv.document_id = da.document_id
  AND rv.is_original = TRUE;

ALTER TABLE public.document_analyses
  ALTER COLUMN resume_version_id SET NOT NULL;

ALTER TABLE public.document_analyses
  DROP CONSTRAINT IF EXISTS document_analyses_application_id_document_id_key;

ALTER TABLE public.document_analyses
  ADD CONSTRAINT document_analyses_application_resume_version_key
  UNIQUE (application_id, resume_version_id);

CREATE INDEX IF NOT EXISTS idx_document_analyses_resume_version_id
  ON public.document_analyses(resume_version_id);

COMMENT ON COLUMN public.document_analyses.resume_version_id IS
  'The exact immutable resume version evaluated against the application job description.';

-- Keep version-aware analysis references inside the same user boundary.
DROP POLICY IF EXISTS "Users can insert own document analyses" ON public.document_analyses;
DROP POLICY IF EXISTS "Users can update own document analyses" ON public.document_analyses;

CREATE POLICY "Users can insert own document analyses"
  ON public.document_analyses FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.applications a
      WHERE a.id = document_analyses.application_id
        AND a.user_id = (SELECT auth.uid())
    )
    AND EXISTS (
      SELECT 1 FROM public.resume_versions rv
      WHERE rv.id = document_analyses.resume_version_id
        AND rv.document_id = document_analyses.document_id
        AND rv.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Users can update own document analyses"
  ON public.document_analyses FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.applications a
      WHERE a.id = document_analyses.application_id
        AND a.user_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.applications a
      WHERE a.id = document_analyses.application_id
        AND a.user_id = (SELECT auth.uid())
    )
    AND EXISTS (
      SELECT 1 FROM public.resume_versions rv
      WHERE rv.id = document_analyses.resume_version_id
        AND rv.document_id = document_analyses.document_id
        AND rv.user_id = (SELECT auth.uid())
    )
  );

ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS last_analyzed_resume_version_id UUID
    REFERENCES public.resume_versions(id) ON DELETE SET NULL;

UPDATE public.applications a
SET last_analyzed_resume_version_id = original.id
FROM public.resume_versions original
WHERE a.last_analyzed_resume_version_id IS NULL
  AND a.last_analyzed_document_id = original.document_id
  AND original.is_original = TRUE;

COMMENT ON COLUMN public.applications.last_analyzed_resume_version_id IS
  'The exact resume version most recently analyzed in Job Fit.';
