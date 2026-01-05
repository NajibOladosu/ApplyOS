-- Add last_analyzed_document_id to applications table to track the last used resume for analysis

ALTER TABLE public.applications
ADD COLUMN IF NOT EXISTS last_analyzed_document_id UUID NULL
REFERENCES public.documents(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_applications_last_analyzed_document_id
ON public.applications(last_analyzed_document_id);

COMMENT ON COLUMN public.applications.last_analyzed_document_id IS 'ID of the last document used for analysis for this application';
