-- Add analysis_result column to documents table to store the structured analysis from AI

ALTER TABLE public.documents
ADD COLUMN IF NOT EXISTS analysis_result JSONB;

COMMENT ON COLUMN public.documents.analysis_result IS 'Structured JSON analysis of the resume against a job description';
