-- Add company field to applications table
-- Migration: 011_add_company_field.sql
-- Description: Adds a company column to track the company/organization for each application

-- Add company column (nullable, as it's optional)
ALTER TABLE public.applications
ADD COLUMN company TEXT;

-- Add index for better query performance when filtering/sorting by company
CREATE INDEX idx_applications_company ON public.applications(company);

-- Add comment for documentation
COMMENT ON COLUMN public.applications.company IS 'The name of the company or organization for this application';
