-- Migration: Fix Function Search Path Security Warnings
-- Created: 2025-11-21
--
-- Issue: Supabase Security Advisor flagged 3 functions with mutable search_path
-- Risk: Functions without fixed search_path can be exploited via search_path injection attacks
-- Solution: Set explicit search_path for all functions to prevent security vulnerabilities
--
-- Reference: https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable

-- ============================================================================
-- 1. FIX: update_application_notes_updated_at
-- ============================================================================
-- This function is a trigger that updates the updated_at timestamp
-- Original issue: No search_path set, vulnerable to search_path injection

DROP FUNCTION IF EXISTS public.update_application_notes_updated_at() CASCADE;

CREATE OR REPLACE FUNCTION public.update_application_notes_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog  -- FIX: Explicitly set search_path
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Recreate trigger
DROP TRIGGER IF EXISTS set_application_notes_updated_at ON public.application_notes;

CREATE TRIGGER set_application_notes_updated_at
BEFORE UPDATE ON public.application_notes
FOR EACH ROW
EXECUTE FUNCTION public.update_application_notes_updated_at();

COMMENT ON FUNCTION public.update_application_notes_updated_at() IS
'Trigger function to automatically update updated_at timestamp. Fixed search_path for security.';

-- ============================================================================
-- 2. FIX: update_email_queue_timestamp
-- ============================================================================
-- This function is a trigger that updates the updated_at timestamp for email queue
-- Original issue: No search_path set, vulnerable to search_path injection

DROP FUNCTION IF EXISTS public.update_email_queue_timestamp() CASCADE;

CREATE OR REPLACE FUNCTION public.update_email_queue_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog  -- FIX: Explicitly set search_path
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Recreate trigger
DROP TRIGGER IF EXISTS update_email_queue_timestamp ON public.email_queue;

CREATE TRIGGER update_email_queue_timestamp
BEFORE UPDATE ON public.email_queue
FOR EACH ROW
EXECUTE FUNCTION public.update_email_queue_timestamp();

COMMENT ON FUNCTION public.update_email_queue_timestamp() IS
'Trigger function to automatically update updated_at timestamp on email_queue. Fixed search_path for security.';

-- ============================================================================
-- 3. FIX: handle_new_user
-- ============================================================================
-- This function creates a user profile when a new auth user is created
-- Original issue: No search_path set, vulnerable to search_path injection

DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog  -- FIX: Explicitly set search_path
AS $$
BEGIN
  INSERT INTO public.users (id, email, name, created_at, updated_at)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'full_name'),
    now(),
    now()
  );
  RETURN NEW;
EXCEPTION
  WHEN unique_violation THEN
    -- User already exists, ignore
    RETURN NEW;
  WHEN OTHERS THEN
    -- Log error but don't prevent auth user creation
    RAISE WARNING 'Error creating user profile for %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;

-- Recreate trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();

COMMENT ON FUNCTION public.handle_new_user() IS
'Trigger function to create user profile when auth user is created. Fixed search_path for security.';

-- ============================================================================
-- VERIFICATION QUERIES (run after applying)
-- ============================================================================
-- To verify functions have fixed search_path:
-- SELECT
--   p.proname AS function_name,
--   pg_get_function_identity_arguments(p.oid) AS args,
--   p.proconfig AS search_path_config
-- FROM pg_proc p
-- JOIN pg_namespace n ON p.pronamespace = n.oid
-- WHERE n.nspname = 'public'
-- AND p.proname IN ('update_application_notes_updated_at', 'update_email_queue_timestamp', 'handle_new_user');
--
-- Expected output: Each function should have search_path_config = {search_path=public,pg_catalog}

-- ============================================================================
-- SECURITY NOTES
-- ============================================================================
-- Why search_path matters:
-- - PostgreSQL's search_path determines which schemas are searched for objects
-- - Functions without fixed search_path inherit the caller's search_path
-- - Attackers can manipulate search_path to inject malicious objects
-- - Setting search_path explicitly prevents this attack vector
--
-- What we fixed:
-- - Set search_path = public, pg_catalog for all three functions
-- - This ensures functions only use objects from public and pg_catalog schemas
-- - Prevents search_path injection attacks
-- - Maintains SECURITY DEFINER for proper privilege escalation
--
-- Impact:
-- - No functional changes to the application
-- - Functions continue to work exactly as before
-- - Security vulnerability eliminated
-- - Supabase Security Advisor warnings will be resolved
