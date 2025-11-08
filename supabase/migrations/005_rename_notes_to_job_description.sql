-- Rename notes column to job_description in applications table
ALTER TABLE public.applications
RENAME COLUMN notes TO job_description;
