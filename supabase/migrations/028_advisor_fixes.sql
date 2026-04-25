-- Security and Performance Advisor Fixes

-- 1. Secure `notifications` INSERT policy
DROP POLICY IF EXISTS "Service can insert notifications for users" ON public.notifications;

-- Create user-scoped insert policy
CREATE POLICY "Users can insert own notifications"
  ON public.notifications
  FOR INSERT
  TO public
  WITH CHECK ((select auth.uid()) = user_id);

-- 2. Restore Service Role Access (Explicitly)
-- Re-enable access for service_role to internal tables

-- ai_retry_queue
CREATE POLICY "Service role full access" ON public.ai_retry_queue
  TO service_role USING (true) WITH CHECK (true);

-- email_queue
CREATE POLICY "Service role full access" ON public.email_queue
  TO service_role USING (true) WITH CHECK (true);

-- marketing_content_calendar
CREATE POLICY "Service role full access" ON public.marketing_content_calendar
  TO service_role USING (true) WITH CHECK (true);

-- screenshot_metadata
CREATE POLICY "Service role full access" ON public.screenshot_metadata
  TO service_role USING (true) WITH CHECK (true);

-- 3. Fix Unindexed Foreign Key
CREATE INDEX IF NOT EXISTS idx_status_history_changed_by ON public.status_history(changed_by);

-- 4. Optimize `document_analyses` RLS (Auth InitPlan)
-- Drop old policies first (UNCOMMENTED NOW)
DROP POLICY IF EXISTS "Users can view own document analyses" ON public.document_analyses;
DROP POLICY IF EXISTS "Users can insert own document analyses" ON public.document_analyses;
DROP POLICY IF EXISTS "Users can update own document analyses" ON public.document_analyses;
DROP POLICY IF EXISTS "Users can delete own document analyses" ON public.document_analyses;

-- Recreate with optimized (select auth.uid())
CREATE POLICY "Users can view own document analyses"
  ON public.document_analyses FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.applications
      WHERE applications.id = document_analyses.application_id
      AND applications.user_id = (select auth.uid())
    )
  );

CREATE POLICY "Users can insert own document analyses"
  ON public.document_analyses FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.applications
      WHERE applications.id = document_analyses.application_id
      AND applications.user_id = (select auth.uid())
    )
  );

CREATE POLICY "Users can update own document analyses"
  ON public.document_analyses FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.applications
      WHERE applications.id = document_analyses.application_id
      AND applications.user_id = (select auth.uid())
    )
  );

CREATE POLICY "Users can delete own document analyses"
  ON public.document_analyses FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.applications
      WHERE applications.id = document_analyses.application_id
      AND applications.user_id = (select auth.uid())
    )
  );
