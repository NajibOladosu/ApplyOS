-- ============================================
-- TRACKLY DATABASE MIGRATION
-- Apply this in your Supabase SQL Editor
-- ============================================

-- Add new fields to documents table for AI analysis and summary tracking
ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS summary TEXT,
  ADD COLUMN IF NOT EXISTS summary_generated_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS analysis_status TEXT DEFAULT 'not_analyzed' CHECK (analysis_status IN ('not_analyzed', 'pending', 'success', 'failed')),
  ADD COLUMN IF NOT EXISTS analysis_error TEXT,
  ADD COLUMN IF NOT EXISTS parsed_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS application_id UUID REFERENCES public.applications(id) ON DELETE SET NULL;

-- Create index for better query performance when filtering by analysis status
CREATE INDEX IF NOT EXISTS idx_documents_analysis_status ON public.documents(analysis_status);

-- Create index for documents linked to applications
CREATE INDEX IF NOT EXISTS idx_documents_application_id ON public.documents(application_id);

-- Add comment to explain the new fields
COMMENT ON COLUMN public.documents.summary IS 'AI-generated summary of the document content';
COMMENT ON COLUMN public.documents.summary_generated_at IS 'Timestamp when the summary was last generated';
COMMENT ON COLUMN public.documents.analysis_status IS 'Status of AI analysis: not_analyzed, pending, success, or failed';
COMMENT ON COLUMN public.documents.analysis_error IS 'Error message if analysis failed';
COMMENT ON COLUMN public.documents.parsed_at IS 'Timestamp when the document was last analyzed';
COMMENT ON COLUMN public.documents.application_id IS 'Optional link to an application this document is associated with';

-- Verify the migration worked
SELECT
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'documents'
  AND table_schema = 'public'
  AND column_name IN ('summary', 'summary_generated_at', 'analysis_status', 'analysis_error', 'parsed_at', 'application_id')
ORDER BY ordinal_position;

-- This should show 6 rows with the new columns
