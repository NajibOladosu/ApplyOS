-- Add AI retry queue table for handling rate-limited requests
CREATE TABLE IF NOT EXISTS public.ai_retry_queue (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  task_type TEXT NOT NULL CHECK (task_type IN ('parse_document', 'generate_report', 'generate_answer', 'extract_questions', 'generate_cover_letter')),
  task_data JSONB NOT NULL,
  scheduled_retry_time TIMESTAMP WITH TIME ZONE NOT NULL,
  attempt_count INTEGER DEFAULT 1,
  max_attempts INTEGER DEFAULT 5,
  last_error TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Create index for efficient querying of pending tasks
CREATE INDEX IF NOT EXISTS idx_ai_retry_queue_scheduled_time ON public.ai_retry_queue(scheduled_retry_time) WHERE completed_at IS NULL;

-- Create index for user-specific queries
CREATE INDEX IF NOT EXISTS idx_ai_retry_queue_user_id ON public.ai_retry_queue(user_id);

-- Add comments
COMMENT ON TABLE public.ai_retry_queue IS 'Queue for retrying AI tasks when rate limits are reached';
COMMENT ON COLUMN public.ai_retry_queue.task_type IS 'Type of AI task: parse_document, generate_report, generate_answer, extract_questions, generate_cover_letter';
COMMENT ON COLUMN public.ai_retry_queue.task_data IS 'Task-specific data needed to retry (document_id, question_id, etc)';
COMMENT ON COLUMN public.ai_retry_queue.scheduled_retry_time IS 'When this task should be retried';
COMMENT ON COLUMN public.ai_retry_queue.attempt_count IS 'Number of retry attempts made so far';
COMMENT ON COLUMN public.ai_retry_queue.max_attempts IS 'Maximum number of retry attempts before giving up';
COMMENT ON COLUMN public.ai_retry_queue.last_error IS 'Last error encountered when retrying this task';
COMMENT ON COLUMN public.ai_retry_queue.completed_at IS 'When the task was successfully completed';

-- Update documents table to add last_model_used column
ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS last_model_used TEXT;

-- Update analysis_status enum to include 'rate_limited' and 'pending_analysis'
-- Note: We need to update the CHECK constraint by dropping and recreating it
ALTER TABLE public.documents
  DROP CONSTRAINT IF EXISTS documents_analysis_status_check;

ALTER TABLE public.documents
  ADD CONSTRAINT documents_analysis_status_check
    CHECK (analysis_status IN ('not_analyzed', 'pending_analysis', 'pending', 'rate_limited', 'success', 'failed'));

-- Add comment for last_model_used
COMMENT ON COLUMN public.documents.last_model_used IS 'The Gemini model used for the last successful analysis';

-- Enable RLS on ai_retry_queue
ALTER TABLE public.ai_retry_queue ENABLE ROW LEVEL SECURITY;

-- RLS policy: users can only see their own retry queue
CREATE POLICY "Users can see their own retry queue" ON public.ai_retry_queue
  FOR SELECT USING (auth.uid() = user_id);

-- RLS policy: only service role can insert/update retry queue (system-managed)
CREATE POLICY "Service role manages retry queue" ON public.ai_retry_queue
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Service role updates retry queue" ON public.ai_retry_queue
  FOR UPDATE USING (true);
