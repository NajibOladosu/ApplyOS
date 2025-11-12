-- Rename summary fields to report and change type to JSONB for structured report data

-- Rename columns
ALTER TABLE public.documents
  RENAME COLUMN summary TO report;

ALTER TABLE public.documents
  RENAME COLUMN summary_generated_at TO report_generated_at;

-- Change report column type from TEXT to JSONB
ALTER TABLE public.documents
  ALTER COLUMN report TYPE JSONB USING
  CASE
    WHEN report IS NOT NULL THEN jsonb_build_object('overallAssessment', report)
    ELSE NULL
  END;

-- Update column comments
COMMENT ON COLUMN public.documents.report IS 'AI-generated structured report of the document with ratings and feedback';
COMMENT ON COLUMN public.documents.report_generated_at IS 'Timestamp when the report was last generated';
