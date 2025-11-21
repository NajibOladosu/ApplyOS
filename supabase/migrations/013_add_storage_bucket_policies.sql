-- Migration: Create documents storage bucket and RLS policies
-- Created: 2025-11-21
--
-- This migration creates a secure storage bucket for user documents (PDFs, resumes, etc.)
-- with Row Level Security policies to ensure users can only access their own files.
--
-- IMPORTANT: This migration must be applied via Supabase SQL Editor, as storage
-- policies require special handling in Supabase's storage schema.

-- ============================================================================
-- CREATE STORAGE BUCKET (if not exists)
-- ============================================================================
-- Note: The bucket may already exist in production. This is idempotent.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'documents',
  'documents',
  false, -- NOT public - users must be authenticated
  10485760, -- 10MB file size limit (10 * 1024 * 1024 bytes)
  ARRAY[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'application/json'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'application/json'
  ];

-- ============================================================================
-- DROP EXISTING STORAGE POLICIES (to allow recreation)
-- ============================================================================
DROP POLICY IF EXISTS "Users can upload documents to their own folder" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their own documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own documents" ON storage.objects;

-- ============================================================================
-- CREATE STORAGE RLS POLICIES
-- ============================================================================
-- Storage objects are stored with paths like: {user_id}/{filename}
-- RLS policies check that auth.uid() matches the user_id in the path

-- INSERT: Users can upload files to their own folder only
CREATE POLICY "Users can upload documents to their own folder"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'documents'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- SELECT: Users can view/download their own documents only
CREATE POLICY "Users can view their own documents"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'documents'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- UPDATE: Users can update metadata of their own documents
CREATE POLICY "Users can update their own documents"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'documents'
  AND auth.uid()::text = (storage.foldername(name))[1]
)
WITH CHECK (
  bucket_id = 'documents'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- DELETE: Users can delete their own documents only
CREATE POLICY "Users can delete their own documents"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'documents'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- ============================================================================
-- GRANT SERVICE ROLE FULL ACCESS (for admin operations)
-- ============================================================================
-- Service role can access all documents (needed for cron jobs, admin operations)
CREATE POLICY "Service role has full access to documents"
ON storage.objects
FOR ALL
TO service_role
USING (bucket_id = 'documents')
WITH CHECK (bucket_id = 'documents');

-- ============================================================================
-- VERIFICATION QUERIES (run after applying)
-- ============================================================================
-- To verify bucket was created:
-- SELECT id, name, public, file_size_limit FROM storage.buckets WHERE id = 'documents';
--
-- To verify storage policies are correctly applied:
-- SELECT policyname, cmd FROM pg_policies
-- WHERE schemaname = 'storage' AND tablename = 'objects'
-- AND policyname LIKE '%documents%';
--
-- Expected output:
-- - "Users can upload documents to their own folder" | INSERT
-- - "Users can view their own documents" | SELECT
-- - "Users can update their own documents" | UPDATE
-- - "Users can delete their own documents" | DELETE
-- - "Service role has full access to documents" | ALL

-- ============================================================================
-- USAGE NOTES
-- ============================================================================
-- File paths in storage should follow this pattern:
-- {user_id}/{filename}
--
-- Example:
-- - Upload: user_id/resume.pdf
-- - Download URL: https://{project}.supabase.co/storage/v1/object/authenticated/documents/{user_id}/resume.pdf
--
-- Code example (TypeScript):
-- const { data, error } = await supabase.storage
--   .from('documents')
--   .upload(`${user.id}/${file.name}`, file);
--
-- Security guarantees:
-- - Users can ONLY access files in their own folder ({user_id}/)
-- - Users CANNOT list or access other users' folders
-- - All access requires authentication (bucket is NOT public)
-- - File size limited to 10MB per file
-- - Only allowed MIME types can be uploaded
