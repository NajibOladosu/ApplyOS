-- Fix overly permissive RLS on marketing_content_calendar
-- The original policy "Service role has full access" used USING(true) WITH CHECK(true),
-- which grants ALL authenticated users full read/write access to all rows.
-- This table has no user_id column and is an internal/admin-only resource.
-- Fix: drop the permissive policy so only the service role (which bypasses RLS) can access it.

DROP POLICY IF EXISTS "Service role has full access" ON public.marketing_content_calendar;

-- No replacement policy needed: the service role bypasses RLS automatically.
-- Authenticated users should NOT have direct access to this table.
