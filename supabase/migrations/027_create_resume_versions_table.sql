-- Migration: Create resume_versions table for storing editor states
-- This enables versioning of resume edits per document/application

CREATE TABLE IF NOT EXISTS resume_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    application_id UUID REFERENCES applications(id) ON DELETE SET NULL,
    version_name TEXT NOT NULL DEFAULT 'Version 1',
    blocks JSONB NOT NULL DEFAULT '[]'::jsonb, -- The editor block state
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_resume_versions_user_id ON resume_versions(user_id);
CREATE INDEX IF NOT EXISTS idx_resume_versions_document_id ON resume_versions(document_id);
CREATE INDEX IF NOT EXISTS idx_resume_versions_application_id ON resume_versions(application_id);

-- Enable RLS
ALTER TABLE resume_versions ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only access their own versions
CREATE POLICY "Users can view their own resume versions"
    ON resume_versions FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own resume versions"
    ON resume_versions FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own resume versions"
    ON resume_versions FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own resume versions"
    ON resume_versions FOR DELETE
    USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_resume_versions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trigger_resume_versions_updated_at
    BEFORE UPDATE ON resume_versions
    FOR EACH ROW
    EXECUTE FUNCTION update_resume_versions_updated_at();
