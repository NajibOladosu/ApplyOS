-- Migration: Create Interview Feature Tables
-- Created: 2025-11-25
-- Description: Creates all tables needed for the AI-powered interview practice feature
--
-- Tables created:
-- 1. interview_sessions - Main interview session tracking
-- 2. interview_questions - AI-generated questions for each session
-- 3. interview_answers - User answers with AI scoring and feedback
-- 4. interview_analytics - Aggregated analytics for progress tracking
-- 5. company_interview_templates - Pre-defined company-specific question banks

-- ============================================================================
-- TABLE 1: interview_sessions
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.interview_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  -- Session metadata
  session_type TEXT NOT NULL CHECK (session_type IN ('behavioral', 'technical', 'company_specific', 'mixed', 'resume_grill')),
  company_name TEXT,
  difficulty TEXT CHECK (difficulty IN ('easy', 'medium', 'hard')),

  -- Session state
  status TEXT DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'abandoned')),
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,

  -- Session statistics (calculated after completion)
  total_questions INTEGER DEFAULT 0,
  answered_questions INTEGER DEFAULT 0,
  average_score DECIMAL(4,2),
  total_duration_seconds INTEGER,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE public.interview_sessions IS 'Tracks individual mock interview sessions for job applications';
COMMENT ON COLUMN public.interview_sessions.session_type IS 'Type of interview: behavioral, technical, company_specific, mixed, resume_grill';
COMMENT ON COLUMN public.interview_sessions.status IS 'Session status: in_progress, completed, abandoned';
COMMENT ON COLUMN public.interview_sessions.average_score IS 'Average score across all answered questions (0.00 to 10.00)';

-- ============================================================================
-- TABLE 2: interview_questions
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.interview_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.interview_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  -- Question content
  question_text TEXT NOT NULL,
  question_category TEXT NOT NULL CHECK (question_category IN (
    'behavioral_leadership',
    'behavioral_teamwork',
    'behavioral_conflict',
    'behavioral_failure',
    'technical_coding',
    'technical_system_design',
    'technical_algorithms',
    'company_culture',
    'company_values',
    'resume_specific',
    'other'
  )),
  difficulty TEXT CHECK (difficulty IN ('easy', 'medium', 'hard')),

  -- AI guidance for answer
  ideal_answer_outline JSONB,
  evaluation_criteria JSONB,

  -- Question metadata
  question_order INTEGER NOT NULL,
  estimated_duration_seconds INTEGER DEFAULT 180,

  created_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE public.interview_questions IS 'AI-generated interview questions for each session';
COMMENT ON COLUMN public.interview_questions.ideal_answer_outline IS 'STAR method guidance, code structure hints, key points to cover';
COMMENT ON COLUMN public.interview_questions.evaluation_criteria IS 'What AI should look for when scoring answers';

-- ============================================================================
-- TABLE 3: interview_answers
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.interview_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID NOT NULL REFERENCES public.interview_questions(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES public.interview_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  -- Answer content
  answer_text TEXT NOT NULL,
  answer_type TEXT NOT NULL CHECK (answer_type IN ('voice', 'text')),

  -- Audio storage (if voice answer)
  audio_url TEXT,
  audio_duration_seconds INTEGER,
  transcription_confidence DECIMAL(4,2),

  -- AI Evaluation
  score DECIMAL(4,2) NOT NULL CHECK (score >= 0 AND score <= 10),
  feedback JSONB NOT NULL,

  -- Detailed scoring breakdown
  clarity_score DECIMAL(4,2),
  structure_score DECIMAL(4,2),
  relevance_score DECIMAL(4,2),
  depth_score DECIMAL(4,2),
  confidence_score DECIMAL(4,2),

  -- Timing
  time_taken_seconds INTEGER,
  answered_at TIMESTAMPTZ DEFAULT now(),

  created_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE public.interview_answers IS 'User answers with AI scoring and feedback';
COMMENT ON COLUMN public.interview_answers.answer_text IS 'Transcribed from voice or typed directly';
COMMENT ON COLUMN public.interview_answers.transcription_confidence IS '0.00 to 1.00 (Gemini confidence score)';
COMMENT ON COLUMN public.interview_answers.score IS 'Overall AI score from 0.00 to 10.00';
COMMENT ON COLUMN public.interview_answers.feedback IS 'JSON: { strengths: [], weaknesses: [], suggestions: [], overall: "" }';

-- ============================================================================
-- TABLE 4: interview_analytics
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.interview_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  application_id UUID REFERENCES public.applications(id) ON DELETE CASCADE,

  -- Time period (weekly/monthly aggregation)
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,

  -- Aggregate metrics
  total_sessions INTEGER DEFAULT 0,
  total_questions INTEGER DEFAULT 0,
  total_answers INTEGER DEFAULT 0,

  average_score DECIMAL(4,2),
  average_clarity_score DECIMAL(4,2),
  average_structure_score DECIMAL(4,2),
  average_relevance_score DECIMAL(4,2),
  average_depth_score DECIMAL(4,2),
  average_confidence_score DECIMAL(4,2),

  -- Category breakdown (JSONB for flexibility)
  scores_by_category JSONB,

  -- Top strengths and weaknesses (array of strings)
  top_strengths TEXT[],
  common_weaknesses TEXT[],

  -- Trend data
  score_trend JSONB,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(user_id, application_id, period_start, period_end)
);

