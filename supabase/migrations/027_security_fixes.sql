-- Security fixes for RLS and search_paths

-- 1. Secure document_analyses with RLS
ALTER TABLE public.document_analyses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own document analyses"
  ON public.document_analyses FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.applications
      WHERE applications.id = document_analyses.application_id
      AND applications.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own document analyses"
  ON public.document_analyses FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.applications
      WHERE applications.id = document_analyses.application_id
      AND applications.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own document analyses"
  ON public.document_analyses FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.applications
      WHERE applications.id = document_analyses.application_id
      AND applications.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own document analyses"
  ON public.document_analyses FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.applications
      WHERE applications.id = document_analyses.application_id
      AND applications.user_id = auth.uid()
    )
  );

-- 2. Fix mutable search paths in functions
CREATE OR REPLACE FUNCTION public.trigger_screenshot_analysis()
RETURNS TRIGGER AS $$
BEGIN
  -- Only trigger for new files in screenshots folder
  IF NEW.name LIKE 'screenshots/%' AND NEW.name LIKE '%.png' THEN
    PERFORM
      net.http_post(
        url := current_setting('app.settings.supabase_url') || '/functions/v1/analyze-screenshot',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
        ),
        body := jsonb_build_object('record', row_to_json(NEW))
      );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- 3. Remove permissive "Service Role" policies that inadvertently allow public access
-- These tables should only be accessed by the service role (which bypasses RLS).

-- ai_retry_queue
DROP POLICY IF EXISTS "Service role manages retry queue" ON public.ai_retry_queue;
DROP POLICY IF EXISTS "Service role updates retry queue" ON public.ai_retry_queue;

-- email_queue
DROP POLICY IF EXISTS "Service can insert email queue entries" ON public.email_queue;

-- marketing_content_calendar
DROP POLICY IF EXISTS "Service role has full access" ON public.marketing_content_calendar;

-- screenshot_metadata
DROP POLICY IF EXISTS "Service role has full access" ON public.screenshot_metadata;
