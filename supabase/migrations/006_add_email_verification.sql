-- Add email verification columns to users table
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS verification_token TEXT,
ADD COLUMN IF NOT EXISTS verification_token_expires_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS last_verification_email_sent TIMESTAMP WITH TIME ZONE;

-- Create index on verification_token for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_verification_token ON public.users(verification_token) WHERE verification_token IS NOT NULL;

-- Update the handle_new_user trigger to respect skip_profile_creation flag
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Only create profile if skip_profile_creation is not set to true in metadata
  IF (NEW.raw_user_meta_data->>'skip_profile_creation')::boolean IS NOT TRUE THEN
    INSERT INTO public.users (id, email, name, avatar_url, email_verified)
    VALUES (
      NEW.id,
      NEW.email,
      COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
      NEW.raw_user_meta_data->>'avatar_url',
      -- Mark OAuth users as verified (assume email verified by provider)
      CASE
        WHEN NEW.provider = 'google' THEN TRUE
        WHEN NEW.provider = 'github' THEN TRUE
        ELSE FALSE
      END
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
