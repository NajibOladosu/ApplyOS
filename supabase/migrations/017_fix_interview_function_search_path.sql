-- Migration: Fix Search Path Security for Interview Computed Functions
-- Created: 2025-12-11
-- Description: Fixes search_path security vulnerabilities in interview computed column functions
-- Security: Addresses Supabase Security Advisor warnings for function_search_path_mutable
--
-- This migration recreates three database functions with proper SECURITY DEFINER
-- and fixed search_path to prevent search_path injection attacks.
--
-- Functions fixed:
-- 1. db_total_questions - Counts total questions for an interview session
-- 2. db_answered_questions - Counts answered questions for an interview session
-- 3. db_average_score - Calculates average score across answered questions
--
-- Security fix: Sets search_path = public, pg_catalog to prevent injection

-- ============================================================================
-- DROP EXISTING FUNCTIONS (with correct signatures)
-- ============================================================================
DROP FUNCTION IF EXISTS public.db_total_questions(interview_sessions);
DROP FUNCTION IF EXISTS public.db_answered_questions(interview_sessions);
DROP FUNCTION IF EXISTS public.db_average_score(interview_sessions);

-- ============================================================================
-- FUNCTION 1: db_total_questions
-- ============================================================================
-- Purpose: Calculates the total number of questions for an interview session
-- Used as: Computed column in interview_sessions queries
-- Security: SECURITY DEFINER with fixed search_path
-- Note: Takes entire interview_sessions row as input (computed column)

CREATE OR REPLACE FUNCTION public.db_total_questions(rec interview_sessions)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  question_count INTEGER;
BEGIN
  SELECT COUNT(*)::INTEGER
  INTO question_count
  FROM public.interview_questions
  WHERE session_id = rec.id;

  RETURN COALESCE(question_count, 0);
END;
$$;

COMMENT ON FUNCTION public.db_total_questions IS
'Computes total number of questions for an interview session. SECURITY DEFINER with fixed search_path.';

-- ============================================================================
-- FUNCTION 2: db_answered_questions
-- ============================================================================
-- Purpose: Calculates the number of answered questions for an interview session
-- Used as: Computed column in interview_sessions queries
-- Security: SECURITY DEFINER with fixed search_path
-- Note: Takes entire interview_sessions row as input (computed column)

CREATE OR REPLACE FUNCTION public.db_answered_questions(rec interview_sessions)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  answered_count INTEGER;
BEGIN
  SELECT COUNT(DISTINCT ia.question_id)::INTEGER
  INTO answered_count
  FROM public.interview_answers ia
  WHERE ia.session_id = rec.id;

  RETURN COALESCE(answered_count, 0);
END;
$$;

COMMENT ON FUNCTION public.db_answered_questions IS
'Computes number of answered questions for an interview session. SECURITY DEFINER with fixed search_path.';

-- ============================================================================
-- FUNCTION 3: db_average_score
-- ============================================================================
-- Purpose: Calculates the average score across all answered questions
-- Used as: Computed column in interview_sessions queries
-- Security: SECURITY DEFINER with fixed search_path
-- Note: Takes entire interview_sessions row as input (computed column)

CREATE OR REPLACE FUNCTION public.db_average_score(rec interview_sessions)
RETURNS DECIMAL(4,2)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  avg_score DECIMAL(4,2);
BEGIN
  SELECT AVG(ia.score)::DECIMAL(4,2)
  INTO avg_score
  FROM public.interview_answers ia
  WHERE ia.session_id = rec.id;

  RETURN avg_score; -- Returns NULL if no answers
END;
$$;

COMMENT ON FUNCTION public.db_average_score IS
'Computes average score across answered questions for an interview session. SECURITY DEFINER with fixed search_path.';

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================
-- Allow authenticated users to execute these functions
GRANT EXECUTE ON FUNCTION public.db_total_questions(interview_sessions) TO authenticated;
GRANT EXECUTE ON FUNCTION public.db_answered_questions(interview_sessions) TO authenticated;
GRANT EXECUTE ON FUNCTION public.db_average_score(interview_sessions) TO authenticated;

-- Service role has full access
GRANT EXECUTE ON FUNCTION public.db_total_questions(interview_sessions) TO service_role;
GRANT EXECUTE ON FUNCTION public.db_answered_questions(interview_sessions) TO service_role;
GRANT EXECUTE ON FUNCTION public.db_average_score(interview_sessions) TO service_role;

-- ============================================================================
-- VERIFICATION QUERIES (run after applying)
-- ============================================================================
-- To verify functions are correctly created with SECURITY DEFINER:
-- SELECT proname, prosecdef, prokind, prosrc
-- FROM pg_proc
-- WHERE proname IN ('db_total_questions', 'db_answered_questions', 'db_average_score');
--
-- To verify search_path is set:
-- SELECT proname, proconfig
-- FROM pg_proc
-- WHERE proname IN ('db_total_questions', 'db_answered_questions', 'db_average_score');
--
-- Expected output:
-- - prosecdef should be 'true' for all three functions
-- - proconfig should contain 'search_path=public, pg_catalog'