COMMENT ON TABLE public.interview_analytics IS 'Aggregated analytics for tracking interview progress over time';
COMMENT ON COLUMN public.interview_analytics.application_id IS 'NULL for global user stats, non-NULL for per-application stats';
COMMENT ON COLUMN public.interview_analytics.scores_by_category IS 'JSON: { "behavioral_leadership": 7.5, "technical_coding": 6.2, ... }';
COMMENT ON COLUMN public.interview_analytics.score_trend IS 'JSON array of { date, score } for charting';

-- ============================================================================
-- TABLE 5: company_interview_templates
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.company_interview_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Company identification
  company_name TEXT NOT NULL,
  company_slug TEXT NOT NULL UNIQUE,

  -- Template metadata
  job_role TEXT,
  interview_round TEXT,

  -- Questions and guidance
  questions JSONB NOT NULL,

  -- Template metadata
  description TEXT,
  tips TEXT[],

  -- Usage tracking
  times_used INTEGER DEFAULT 0,
  last_used_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE public.company_interview_templates IS 'Pre-defined question templates for specific companies';
COMMENT ON COLUMN public.company_interview_templates.company_slug IS 'URL-friendly slug: google, meta, amazon, etc.';
COMMENT ON COLUMN public.company_interview_templates.questions IS 'JSON array of { text, category, difficulty, ideal_outline, tips }';
COMMENT ON COLUMN public.company_interview_templates.job_role IS 'Software Engineer, Product Manager, NULL for generic';
COMMENT ON COLUMN public.company_interview_templates.interview_round IS 'Phone Screen, Onsite, Behavioral, NULL for generic';

-- ============================================================================
-- CREATE INDEXES FOR PERFORMANCE
-- ============================================================================

-- interview_sessions indexes
CREATE INDEX IF NOT EXISTS idx_interview_sessions_application_id ON public.interview_sessions(application_id);
CREATE INDEX IF NOT EXISTS idx_interview_sessions_user_id ON public.interview_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_interview_sessions_status ON public.interview_sessions(status);
CREATE INDEX IF NOT EXISTS idx_interview_sessions_session_type ON public.interview_sessions(session_type);
CREATE INDEX IF NOT EXISTS idx_interview_sessions_started_at ON public.interview_sessions(started_at DESC);

-- interview_questions indexes
CREATE INDEX IF NOT EXISTS idx_interview_questions_session_id ON public.interview_questions(session_id);
CREATE INDEX IF NOT EXISTS idx_interview_questions_category ON public.interview_questions(question_category);
CREATE INDEX IF NOT EXISTS idx_interview_questions_user_id ON public.interview_questions(user_id);

-- interview_answers indexes
CREATE INDEX IF NOT EXISTS idx_interview_answers_question_id ON public.interview_answers(question_id);
CREATE INDEX IF NOT EXISTS idx_interview_answers_session_id ON public.interview_answers(session_id);
CREATE INDEX IF NOT EXISTS idx_interview_answers_score ON public.interview_answers(score);
CREATE INDEX IF NOT EXISTS idx_interview_answers_user_id ON public.interview_answers(user_id);

-- interview_analytics indexes
CREATE INDEX IF NOT EXISTS idx_interview_analytics_user_id ON public.interview_analytics(user_id);
CREATE INDEX IF NOT EXISTS idx_interview_analytics_application_id ON public.interview_analytics(application_id);
CREATE INDEX IF NOT EXISTS idx_interview_analytics_period ON public.interview_analytics(period_start, period_end);

