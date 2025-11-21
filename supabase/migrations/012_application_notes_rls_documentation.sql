-- Migration: Document existing RLS policies for application_notes table
-- Status: ALREADY APPLIED IN DATABASE (this migration documents existing policies)
-- Created: 2025-11-21
--
-- The application_notes table was created in production but never tracked in migrations.
-- This file documents the existing RLS policies for version control and deployment to other environments.
--
-- If applying to a fresh database, these policies should be created.
-- If database already has these policies (like production), this migration can be skipped.

-- ============================================================================
-- VERIFY TABLE EXISTS
-- ============================================================================
-- The application_notes table should have these columns:
-- - id (uuid, primary key)
-- - application_id (uuid, foreign key to applications)
-- - user_id (uuid, foreign key to users)
-- - content (text)
-- - category (text, nullable)
-- - is_pinned (boolean, default false)
-- - created_at (timestamptz, default now())
-- - updated_at (timestamptz, default now())

-- If table doesn't exist, create it:
CREATE TABLE IF NOT EXISTS public.application_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  category TEXT,
  is_pinned BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- ENABLE ROW LEVEL SECURITY
-- ============================================================================
ALTER TABLE public.application_notes ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- DROP EXISTING POLICIES (IF ANY) TO ALLOW RECREATION
-- ============================================================================
DROP POLICY IF EXISTS "Users can view their own application notes" ON public.application_notes;
DROP POLICY IF EXISTS "Users can create notes for their own applications" ON public.application_notes;
DROP POLICY IF EXISTS "Users can update their own notes" ON public.application_notes;
DROP POLICY IF EXISTS "Users can delete their own notes" ON public.application_notes;

-- ============================================================================
-- CREATE RLS POLICIES
-- ============================================================================

-- SELECT: Users can view their own notes
CREATE POLICY "Users can view their own application notes"
ON public.application_notes
FOR SELECT
TO public
USING (auth.uid() = user_id);

-- INSERT: Users can create notes for their own applications
-- Ensures both user_id matches AND the application belongs to the user
CREATE POLICY "Users can create notes for their own applications"
ON public.application_notes
FOR INSERT
TO public
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1
    FROM public.applications
    WHERE applications.id = application_notes.application_id
    AND applications.user_id = auth.uid()
  )
);

-- UPDATE: Users can update their own notes
CREATE POLICY "Users can update their own notes"
ON public.application_notes
FOR UPDATE
TO public
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- DELETE: Users can delete their own notes
CREATE POLICY "Users can delete their own notes"
ON public.application_notes
FOR DELETE
TO public
USING (auth.uid() = user_id);

-- ============================================================================
-- CREATE INDEXES FOR PERFORMANCE
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_application_notes_application_id
ON public.application_notes(application_id);

CREATE INDEX IF NOT EXISTS idx_application_notes_user_id
ON public.application_notes(user_id);

CREATE INDEX IF NOT EXISTS idx_application_notes_created_at
ON public.application_notes(created_at DESC);

-- ============================================================================
-- CREATE UPDATED_AT TRIGGER
-- ============================================================================
CREATE OR REPLACE FUNCTION public.handle_application_notes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_application_notes_updated_at ON public.application_notes;

CREATE TRIGGER set_application_notes_updated_at
BEFORE UPDATE ON public.application_notes
FOR EACH ROW
EXECUTE FUNCTION public.handle_application_notes_updated_at();

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================
GRANT SELECT, INSERT, UPDATE, DELETE ON public.application_notes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.application_notes TO service_role;

-- ============================================================================
-- VERIFICATION QUERY (run after applying)
-- ============================================================================
-- To verify policies are correctly applied, run:
-- SELECT policyname, cmd FROM pg_policies WHERE tablename = 'application_notes';
--
-- Expected output:
-- - "Users can view their own application notes" | SELECT
-- - "Users can create notes for their own applications" | INSERT
-- - "Users can update their own notes" | UPDATE
-- - "Users can delete their own notes" | DELETE
