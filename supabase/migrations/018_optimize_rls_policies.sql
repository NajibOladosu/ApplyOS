-- Migration: Optimize RLS Policies Performance
-- Created: 2025-12-11
-- Description: Fixes auth_rls_initplan performance warnings by optimizing auth.uid() calls
-- Performance: Addresses Supabase Performance Advisor warnings for auth_rls_initplan
--
-- Issue: auth.uid() is re-evaluated for each row in RLS policies, causing poor performance at scale
-- Fix: Replace auth.uid() with (select auth.uid()) to evaluate once per query
--
-- Impact: Improves query performance for all authenticated operations
-- Affects: 56 RLS policies across 16 tables

-- ============================================================================
-- TABLE: users
-- ============================================================================
DROP POLICY IF EXISTS "Users can view own profile" ON public.users;
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;

CREATE POLICY "Users can view own profile"
ON public.users
FOR SELECT
TO public
USING ((select auth.uid()) = id);

CREATE POLICY "Users can update own profile"
ON public.users
FOR UPDATE
TO public
USING ((select auth.uid()) = id);

-- ============================================================================
-- TABLE: applications
-- ============================================================================
DROP POLICY IF EXISTS "Users can view own applications" ON public.applications;
DROP POLICY IF EXISTS "Users can insert own applications" ON public.applications;
DROP POLICY IF EXISTS "Users can update own applications" ON public.applications;
DROP POLICY IF EXISTS "Users can delete own applications" ON public.applications;

CREATE POLICY "Users can view own applications"
ON public.applications
FOR SELECT
TO public
USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can insert own applications"
ON public.applications
FOR INSERT
TO public
WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can update own applications"
ON public.applications
FOR UPDATE
TO public
USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can delete own applications"
ON public.applications
FOR DELETE
TO public
USING ((select auth.uid()) = user_id);

-- ============================================================================
-- TABLE: questions
-- ============================================================================
DROP POLICY IF EXISTS "Users can view questions for own applications" ON public.questions;
DROP POLICY IF EXISTS "Users can insert questions for own applications" ON public.questions;
DROP POLICY IF EXISTS "Users can update questions for own applications" ON public.questions;
DROP POLICY IF EXISTS "Users can delete questions for own applications" ON public.questions;

CREATE POLICY "Users can view questions for own applications"
ON public.questions
FOR SELECT
TO public
USING (
  EXISTS (
    SELECT 1
    FROM public.applications
    WHERE applications.id = questions.application_id
    AND applications.user_id = (select auth.uid())
  )
);

CREATE POLICY "Users can insert questions for own applications"
ON public.questions
FOR INSERT
TO public
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.applications
    WHERE applications.id = questions.application_id
    AND applications.user_id = (select auth.uid())
  )
);

CREATE POLICY "Users can update questions for own applications"
ON public.questions
FOR UPDATE
TO public
USING (
  EXISTS (
    SELECT 1
    FROM public.applications
    WHERE applications.id = questions.application_id
    AND applications.user_id = (select auth.uid())
  )
);

CREATE POLICY "Users can delete questions for own applications"
ON public.questions
FOR DELETE
TO public
USING (
  EXISTS (
    SELECT 1
    FROM public.applications
    WHERE applications.id = questions.application_id
    AND applications.user_id = (select auth.uid())
  )
);

-- ============================================================================
-- TABLE: documents
-- ============================================================================
DROP POLICY IF EXISTS "Users can view own documents" ON public.documents;
DROP POLICY IF EXISTS "Users can insert own documents" ON public.documents;
DROP POLICY IF EXISTS "Users can update own documents" ON public.documents;
DROP POLICY IF EXISTS "Users can delete own documents" ON public.documents;

CREATE POLICY "Users can view own documents"
ON public.documents
FOR SELECT
TO public
USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can insert own documents"
ON public.documents
FOR INSERT
TO public
WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can update own documents"
ON public.documents
FOR UPDATE
TO public
USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can delete own documents"
ON public.documents
FOR DELETE
TO public
USING ((select auth.uid()) = user_id);

-- ============================================================================
-- TABLE: notifications
-- ============================================================================
DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;

CREATE POLICY "Users can view own notifications"
ON public.notifications
FOR SELECT
TO public
USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can update own notifications"
ON public.notifications
FOR UPDATE
TO public
USING ((select auth.uid()) = user_id);

-- ============================================================================
-- TABLE: status_history
-- ============================================================================
DROP POLICY IF EXISTS "Users can view status history for own applications" ON public.status_history;

