-- Remove genuinely unused indexes identified by Performance Advisor
-- These indexes are not supported by any current application queries.

-- 1. Remove GIN index on 'extracted_text' (Full text search not implemented)
DROP INDEX IF EXISTS idx_documents_extracted_text_search;

-- 2. Remove unused index on 'notification_id' in email_queue
-- We link emails to notifications, but never query email_queue BY notification_id.
DROP INDEX IF EXISTS email_queue_notification_id_idx;
