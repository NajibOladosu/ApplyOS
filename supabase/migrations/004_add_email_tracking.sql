-- Add email tracking to notifications table
ALTER TABLE notifications
ADD COLUMN IF NOT EXISTS email_sent BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS email_sent_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS email_error TEXT;

-- Create email queue table for reliable delivery tracking
CREATE TABLE IF NOT EXISTS email_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  notification_id UUID REFERENCES notifications(id) ON DELETE SET NULL,
  email_to TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  html_body TEXT,
  template_type TEXT NOT NULL, -- 'welcome', 'status_update', 'deadline_reminder', 'weekly_digest'
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'sent', 'failed', 'bounced'
  attempts INT DEFAULT 0,
  max_attempts INT DEFAULT 3,
  error_message TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT valid_status CHECK (status IN ('pending', 'sent', 'failed', 'bounced')),
  CONSTRAINT valid_template CHECK (template_type IN ('welcome', 'status_update', 'deadline_reminder', 'weekly_digest'))
);

-- Enable RLS on email_queue
ALTER TABLE email_queue ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only see their own email queue
CREATE POLICY "Users can view their own email queue"
  ON email_queue FOR SELECT
  USING (auth.uid() = user_id);

-- RLS Policy: Service can insert emails for any user
CREATE POLICY "Service can insert email queue entries"
  ON email_queue FOR INSERT
  WITH CHECK (TRUE);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS email_queue_user_id_status_idx ON email_queue(user_id, status);
CREATE INDEX IF NOT EXISTS email_queue_status_created_at_idx ON email_queue(status, created_at);
CREATE INDEX IF NOT EXISTS email_queue_notification_id_idx ON email_queue(notification_id);
CREATE INDEX IF NOT EXISTS notifications_email_sent_idx ON notifications(email_sent);

-- Create function to update email_queue.updated_at timestamp
CREATE OR REPLACE FUNCTION update_email_queue_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-update updated_at
DROP TRIGGER IF EXISTS update_email_queue_timestamp_trigger ON email_queue;
CREATE TRIGGER update_email_queue_timestamp_trigger
  BEFORE UPDATE ON email_queue
  FOR EACH ROW
  EXECUTE FUNCTION update_email_queue_timestamp();
