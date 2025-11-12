-- Add cover letter fields to applications table
ALTER TABLE public.applications
  ADD COLUMN ai_cover_letter TEXT,
  ADD COLUMN manual_cover_letter TEXT;

-- Add comment for documentation
COMMENT ON COLUMN public.applications.ai_cover_letter IS 'AI-generated cover letter';
COMMENT ON COLUMN public.applications.manual_cover_letter IS 'User-edited cover letter';
