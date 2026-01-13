-- Create document_analyses table for robust analysis persistence
CREATE TABLE public.document_analyses (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  application_id UUID REFERENCES public.applications(id) ON DELETE CASCADE NOT NULL,
  document_id UUID REFERENCES public.documents(id) ON DELETE CASCADE NOT NULL,
  analysis_result JSONB,
  analysis_status TEXT DEFAULT 'not_analyzed' CHECK (analysis_status IN ('not_analyzed', 'pending', 'success', 'failed')),
  summary_generated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(application_id, document_id)
);

CREATE INDEX idx_document_analyses_application_id ON public.document_analyses(application_id);
CREATE INDEX idx_document_analyses_document_id ON public.document_analyses(document_id);

COMMENT ON TABLE public.document_analyses IS 'Stores analysis results for a specific document against a specific application job description';

-- Migrate existing data from application_documents (best effort)
INSERT INTO public.document_analyses (application_id, document_id, analysis_result, analysis_status, summary_generated_at)
SELECT application_id, document_id, analysis_result, analysis_status, summary_generated_at
FROM public.application_documents
WHERE analysis_result IS NOT NULL;
