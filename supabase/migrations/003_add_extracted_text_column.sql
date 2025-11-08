-- Add extracted_text column to store parsed document content
-- This improves performance by extracting text once during upload
ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS extracted_text TEXT;

-- Create index for full-text search if needed in the future
CREATE INDEX IF NOT EXISTS idx_documents_extracted_text_search ON public.documents USING gin(to_tsvector('english', extracted_text));

-- Add comment
COMMENT ON COLUMN public.documents.extracted_text IS 'Raw text content extracted from the document file (PDF, text, etc.) - extracted once during upload for performance';