CREATE POLICY "Users can view status history for own applications"
ON public.status_history
FOR SELECT
TO public
USING (
  EXISTS (
    SELECT 1
    FROM public.applications
    WHERE applications.id = status_history.application_id
    AND applications.user_id = (select auth.uid())
  )
);

-- ============================================================================
-- TABLE: application_documents
-- ============================================================================
DROP POLICY IF EXISTS "Users can view application documents for own applications" ON public.application_documents;
DROP POLICY IF EXISTS "Users can insert application documents for own applications" ON public.application_documents;
DROP POLICY IF EXISTS "Users can delete application documents for own applications" ON public.application_documents;

CREATE POLICY "Users can view application documents for own applications"
ON public.application_documents
FOR SELECT
TO public
USING (
  EXISTS (
    SELECT 1
    FROM public.applications
    WHERE applications.id = application_documents.application_id
    AND applications.user_id = (select auth.uid())
  )
);

CREATE POLICY "Users can insert application documents for own applications"
ON public.application_documents
FOR INSERT
TO public
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.applications
    WHERE applications.id = application_documents.application_id
    AND applications.user_id = (select auth.uid())
  )
);

CREATE POLICY "Users can delete application documents for own applications"
ON public.application_documents
FOR DELETE
TO public
USING (
  EXISTS (
    SELECT 1
    FROM public.applications
    WHERE applications.id = application_documents.application_id
    AND applications.user_id = (select auth.uid())
  )
);

-- ============================================================================
-- TABLE: email_queue
-- ============================================================================
DROP POLICY IF EXISTS "Users can view their own email queue" ON public.email_queue;

CREATE POLICY "Users can view their own email queue"
ON public.email_queue
FOR SELECT
TO public
USING ((select auth.uid()) = user_id);

-- ============================================================================
-- TABLE: feedback
-- ============================================================================
DROP POLICY IF EXISTS "Users can view own feedback" ON public.feedback;
DROP POLICY IF EXISTS "Users can insert own feedback" ON public.feedback;

CREATE POLICY "Users can view own feedback"
ON public.feedback
FOR SELECT
TO public
USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can insert own feedback"
ON public.feedback
FOR INSERT
TO public
WITH CHECK ((select auth.uid()) = user_id);

-- ============================================================================
-- TABLE: ai_retry_queue
-- ============================================================================
DROP POLICY IF EXISTS "Users can see their own retry queue" ON public.ai_retry_queue;

CREATE POLICY "Users can see their own retry queue"
ON public.ai_retry_queue
FOR SELECT
TO public
USING ((select auth.uid()) = user_id);

-- ============================================================================
-- TABLE: application_notes
-- ============================================================================
DROP POLICY IF EXISTS "Users can view their own application notes" ON public.application_notes;
DROP POLICY IF EXISTS "Users can create notes for their own applications" ON public.application_notes;
DROP POLICY IF EXISTS "Users can update their own notes" ON public.application_notes;
DROP POLICY IF EXISTS "Users can delete their own notes" ON public.application_notes;

CREATE POLICY "Users can view their own application notes"
ON public.application_notes
FOR SELECT
TO public
USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can create notes for their own applications"
ON public.application_notes
FOR INSERT
TO public
WITH CHECK (
  (select auth.uid()) = user_id
  AND EXISTS (
    SELECT 1
    FROM public.applications
    WHERE applications.id = application_notes.application_id
    AND applications.user_id = (select auth.uid())
  )
);

CREATE POLICY "Users can update their own notes"
ON public.application_notes
FOR UPDATE
TO public
USING ((select auth.uid()) = user_id)
WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can delete their own notes"
ON public.application_notes
FOR DELETE
TO public
USING ((select auth.uid()) = user_id);

-- ============================================================================
-- TABLE: interview_sessions
-- ============================================================================
DROP POLICY IF EXISTS "Users can view own interview sessions" ON public.interview_sessions;
DROP POLICY IF EXISTS "Users can create own interview sessions" ON public.interview_sessions;
DROP POLICY IF EXISTS "Users can update own interview sessions" ON public.interview_sessions;
DROP POLICY IF EXISTS "Users can delete own interview sessions" ON public.interview_sessions;