-- company_interview_templates indexes
CREATE INDEX IF NOT EXISTS idx_company_templates_company_slug ON public.company_interview_templates(company_slug);
CREATE INDEX IF NOT EXISTS idx_company_templates_job_role ON public.company_interview_templates(job_role);

-- ============================================================================
-- ENABLE ROW LEVEL SECURITY
-- ============================================================================
ALTER TABLE public.interview_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interview_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interview_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interview_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_interview_templates ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- DROP EXISTING POLICIES (IF ANY)
-- ============================================================================

-- interview_sessions policies
DROP POLICY IF EXISTS "Users can view interview sessions for own applications" ON public.interview_sessions;
DROP POLICY IF EXISTS "Users can create interview sessions for own applications" ON public.interview_sessions;
DROP POLICY IF EXISTS "Users can update own interview sessions" ON public.interview_sessions;
DROP POLICY IF EXISTS "Users can delete own interview sessions" ON public.interview_sessions;

-- interview_questions policies
DROP POLICY IF EXISTS "Users can view interview questions for own sessions" ON public.interview_questions;
DROP POLICY IF EXISTS "Users can create interview questions for own sessions" ON public.interview_questions;
DROP POLICY IF EXISTS "Users can update own interview questions" ON public.interview_questions;
DROP POLICY IF EXISTS "Users can delete own interview questions" ON public.interview_questions;

-- interview_answers policies
DROP POLICY IF EXISTS "Users can view interview answers for own sessions" ON public.interview_answers;
DROP POLICY IF EXISTS "Users can create interview answers for own sessions" ON public.interview_answers;
DROP POLICY IF EXISTS "Users can update own interview answers" ON public.interview_answers;
DROP POLICY IF EXISTS "Users can delete own interview answers" ON public.interview_answers;

-- interview_analytics policies
DROP POLICY IF EXISTS "Users can view own analytics" ON public.interview_analytics;
DROP POLICY IF EXISTS "Users can create own analytics" ON public.interview_analytics;
DROP POLICY IF EXISTS "Users can update own analytics" ON public.interview_analytics;
DROP POLICY IF EXISTS "Users can delete own analytics" ON public.interview_analytics;

-- company_interview_templates policies
DROP POLICY IF EXISTS "All users can view company templates" ON public.company_interview_templates;

-- ============================================================================
-- CREATE RLS POLICIES: interview_sessions
-- ============================================================================

-- SELECT: Users can view sessions for their own applications
CREATE POLICY "Users can view interview sessions for own applications"
ON public.interview_sessions
FOR SELECT
TO public
USING (
  EXISTS (
    SELECT 1
    FROM public.applications
    WHERE applications.id = interview_sessions.application_id
    AND applications.user_id = auth.uid()
  )
);

-- INSERT: Users can create sessions for their own applications
CREATE POLICY "Users can create interview sessions for own applications"
ON public.interview_sessions
FOR INSERT
TO public
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1
    FROM public.applications
    WHERE applications.id = interview_sessions.application_id
    AND applications.user_id = auth.uid()
  )
);

-- UPDATE: Users can update their own sessions
CREATE POLICY "Users can update own interview sessions"
ON public.interview_sessions
FOR UPDATE
TO public
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- DELETE: Users can delete their own sessions
CREATE POLICY "Users can delete own interview sessions"
ON public.interview_sessions
FOR DELETE
TO public
USING (auth.uid() = user_id);

-- ============================================================================
-- CREATE RLS POLICIES: interview_questions
-- ============================================================================

-- SELECT: Users can view questions for sessions they own
CREATE POLICY "Users can view interview questions for own sessions"
ON public.interview_questions
FOR SELECT
TO public
USING (
  EXISTS (
    SELECT 1
    FROM public.interview_sessions
    WHERE interview_sessions.id = interview_questions.session_id
    AND interview_sessions.user_id = auth.uid()
  )
);

-- INSERT: Users can create questions for their own sessions
CREATE POLICY "Users can create interview questions for own sessions"
ON public.interview_questions
FOR INSERT
TO public
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1
    FROM public.interview_sessions
    WHERE interview_sessions.id = interview_questions.session_id
    AND interview_sessions.user_id = auth.uid()
  )
);

