-- Documents analysis & summary enhancements

ALTER TABLE public.documents
ADD COLUMN IF NOT EXISTS summary TEXT NULL;

ALTER TABLE public.documents
ADD COLUMN IF NOT EXISTS analysis_status TEXT NOT NULL DEFAULT 'not_analyzed'
CHECK (analysis_status IN ('not_analyzed', 'pending', 'success', 'failed'));

ALTER TABLE public.documents
ADD COLUMN IF NOT EXISTS analysis_error TEXT NULL;

ALTER TABLE public.documents
ADD COLUMN IF NOT EXISTS parsed_at TIMESTAMPTZ NULL;

ALTER TABLE public.documents
ADD COLUMN IF NOT EXISTS summary_generated_at TIMESTAMPTZ NULL;

ALTER TABLE public.documents
ADD COLUMN IF NOT EXISTS application_id UUID NULL
REFERENCES public.applications(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_documents_application_id
ON public.documents(application_id);