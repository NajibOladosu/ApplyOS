-- Add missing columns that should have been in 002 but are missing
ALTER TABLE public.documents
ADD COLUMN IF NOT EXISTS summary_generated_at TIMESTAMPTZ NULL;

ALTER TABLE public.documents
ADD COLUMN IF NOT EXISTS summary TEXT NULL;

COMMENT ON COLUMN public.documents.summary_generated_at IS 'Timestamp when the summary/analysis was last generated';
COMMENT ON COLUMN public.documents.summary IS 'AI-generated summary of the document content';
