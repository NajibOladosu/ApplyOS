-- Drop the automatic status change notification trigger
-- Notifications are now created explicitly via the API endpoint
-- This prevents duplicate notifications (automatic + API-triggered)

DROP TRIGGER IF EXISTS on_application_status_change ON public.applications;