CREATE POLICY "Users can view own interview sessions"
ON public.interview_sessions
FOR SELECT
TO public
USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can create own interview sessions"
ON public.interview_sessions
FOR INSERT
TO public
WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can update own interview sessions"
ON public.interview_sessions
FOR UPDATE
TO public
USING ((select auth.uid()) = user_id)
WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can delete own interview sessions"
ON public.interview_sessions
FOR DELETE
TO public
USING ((select auth.uid()) = user_id);

-- ============================================================================
-- TABLE: interview_questions
-- ============================================================================
DROP POLICY IF EXISTS "Users can view own interview questions" ON public.interview_questions;
DROP POLICY IF EXISTS "Users can create own interview questions" ON public.interview_questions;
DROP POLICY IF EXISTS "Users can update own interview questions" ON public.interview_questions;
DROP POLICY IF EXISTS "Users can delete own interview questions" ON public.interview_questions;

CREATE POLICY "Users can view own interview questions"
ON public.interview_questions
FOR SELECT
TO public
USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can create own interview questions"
ON public.interview_questions
FOR INSERT
TO public
WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can update own interview questions"
ON public.interview_questions
FOR UPDATE
TO public
USING ((select auth.uid()) = user_id)
WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can delete own interview questions"
ON public.interview_questions
FOR DELETE
TO public
USING ((select auth.uid()) = user_id);

-- ============================================================================
-- TABLE: interview_answers
-- ============================================================================
DROP POLICY IF EXISTS "Users can view interview answers for own sessions" ON public.interview_answers;
DROP POLICY IF EXISTS "Users can create interview answers for own sessions" ON public.interview_answers;
DROP POLICY IF EXISTS "Users can update own interview answers" ON public.interview_answers;
DROP POLICY IF EXISTS "Users can delete own interview answers" ON public.interview_answers;

CREATE POLICY "Users can view interview answers for own sessions"
ON public.interview_answers
FOR SELECT
TO public
USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can create interview answers for own sessions"
ON public.interview_answers
FOR INSERT
TO public
WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can update own interview answers"
ON public.interview_answers
FOR UPDATE
TO public
USING ((select auth.uid()) = user_id)
WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can delete own interview answers"
ON public.interview_answers
FOR DELETE
TO public
USING ((select auth.uid()) = user_id);

-- ============================================================================
-- TABLE: interview_analytics
-- ============================================================================
DROP POLICY IF EXISTS "Users can view own analytics" ON public.interview_analytics;
DROP POLICY IF EXISTS "Users can create own analytics" ON public.interview_analytics;
DROP POLICY IF EXISTS "Users can update own analytics" ON public.interview_analytics;
DROP POLICY IF EXISTS "Users can delete own analytics" ON public.interview_analytics;

CREATE POLICY "Users can view own analytics"
ON public.interview_analytics
FOR SELECT
TO public
USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can create own analytics"
ON public.interview_analytics
FOR INSERT
TO public
WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can update own analytics"
ON public.interview_analytics
FOR UPDATE
TO public
USING ((select auth.uid()) = user_id)
WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can delete own analytics"
ON public.interview_analytics
FOR DELETE
TO public
USING ((select auth.uid()) = user_id);

-- ============================================================================
-- TABLE: conversation_turns
-- ============================================================================
DROP POLICY IF EXISTS "Users can view conversation turns for own sessions" ON public.conversation_turns;
DROP POLICY IF EXISTS "Users can create conversation turns for own sessions" ON public.conversation_turns;
DROP POLICY IF EXISTS "Users can update own conversation turns" ON public.conversation_turns;
DROP POLICY IF EXISTS "Users can delete own conversation turns" ON public.conversation_turns;

CREATE POLICY "Users can view conversation turns for own sessions"
ON public.conversation_turns
FOR SELECT
TO public
USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can create conversation turns for own sessions"
ON public.conversation_turns
FOR INSERT
TO public
WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can update own conversation turns"
ON public.conversation_turns
FOR UPDATE
TO public
USING ((select auth.uid()) = user_id)
WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can delete own conversation turns"
ON public.conversation_turns
FOR DELETE
TO public
USING ((select auth.uid()) = user_id);

-- ============================================================================
-- VERIFICATION QUERY (run after applying)
-- ============================================================================
-- To verify all policies have been updated:
-- SELECT tablename, policyname, cmd
-- FROM pg_policies
-- WHERE schemaname = 'public'
-- AND (qual LIKE '%auth.uid()%' OR with_check LIKE '%auth.uid()%')
-- ORDER BY tablename;
--
-- Expected: No results (all auth.uid() should be wrapped in (select ...))