-- UPDATE: Users can update their own questions
CREATE POLICY "Users can update own interview questions"
ON public.interview_questions
FOR UPDATE
TO public
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- DELETE: Users can delete their own questions
CREATE POLICY "Users can delete own interview questions"
ON public.interview_questions
FOR DELETE
TO public
USING (auth.uid() = user_id);

-- ============================================================================
-- CREATE RLS POLICIES: interview_answers
-- ============================================================================

-- SELECT: Users can view answers for sessions they own
CREATE POLICY "Users can view interview answers for own sessions"
ON public.interview_answers
FOR SELECT
TO public
USING (
  EXISTS (
    SELECT 1
    FROM public.interview_sessions
    WHERE interview_sessions.id = interview_answers.session_id
    AND interview_sessions.user_id = auth.uid()
  )
);

-- INSERT: Users can create answers for their own sessions
CREATE POLICY "Users can create interview answers for own sessions"
ON public.interview_answers
FOR INSERT
TO public
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1
    FROM public.interview_sessions
    WHERE interview_sessions.id = interview_answers.session_id
    AND interview_sessions.user_id = auth.uid()
  )
);

-- UPDATE: Users can update their own answers
CREATE POLICY "Users can update own interview answers"
ON public.interview_answers
FOR UPDATE
TO public
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- DELETE: Users can delete their own answers
CREATE POLICY "Users can delete own interview answers"
ON public.interview_answers
FOR DELETE
TO public
USING (auth.uid() = user_id);

-- ============================================================================
-- CREATE RLS POLICIES: interview_analytics
-- ============================================================================

-- SELECT: Users can view their own analytics
CREATE POLICY "Users can view own analytics"
ON public.interview_analytics
FOR SELECT
TO public
USING (auth.uid() = user_id);

-- INSERT: Users can create their own analytics
CREATE POLICY "Users can create own analytics"
ON public.interview_analytics
FOR INSERT
TO public
WITH CHECK (auth.uid() = user_id);

-- UPDATE: Users can update their own analytics
CREATE POLICY "Users can update own analytics"
ON public.interview_analytics
FOR UPDATE
TO public
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- DELETE: Users can delete their own analytics
CREATE POLICY "Users can delete own analytics"
ON public.interview_analytics
FOR DELETE
TO public
USING (auth.uid() = user_id);

-- ============================================================================
-- CREATE RLS POLICIES: company_interview_templates
-- ============================================================================

-- SELECT: All authenticated users can view company templates (read-only)
CREATE POLICY "All users can view company templates"
ON public.company_interview_templates
FOR SELECT
TO public
USING (true);

-- ============================================================================
-- CREATE UPDATED_AT TRIGGERS
-- ============================================================================

-- Trigger function for interview_sessions
DROP TRIGGER IF EXISTS set_interview_sessions_updated_at ON public.interview_sessions;
CREATE TRIGGER set_interview_sessions_updated_at
BEFORE UPDATE ON public.interview_sessions
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

-- Trigger function for interview_analytics
DROP TRIGGER IF EXISTS set_interview_analytics_updated_at ON public.interview_analytics;
CREATE TRIGGER set_interview_analytics_updated_at
BEFORE UPDATE ON public.interview_analytics
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

-- Trigger function for company_interview_templates
DROP TRIGGER IF EXISTS set_company_templates_updated_at ON public.company_interview_templates;
CREATE TRIGGER set_company_templates_updated_at
BEFORE UPDATE ON public.company_interview_templates
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================
GRANT SELECT, INSERT, UPDATE, DELETE ON public.interview_sessions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.interview_questions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.interview_answers TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.interview_analytics TO authenticated;
GRANT SELECT ON public.company_interview_templates TO authenticated;

-- Service role has full access (for cron jobs and admin tasks)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.interview_sessions TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.interview_questions TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.interview_answers TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.interview_analytics TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_interview_templates TO service_role;

-- ============================================================================
-- VERIFICATION QUERIES (run after applying)
-- ============================================================================
-- To verify tables were created:
-- SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name LIKE 'interview%';
--
-- To verify policies are correctly applied:
-- SELECT tablename, policyname, cmd FROM pg_policies WHERE tablename LIKE 'interview%' ORDER BY tablename, cmd;
--
-- Expected tables:
-- - interview_sessions
-- - interview_questions
-- - interview_answers
-- - interview_analytics
-- - company_interview_templates
