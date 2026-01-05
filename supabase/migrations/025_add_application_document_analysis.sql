-- Add analysis columns to application_documents to scope analysis to the application
ALTER TABLE public.application_documents
ADD COLUMN IF NOT EXISTS analysis_result JSONB,
ADD COLUMN IF NOT EXISTS summary_generated_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS analysis_status TEXT DEFAULT 'not_analyzed' CHECK (analysis_status IN ('not_analyzed', 'pending', 'success', 'failed'));

CREATE INDEX IF NOT EXISTS idx_application_documents_analysis_status ON public.application_documents(analysis_status);

COMMENT ON COLUMN public.application_documents.analysis_result IS 'Structured JSON analysis of the resume against the specific job description of the application';
