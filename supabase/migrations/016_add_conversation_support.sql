-- Migration: Add Conversation Support to Interview Feature
-- Created: 2025-12-01
-- Description: Extends interview tables to support real-time conversational interviews

-- ============================================================================
-- Extend interview_sessions for conversation mode
-- ============================================================================
ALTER TABLE public.interview_sessions
ADD COLUMN IF NOT EXISTS conversation_mode BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS full_transcript JSONB,
ADD COLUMN IF NOT EXISTS conversation_started_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS conversation_ended_at TIMESTAMPTZ;

COMMENT ON COLUMN public.interview_sessions.conversation_mode IS 'True if this is a real-time conversational interview (vs text-based)';
COMMENT ON COLUMN public.interview_sessions.full_transcript IS 'Complete conversation transcript with all turns';
COMMENT ON COLUMN public.interview_sessions.conversation_started_at IS 'When the AI conversation actually started';
COMMENT ON COLUMN public.interview_sessions.conversation_ended_at IS 'When the AI conversation ended';

-- ============================================================================
-- Create conversation_turns table
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.conversation_turns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.interview_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  
  -- Turn metadata
  turn_number INTEGER NOT NULL,
  speaker TEXT NOT NULL CHECK (speaker IN ('ai', 'user')),
  
  -- Content
  content TEXT NOT NULL,
  audio_url TEXT,
  audio_duration_seconds INTEGER,
  
  -- Additional metadata
  timestamp TIMESTAMPTZ DEFAULT now(),
  metadata JSONB,
  
  created_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE public.conversation_turns IS 'Individual turns in a conversational interview';
COMMENT ON COLUMN public.conversation_turns.speaker IS 'Who spoke: "ai" or "user"';
COMMENT ON COLUMN public.conversation_turns.content IS 'Transcribed text of what was said';
COMMENT ON COLUMN public.conversation_turns.audio_url IS 'URL to audio recording (for user responses)';
COMMENT ON COLUMN public.conversation_turns.metadata IS 'Additional data like AI state, follow-up flags, etc.';

-- ============================================================================
-- Create indexes
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_conversation_turns_session_id ON public.conversation_turns(session_id);
CREATE INDEX IF NOT EXISTS idx_conversation_turns_user_id ON public.conversation_turns(user_id);
CREATE INDEX IF NOT EXISTS idx_conversation_turns_turn_number ON public.conversation_turns(session_id, turn_number);
CREATE INDEX IF NOT EXISTS idx_interview_sessions_conversation_mode ON public.interview_sessions(conversation_mode);

-- ============================================================================
-- Enable RLS
-- ============================================================================
ALTER TABLE public.conversation_turns ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RLS Policies for conversation_turns
-- ============================================================================

-- SELECT: Users can view turns for their own sessions
CREATE POLICY "Users can view conversation turns for own sessions"
ON public.conversation_turns
FOR SELECT
TO public
USING (auth.uid() = user_id);

-- INSERT: Users can create turns for their own sessions
CREATE POLICY "Users can create conversation turns for own sessions"
ON public.conversation_turns
FOR INSERT
TO public
WITH CHECK (auth.uid() = user_id);

-- UPDATE: Users can update their own turns
CREATE POLICY "Users can update own conversation turns"
ON public.conversation_turns
FOR UPDATE
TO public
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- DELETE: Users can delete their own turns
CREATE POLICY "Users can delete own conversation turns"
ON public.conversation_turns
FOR DELETE
TO public
USING (auth.uid() = user_id);

-- ============================================================================
-- Grant permissions
-- ============================================================================
GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversation_turns TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversation_turns TO service_role;
