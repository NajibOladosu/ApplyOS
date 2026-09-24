-- Migration: Autofill profile -- canonical identity/contact data for the
--            Universal Autofill Engine (browser extension).
-- Created: 2026-09-19
--
-- Context: public.users holds only (id, email, name, avatar_url, timestamps)
--          plus email-verification columns (001_initial_schema.sql:5-12,
--          006_add_email_verification.sql:2-6). None of the ~44 fields an ATS
--          application form asks for have a home. This adds them.
--
-- Spec: extension/AUTOFILL_ARCHITECTURE.md sections 9.1 and 9.2.
--
-- Privacy: voluntary EEO self-identification lives in a SEPARATE table,
--          public.user_profile_eeo, with NO table privileges granted to
--          `authenticated`. The extension reads public.user_profiles directly
--          over PostgREST with .select('*'); if EEO columns lived there, one
--          such call would ship gender/race/veteran/disability into a content
--          script running inside a third-party ATS page. Access to EEO data is
--          via SECURITY DEFINER RPCs only.
--
-- Apply AFTER 032. Apply BEFORE 034.
--
-- NOTE: public.get_autofill_bundle() -- the single read the fill engine uses --
--       is defined in 034, because it also reads user_work_history and
--       user_education. Until 034 is applied, the engine reads
--       public.user_profiles directly and the EEO block is simply absent.

-- ============================================================================
-- ONE TRANSACTION, deliberately.
-- ============================================================================
-- Supabase's ALTER DEFAULT PRIVILEGES grants ALL on a newly created public table
-- to anon/authenticated/service_role at CREATE TABLE time. The REVOKE that takes
-- that away lands many statements later. Run outside a transaction, that gap is a
-- real window in which public.user_profile_eeo -- special-category data -- is
-- readable by any signed-in role. All DDL below is transactional in PostgreSQL,
-- so wrapping the file closes the window and makes a partial paste impossible:
-- either every statement applies or none does.
BEGIN;

-- ============================================================================
-- TABLE: user_profiles  (1:1 with public.users)
-- ============================================================================
-- DEVIATION from 032_create_application_contacts.sql:5-16: PRIMARY KEY is
-- user_id, not a surrogate `id` + user_id. This is a strict 1:1 table, nothing
-- references it, and PK=user_id makes upsert(onConflict:'user_id') the natural
-- write path instead of read-then-branch.
--
-- Structured columns where an ATS asks for the field as its own discrete input,
-- or where the fill engine branches on it. JSONB for everything else.

-- ---------------------------------------------------------------------------
-- Partial-run guard.
-- CREATE TABLE IF NOT EXISTS is a no-op when the table exists -- including when
-- it exists in a HALF-BUILT state from an earlier paste that errored partway.
-- In that case the columns never get added and the migration fails later with a
-- confusing error against a one-column table. (Verified by execution: applying
-- this file over a stripped user_profiles exits non-zero and leaves 1 column.)
-- Fail fast with an actionable message instead.
-- ---------------------------------------------------------------------------
DO $guard$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
              WHERE table_schema = 'public' AND table_name = 'user_profiles')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns
              WHERE table_schema = 'public' AND table_name = 'user_profiles'
                AND column_name = 'autofill_overrides')
  THEN
    RAISE EXCEPTION
      'public.user_profiles exists but is missing expected columns (autofill_overrides). A previous run of migration 033 was applied partially. Either DROP TABLE public.user_profiles CASCADE and re-run this file, or add the missing columns by hand. Refusing to continue against a half-built table.'
      USING ERRCODE = '42P16';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables
              WHERE table_schema = 'public' AND table_name = 'user_profile_eeo')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns
              WHERE table_schema = 'public' AND table_name = 'user_profile_eeo'
                AND column_name = 'autofill_eeo_enabled')
  THEN
    RAISE EXCEPTION
      'public.user_profile_eeo exists but is missing expected columns (autofill_eeo_enabled). A previous run of migration 033 was applied partially. Either DROP TABLE public.user_profile_eeo CASCADE and re-run this file, or add the missing columns by hand. Refusing to continue against a half-built table.'
      USING ERRCODE = '42P16';
  END IF;
END;
$guard$;

CREATE TABLE IF NOT EXISTS public.user_profiles (
  user_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,

  -- Name ---------------------------------------------------------------------
  legal_first_name         TEXT,
  legal_middle_name        TEXT,
  legal_last_name          TEXT,
  preferred_first_name     TEXT,
  name_suffix              TEXT,
  pronouns                 TEXT,

  -- Contact ------------------------------------------------------------------
  contact_email            TEXT,
  phone_country_code       TEXT,
  phone_number             TEXT,
  phone_type               TEXT CHECK (phone_type IN ('mobile', 'home', 'work')),

  -- Postal address -----------------------------------------------------------
  address_line1            TEXT,
  address_line2            TEXT,
  address_city             TEXT,
  address_state            TEXT,
  address_postal_code      TEXT,
  address_country          TEXT CHECK (address_country IS NULL OR address_country ~ '^[A-Z]{2}$'),

  -- Links --------------------------------------------------------------------
  linkedin_url             TEXT,
  github_url               TEXT,
  portfolio_url            TEXT,
  other_links              JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- Work authorization -------------------------------------------------------
  work_authorization_country TEXT CHECK (work_authorization_country IS NULL OR work_authorization_country ~ '^[A-Z]{2}$'),
  work_authorized            BOOLEAN,
  requires_sponsorship       BOOLEAN,
  visa_status                TEXT CHECK (visa_status IN (
    'citizen', 'permanent_resident', 'work_visa_h1b', 'work_visa_other',
    'student_opt', 'student_cpt', 'tn', 'e3', 'other', 'decline_to_state'
  )),
  additional_work_authorizations JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- Preferences --------------------------------------------------------------
  willing_to_relocate      BOOLEAN,
  remote_preference        TEXT CHECK (remote_preference IN ('onsite', 'hybrid', 'remote', 'flexible')),
  earliest_start_date      DATE,
  notice_period_days       INTEGER CHECK (notice_period_days IS NULL OR notice_period_days BETWEEN 0 AND 365),
  is_over_18               BOOLEAN,

  -- Compensation -------------------------------------------------------------
  desired_salary_min       NUMERIC(12, 2) CHECK (desired_salary_min IS NULL OR desired_salary_min >= 0),
  desired_salary_max       NUMERIC(12, 2) CHECK (desired_salary_max IS NULL OR desired_salary_max >= 0),
  desired_salary_currency  TEXT CHECK (desired_salary_currency IS NULL OR desired_salary_currency ~ '^[A-Z]{3}$'),
  desired_salary_period    TEXT CHECK (desired_salary_period IN ('hourly', 'monthly', 'annual')),

  -- Clearance / languages ----------------------------------------------------
  has_security_clearance   BOOLEAN,
  security_clearance_level TEXT,
  languages                JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- Autofill defaults --------------------------------------------------------
  default_how_did_you_hear         TEXT,
  default_resume_document_id       UUID REFERENCES public.documents(id) ON DELETE SET NULL,
  default_cover_letter_document_id UUID REFERENCES public.documents(id) ON DELETE SET NULL,

  -- Engine policy ------------------------------------------------------------
  autofill_enabled         BOOLEAN NOT NULL DEFAULT TRUE,
  autofill_never_submit    BOOLEAN NOT NULL DEFAULT TRUE,
  autofill_overrides       JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Provenance / import bookkeeping ------------------------------------------
  field_provenance         JSONB NOT NULL DEFAULT '{}'::jsonb,
  resume_import_document_id UUID REFERENCES public.documents(id) ON DELETE SET NULL,
  resume_imported_at       TIMESTAMPTZ,

  created_at               TIMESTAMPTZ DEFAULT now(),
  updated_at               TIMESTAMPTZ DEFAULT now(),

  CONSTRAINT user_profiles_salary_range_valid
    CHECK (desired_salary_min IS NULL
           OR desired_salary_max IS NULL
           OR desired_salary_min <= desired_salary_max),

  -- The four JSONB columns are objects/arrays, never scalars. Without this a
  -- client can write `"[]"` (a JSON string) and every reader that does
  -- jsonb_array_elements() or ->> breaks at runtime instead of at write time.
  CONSTRAINT user_profiles_other_links_is_array
    CHECK (jsonb_typeof(other_links) = 'array'),
  CONSTRAINT user_profiles_additional_work_auth_is_array
    CHECK (jsonb_typeof(additional_work_authorizations) = 'array'),
  CONSTRAINT user_profiles_languages_is_array
    CHECK (jsonb_typeof(languages) = 'array'),
  CONSTRAINT user_profiles_autofill_overrides_is_object
    CHECK (jsonb_typeof(autofill_overrides) = 'object'),
  CONSTRAINT user_profiles_field_provenance_is_object
    CHECK (jsonb_typeof(field_provenance) = 'object')
);

-- The PK covers the engine's own access path (always "my own row"), so no index
-- is added for reads. These three exist for a different reason: each is a
-- REFERENCES ... ON DELETE SET NULL, and Postgres does NOT auto-index the
-- referencing side. Without them every DELETE on public.documents sequentially
-- scans user_profiles, and Supabase's performance advisor reports
-- unindexed_foreign_keys -- the same lint 028_advisor_fixes.sql cleaned up.
-- This is not speculative indexing of the kind 029_remove_unused_indexes.sql
-- removed; these back a write path users actually hit (deleting a resume).
CREATE INDEX IF NOT EXISTS idx_user_profiles_default_resume_document_id
  ON public.user_profiles(default_resume_document_id)
  WHERE default_resume_document_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_user_profiles_default_cover_letter_document_id
  ON public.user_profiles(default_cover_letter_document_id)
  WHERE default_cover_letter_document_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_user_profiles_resume_import_document_id
  ON public.user_profiles(resume_import_document_id)
  WHERE resume_import_document_id IS NOT NULL;

COMMENT ON TABLE public.user_profiles IS
  'Canonical autofill profile, 1:1 with public.users. Read by the browser extension over PostgREST under RLS. Voluntary EEO self-identification is deliberately NOT here -- see public.user_profile_eeo.';

COMMENT ON COLUMN public.user_profiles.autofill_overrides IS
  'Per-user override of the GLOBAL mapping cache added in 035. Shape: { "<field_signature_hash>": "<canonical_profile_key>" | "__skip__" }. Kept on the profile row rather than in its own table because it is small and is always read together with the profile, and a table would add a join to the hottest read path in the engine.';

COMMENT ON COLUMN public.user_profiles.field_provenance IS
  'Per-canonical-key origin. Shape: { "<canonical_key>": { "source": "user"|"resume_import"|"ats_capture", "confidence": 0.0-1.0, "updated_at": "<iso8601>", "verified": bool } }. The resume importer refuses to overwrite any key whose source is "user" -- the user always wins.';

COMMENT ON COLUMN public.user_profiles.autofill_never_submit IS
  'Hard safety guard. When TRUE (the default) the fill engine may populate fields but must never click a submit control. The engine also enforces this client-side; this column exists so the guarantee is recorded server-side and is auditable.';

COMMENT ON COLUMN public.user_profiles.additional_work_authorizations IS
  'JSONB array of { country (ISO-3166-1 alpha-2), authorized: bool, requires_sponsorship: bool } for countries beyond work_authorization_country. A set, not a fixed field list, so it is not modelled as columns.';

COMMENT ON COLUMN public.user_profiles.other_links IS
  'JSONB array of { label, url }. Variable cardinality -- no ATS asks for "link #4" as a named field -- so it feeds the generic URL matcher rather than a column.';

COMMENT ON COLUMN public.user_profiles.languages IS
  'JSONB array of { language, proficiency }. Asked by a minority of ATS and never filtered on.';

COMMENT ON COLUMN public.user_profiles.is_over_18 IS
  'Stored in place of date_of_birth. Forms ask the age-gate question; DOB is high-value identity-theft PII with no additional autofill utility. If a form genuinely demands DOB, the user types it.';

COMMENT ON COLUMN public.user_profiles.desired_salary_period IS
  'Disambiguates desired_salary_min/max. A salary field is classified "compensation" by the engine and is never pre-accepted -- it always requires an explicit tick.';

-- ============================================================================
-- Row Level Security: user_profiles
-- ============================================================================
-- All four verbs are declared. NOTE: public.users itself has only SELECT
-- (001:94) and UPDATE (001:98) policies -- no INSERT, no DELETE -- which is why
-- app/api/account/delete/route.ts:63-66 silently matches zero rows. Not
-- repeating that omission here.
--
-- Policies use (select auth.uid()) per 018_optimize_rls_policies.sql, which is
-- the advisor-clean form. 032:37 reverted to bare auth.uid(); that is the
-- regression, not the convention.

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own autofill profile"   ON public.user_profiles;
DROP POLICY IF EXISTS "Users can create own autofill profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can update own autofill profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can delete own autofill profile" ON public.user_profiles;

CREATE POLICY "Users can view own autofill profile"
ON public.user_profiles
FOR SELECT
TO public
USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can create own autofill profile"
ON public.user_profiles
FOR INSERT
TO public
WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can update own autofill profile"
ON public.user_profiles
FOR UPDATE
TO public
USING ((select auth.uid()) = user_id)
WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can delete own autofill profile"
ON public.user_profiles
FOR DELETE
TO public
USING ((select auth.uid()) = user_id);

-- REVOKE before GRANT, deliberately. Supabase configures ALTER DEFAULT PRIVILEGES
-- so a newly created table in schema public is granted ALL to anon/authenticated/
-- service_role -- and ALL includes TRUNCATE, which is NOT filtered by RLS. Without
-- the REVOKE below, any signed-in role holding a connection could truncate every
-- user's profile row. Granting the four verbs afterwards is what we actually want.
-- (Verified by execution: a bare GRANT left authenticated holding TRUNCATE,
--  TRIGGER and REFERENCES inherited from the default privileges.)
REVOKE ALL ON public.user_profiles FROM PUBLIC;
REVOKE ALL ON public.user_profiles FROM anon;
REVOKE ALL ON public.user_profiles FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_profiles TO service_role;

-- ============================================================================
-- TABLE: user_profile_eeo  (1:1, separated on purpose -- see header)
-- ============================================================================
-- Plaintext, deliberately. Supabase already encrypts the volume at rest, and
-- the realistic threats here are a leaked SUPABASE_SERVICE_ROLE_KEY or a wrong
-- RLS policy -- in both cases the attacker holds the principal that would be
-- allowed to decrypt. Column encryption would cost the CHECK constraints that
-- keep the vocabulary closed, and direct readability, for no incremental
-- protection. What protects this data is: table separation, zero table
-- privileges for `authenticated`, RPC-only access, and consent defaulting OFF.

CREATE TABLE IF NOT EXISTS public.user_profile_eeo (
  user_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,

  jurisdiction TEXT NOT NULL DEFAULT 'US'
    CHECK (jurisdiction ~ '^[A-Z]{2}$'),

  gender TEXT CHECK (gender IN (
    'male', 'female', 'non_binary', 'decline_to_self_identify'
  )),
  hispanic_or_latino TEXT CHECK (hispanic_or_latino IN (
    'yes', 'no', 'decline_to_self_identify'
  )),
  race TEXT CHECK (race IN (
    'american_indian_or_alaska_native',
    'asian',
    'black_or_african_american',
    'native_hawaiian_or_other_pacific_islander',
    'white',
    'two_or_more_races',
    'decline_to_self_identify'
  )),
  veteran_status TEXT CHECK (veteran_status IN (
    'not_a_protected_veteran',
    'protected_veteran',
    'decline_to_self_identify'
  )),
  disability_status TEXT CHECK (disability_status IN (
    'yes', 'no', 'decline_to_self_identify'
  )),
  -- The US CC-305 form has prescribed wording and an expiry date printed on it.
  -- Recording which revision the user answered is what makes a stale answer
  -- detectable instead of silently re-used against a newer form.
  disability_form_version TEXT,

  -- Consent: default OFF. The engine must not see this block unless TRUE.
  autofill_eeo_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  consented_at         TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  -- Consent and its timestamp move together, in both directions.
  CONSTRAINT user_profile_eeo_consent_timestamped
    CHECK ((autofill_eeo_enabled AND consented_at IS NOT NULL)
           OR (NOT autofill_eeo_enabled AND consented_at IS NULL))
);

COMMENT ON TABLE public.user_profile_eeo IS
  'Voluntary EEO self-identification. Separated from user_profiles so that (a) a select(*) on the profile cannot leak it into a content script running on a third-party ATS page, (b) consent is revocable independently of the profile, (c) RLS and any future auditing are scoped to six columns rather than to a 45-column table. No table privileges are granted to `authenticated`: access is via get_eeo_for_editing() / upsert_eeo() / set_eeo_autofill_enabled() / delete_eeo() only.';

COMMENT ON COLUMN public.user_profile_eeo.gender IS
  'NULL means never answered -- the engine leaves the field blank and flags it for the human. ''decline_to_self_identify'' means the user answered "decline" -- the engine selects the decline option. These are different facts; do not COALESCE them together.';

COMMENT ON COLUMN public.user_profile_eeo.autofill_eeo_enabled IS
  'Explicit opt-in, default FALSE. public.get_autofill_bundle() (added in 034) omits the entire eeo block unless this is TRUE. The gate is in SQL because the extension holds the user JWT and talks to PostgREST directly -- a client-side check is not a gate.';

COMMENT ON COLUMN public.user_profile_eeo.jurisdiction IS
  'ISO-3166-1 alpha-2 country the category vocabulary belongs to. The values above are US EEO-1 / VEVRAA / CC-305. A non-US form asks different questions and must not reuse these values.';

COMMENT ON COLUMN public.user_profile_eeo.disability_status IS
  'US CC-305 voluntary self-identification. Never auto-accepted by the fill engine at any confidence, and only offered at all when autofill_eeo_enabled is TRUE.';

-- ============================================================================
-- Row Level Security: user_profile_eeo
-- ============================================================================
-- Belt and braces. The REVOKE below is the actual control -- `authenticated`
-- has no table privileges at all, so these policies are unreachable for that
-- role today. They exist so that if a GRANT is ever restored (by a later
-- migration, or by hand in the dashboard), the table does not silently become
-- world-readable in the same moment.

ALTER TABLE public.user_profile_eeo ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own EEO self-identification"   ON public.user_profile_eeo;
DROP POLICY IF EXISTS "Users can create own EEO self-identification" ON public.user_profile_eeo;
DROP POLICY IF EXISTS "Users can update own EEO self-identification" ON public.user_profile_eeo;
DROP POLICY IF EXISTS "Users can delete own EEO self-identification" ON public.user_profile_eeo;

CREATE POLICY "Users can view own EEO self-identification"
ON public.user_profile_eeo
FOR SELECT
TO public
USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can create own EEO self-identification"
ON public.user_profile_eeo
FOR INSERT
TO public
WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can update own EEO self-identification"
ON public.user_profile_eeo
FOR UPDATE
TO public
USING ((select auth.uid()) = user_id)
WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can delete own EEO self-identification"
ON public.user_profile_eeo
FOR DELETE
TO public
USING ((select auth.uid()) = user_id);

-- The real control. No direct table access for end users, in either direction.
-- A direct UPDATE would also need SELECT privilege on user_id (PostgREST filters
-- in the WHERE clause), so granting write-without-read is not actually possible
-- here -- which is why all access goes through the RPCs below.
REVOKE ALL ON public.user_profile_eeo FROM PUBLIC;
REVOKE ALL ON public.user_profile_eeo FROM anon;
REVOKE ALL ON public.user_profile_eeo FROM authenticated;
GRANT  SELECT, INSERT, UPDATE, DELETE ON public.user_profile_eeo TO service_role;

-- ============================================================================
-- updated_at triggers (fixed search_path per 014_fix_function_search_path_security.sql)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_user_profiles_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.update_user_profiles_updated_at() IS
'Trigger function to automatically update updated_at timestamp. Fixed search_path for security.';

DROP TRIGGER IF EXISTS trg_user_profiles_updated_at ON public.user_profiles;
CREATE TRIGGER trg_user_profiles_updated_at
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_user_profiles_updated_at();

-- ============================================================================
-- Write validation on user_profiles
-- ============================================================================
-- Two holes that RLS structurally cannot close.
--
-- 1. FOREIGN-KEY OWNERSHIP. Referential-integrity checks always bypass RLS, so
--    a plain FK accepts ANY existing documents.id. A user could PATCH their own
--    profile row -- permitted by the UPDATE policy, it is their row -- setting
--    default_resume_document_id to another user's document UUID. The fill engine
--    would then resolve and attach a stranger's resume. Storage RLS
--    (013_add_storage_bucket_policies.sql) would block the download, so the
--    practical result is a broken fill rather than a data leak, but the row is
--    still a cross-tenant reference and must not be storable.
--
-- 2. field_provenance KEY SPACE. Its keys are canonical profile keys, and the
--    PROFILE_KEYS union (extension/AUTOFILL_ARCHITECTURE.md section 3) includes
--    gender, race_ethnicity, hispanic_latino, veteran_status and
--    disability_status. Nothing stopped a writer from putting an EEO key -- or a
--    value alongside it -- into a JSONB column on the table that IS directly
--    readable by `authenticated`, which would reintroduce the exact leak the
--    table split exists to prevent.

CREATE OR REPLACE FUNCTION public.validate_user_profiles_write()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  eeo_keys TEXT[] := ARRAY[
    'gender', 'race_ethnicity', 'hispanic_latino', 'veteran_status',
    'disability_status', 'race', 'hispanic_or_latino', 'ethnicity',
    'veteran', 'disability'
  ];
  offending TEXT;
BEGIN
  -- 1. Every document reference must belong to the same user as the profile row.
  --    SECURITY DEFINER means RLS is bypassed here, so the ownership test is
  --    explicit rather than implied by row visibility.
  IF NEW.default_resume_document_id IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM public.documents d
                      WHERE d.id = NEW.default_resume_document_id
                        AND d.user_id = NEW.user_id) THEN
    RAISE EXCEPTION 'default_resume_document_id % does not belong to user %',
      NEW.default_resume_document_id, NEW.user_id USING ERRCODE = '42501';
  END IF;

  IF NEW.default_cover_letter_document_id IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM public.documents d
                      WHERE d.id = NEW.default_cover_letter_document_id
                        AND d.user_id = NEW.user_id) THEN
    RAISE EXCEPTION 'default_cover_letter_document_id % does not belong to user %',
      NEW.default_cover_letter_document_id, NEW.user_id USING ERRCODE = '42501';
  END IF;

  IF NEW.resume_import_document_id IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM public.documents d
                      WHERE d.id = NEW.resume_import_document_id
                        AND d.user_id = NEW.user_id) THEN
    RAISE EXCEPTION 'resume_import_document_id % does not belong to user %',
      NEW.resume_import_document_id, NEW.user_id USING ERRCODE = '42501';
  END IF;

  -- 2. field_provenance must not carry EEO keys. Provenance for EEO answers
  --    belongs with the answers, in public.user_profile_eeo.
  SELECT k INTO offending
    FROM jsonb_object_keys(NEW.field_provenance) AS k
   WHERE lower(k) = ANY (eeo_keys)
   LIMIT 1;

  IF offending IS NOT NULL THEN
    RAISE EXCEPTION 'field_provenance must not contain the EEO key %; EEO provenance belongs in public.user_profile_eeo', offending
      USING ERRCODE = '22023';
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.validate_user_profiles_write() IS
'Enforces two invariants RLS cannot: every documents FK on the row belongs to the same user (FK checks bypass RLS), and field_provenance carries no EEO keys (that column is on the directly-readable table). Fixed search_path for security.';

DROP TRIGGER IF EXISTS trg_user_profiles_validate ON public.user_profiles;
CREATE TRIGGER trg_user_profiles_validate
  BEFORE INSERT OR UPDATE ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_user_profiles_write();

CREATE OR REPLACE FUNCTION public.update_user_profile_eeo_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.update_user_profile_eeo_updated_at() IS
'Trigger function to automatically update updated_at timestamp. Fixed search_path for security.';

DROP TRIGGER IF EXISTS trg_user_profile_eeo_updated_at ON public.user_profile_eeo;
CREATE TRIGGER trg_user_profile_eeo_updated_at
  BEFORE UPDATE ON public.user_profile_eeo
  FOR EACH ROW
  EXECUTE FUNCTION public.update_user_profile_eeo_updated_at();

-- ============================================================================
-- EEO access RPCs -- the only path to public.user_profile_eeo for end users
-- ============================================================================
-- SECURITY DEFINER functions are granted EXECUTE to PUBLIC by default and no
-- existing migration in this repo revokes it (checked 014 and 017). Every
-- function below therefore REVOKEs from PUBLIC and anon explicitly, then grants
-- to authenticated only.
--
-- Each function scopes to (select auth.uid()) itself. SECURITY DEFINER bypasses
-- RLS, so that filter IS the access control -- it is not belt-and-braces here.

-- ---------------------------------------------------------------------------
-- Read, for the settings UI only. Returns the row regardless of consent: the
-- user is always allowed to see and edit their own answers. Consent governs
-- what the FILL ENGINE sees (get_autofill_bundle, 034), not what the owner sees.
-- Returns zero rows when the user has never answered.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_eeo_for_editing(p_user_id UUID DEFAULT NULL)
RETURNS SETOF public.user_profile_eeo
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  uid UUID := COALESCE(p_user_id, (select auth.uid()));
BEGIN
  -- Called by the service role (no JWT, so auth.uid() is NULL) with an explicit
  -- p_user_id that app/api/profile/eeo/route.ts has already verified against the
  -- session. Falls back to auth.uid() so the functions stay correct if EXECUTE is
  -- ever granted to authenticated again.
  IF uid IS NULL THEN
    RAISE EXCEPTION 'no subject: pass p_user_id or call with a JWT' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
    SELECT * FROM public.user_profile_eeo WHERE user_id = uid;
END;
$$;

COMMENT ON FUNCTION public.get_eeo_for_editing(UUID) IS
'Returns one user''s EEO self-identification row for the settings UI, or zero rows if never answered. Subject is p_user_id (service-role callers) or auth.uid(). SERVICE ROLE ONLY: `authenticated` has neither SELECT on the table nor EXECUTE on this function, so the browser extension cannot reach EEO data by any route. Fixed search_path for security.';

-- ---------------------------------------------------------------------------
-- Write. FULL REPLACE of the answer set, matching a settings form that posts
-- every field. NULL means "not answered" and is a legitimate value to write --
-- which is why this is not a partial-update function: a NULL parameter cannot
-- otherwise be distinguished from "leave this one alone".
--
-- Deliberately does NOT touch consent. Answering the questions and agreeing to
-- have them auto-filled are two separate acts; use set_eeo_autofill_enabled().
--
-- Vocabulary is validated by the table's CHECK constraints, which fire here --
-- an invalid value raises 23514 rather than being silently coerced.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.upsert_eeo(
  p_user_id                 UUID DEFAULT NULL,
  -- NULL, not 'US'. A client that omits this argument must not silently relocate
  -- the user's jurisdiction -- the conflict arm below keeps the stored value.
  p_jurisdiction            TEXT DEFAULT NULL,
  p_gender                  TEXT DEFAULT NULL,
  p_hispanic_or_latino      TEXT DEFAULT NULL,
  p_race                    TEXT DEFAULT NULL,
  p_veteran_status          TEXT DEFAULT NULL,
  p_disability_status       TEXT DEFAULT NULL,
  p_disability_form_version TEXT DEFAULT NULL
)
RETURNS SETOF public.user_profile_eeo
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  uid UUID := COALESCE(p_user_id, (select auth.uid()));
BEGIN
  -- Called by the service role (no JWT, so auth.uid() is NULL) with an explicit
  -- p_user_id that app/api/profile/eeo/route.ts has already verified against the
  -- session. Falls back to auth.uid() so the functions stay correct if EXECUTE is
  -- ever granted to authenticated again.
  IF uid IS NULL THEN
    RAISE EXCEPTION 'no subject: pass p_user_id or call with a JWT' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  INSERT INTO public.user_profile_eeo AS e (
    user_id, jurisdiction, gender, hispanic_or_latino, race,
    veteran_status, disability_status, disability_form_version
  )
  VALUES (
    uid, COALESCE(p_jurisdiction, 'US'), p_gender, p_hispanic_or_latino, p_race,
    p_veteran_status, p_disability_status, p_disability_form_version
  )
  ON CONFLICT (user_id) DO UPDATE SET
    -- p_jurisdiction directly, NOT EXCLUDED: EXCLUDED carries the COALESCEd
    -- insert value ('US'), which would clobber a stored non-US jurisdiction.
    jurisdiction            = COALESCE(p_jurisdiction, e.jurisdiction),
    gender                  = EXCLUDED.gender,
    hispanic_or_latino      = EXCLUDED.hispanic_or_latino,
    race                    = EXCLUDED.race,
    veteran_status          = EXCLUDED.veteran_status,
    disability_status       = EXCLUDED.disability_status,
    disability_form_version = EXCLUDED.disability_form_version
    -- autofill_eeo_enabled and consented_at are intentionally untouched.
  RETURNING e.*;
END;
$$;

COMMENT ON FUNCTION public.upsert_eeo(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) IS
'Full replace of the caller''s own EEO answers. NULL means "not answered" and is written as such. Does not change consent -- see set_eeo_autofill_enabled(). Fixed search_path for security.';

-- ---------------------------------------------------------------------------
-- Consent toggle. The single fact recording "they opted in / they opted out",
-- which is the reason this data has its own table at all. Withdrawal clears
-- consented_at, so a stale timestamp can never imply live consent.
-- Creates an answer-less row if the user consents before answering; that is
-- harmless (the engine finds NULLs and leaves those fields blank).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_eeo_autofill_enabled(p_enabled BOOLEAN, p_user_id UUID DEFAULT NULL)
RETURNS SETOF public.user_profile_eeo
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  uid UUID := COALESCE(p_user_id, (select auth.uid()));
BEGIN
  -- Called by the service role (no JWT, so auth.uid() is NULL) with an explicit
  -- p_user_id that app/api/profile/eeo/route.ts has already verified against the
  -- session. Falls back to auth.uid() so the functions stay correct if EXECUTE is
  -- ever granted to authenticated again.
  IF uid IS NULL THEN
    RAISE EXCEPTION 'no subject: pass p_user_id or call with a JWT' USING ERRCODE = '42501';
  END IF;
  IF p_enabled IS NULL THEN
    RAISE EXCEPTION 'p_enabled must not be null' USING ERRCODE = '22004';
  END IF;

  -- Withdrawing consent that was never granted is a no-op. Without this guard,
  -- a settings UI that posts the switch state on mount creates an empty
  -- special-category row for a user who never answered anything.
  IF NOT p_enabled AND NOT EXISTS (
    SELECT 1 FROM public.user_profile_eeo WHERE user_id = uid
  ) THEN
    RETURN;
  END IF;

  RETURN QUERY
  INSERT INTO public.user_profile_eeo AS e (user_id, autofill_eeo_enabled, consented_at)
  VALUES (uid, p_enabled, CASE WHEN p_enabled THEN now() ELSE NULL END)
  ON CONFLICT (user_id) DO UPDATE SET
    autofill_eeo_enabled = p_enabled,
    -- Preserve the original consent timestamp on a re-affirm; stamp it on a
    -- fresh opt-in; clear it on withdrawal.
    consented_at = CASE
      WHEN p_enabled THEN COALESCE(e.consented_at, now())
      ELSE NULL
    END
  RETURNING e.*;
END;
$$;

COMMENT ON FUNCTION public.set_eeo_autofill_enabled(BOOLEAN, UUID) IS
'Sets the caller''s EEO autofill consent and keeps consented_at in step (stamped on opt-in, preserved on re-affirm, cleared on withdrawal). Fixed search_path for security.';

-- ---------------------------------------------------------------------------
-- Hard delete. Withdrawing consent stops the engine; this erases the answers.
-- Both are offered because they are different requests.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.delete_eeo(p_user_id UUID DEFAULT NULL)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  uid UUID := (select auth.uid());
  n   INTEGER;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501';
  END IF;

  DELETE FROM public.user_profile_eeo WHERE user_id = uid;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n > 0;
END;
$$;

COMMENT ON FUNCTION public.delete_eeo(UUID) IS
'Permanently deletes the caller''s own EEO self-identification row. Returns TRUE if a row was removed. Fixed search_path for security.';

-- ---------------------------------------------------------------------------
-- EXECUTE privileges. Default is EXECUTE TO PUBLIC -- revoke before granting.
-- ---------------------------------------------------------------------------
-- These four are SERVICE_ROLE ONLY -- deliberately NOT granted to `authenticated`.
--
-- `authenticated` is the role the browser extension's JWT assumes. Granting it
-- EXECUTE would undo the table separation: one supabase.rpc('get_eeo_for_editing')
-- from a content script running inside a third-party ATS page would return all
-- four special-category attributes. The separation has to hold against the JWT
-- holder, not just against a careless .select('*').
--
-- The EEO settings UI therefore goes through app/api/profile/eeo/route.ts, which
-- authenticates the user server-side and calls these with the service role.
-- The fill engine never touches these: it receives EEO values only through the
-- consent-gated public.get_autofill_bundle() added in 034, which returns the eeo
-- block only when autofill_eeo_enabled is TRUE.
REVOKE EXECUTE ON FUNCTION public.get_eeo_for_editing(UUID)                                FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.upsert_eeo(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_eeo_autofill_enabled(BOOLEAN, UUID)                    FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.delete_eeo(UUID)                                         FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.get_eeo_for_editing(UUID)                                 TO service_role;
GRANT EXECUTE ON FUNCTION public.upsert_eeo(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT)  TO service_role;
GRANT EXECUTE ON FUNCTION public.set_eeo_autofill_enabled(BOOLEAN, UUID)                     TO service_role;
GRANT EXECUTE ON FUNCTION public.delete_eeo(UUID)                                          TO service_role;

-- ============================================================================
-- Backfill: one profile row per existing user
-- ============================================================================
-- NOT wired into public.handle_new_user(). That trigger is SECURITY DEFINER and
-- runs inside the signup transaction (001_initial_schema.sql, hardened in
-- 014:18-28); a failure there breaks account creation outright. New users get
-- their row from the service layer's upsert on first profile read instead.
--
-- The name split is crude on purpose and writes NO field_provenance entry, so
-- both name parts are treated as unverified and the profile UI prompts the user
-- to confirm them.
--
-- TWO BEHAVIOURS THAT LOOK LIKE BUGS AND ARE NOT:
--
-- (a) public.users.name and legal_first_name/legal_last_name diverge after this
--     runs, and nothing reconciles them. That is intended: users.name is the
--     DISPLAY name (app/profile/page.tsx:108 keeps writing it) and the legal_*
--     columns are the name that goes on a legal form. For many people those are
--     genuinely different strings, and silently syncing them would overwrite a
--     deliberate answer. The profile UI surfaces both.
--
-- (b) Re-applying this file re-creates a profile row for a user who deliberately
--     DELETED theirs (the DELETE policy above permits that). ON CONFLICT DO
--     NOTHING cannot distinguish "never had one" from "deleted it", because no
--     tombstone is kept. Accepted: the row is empty, carries no provenance, and
--     the user can delete it again. If that ever matters, add a
--     profile_deleted_at tombstone -- do not silently skip the backfill. Splitting on whitespace is lossy for multi-part surnames;
-- provenance is what stops a guess from being asserted as fact on a legal form.

-- Whitespace is normalized FIRST. Without it, a name stored as '  Ada  Lovelace  '
-- yields first_name = NULL (split_part returns the empty leading segment) and
-- last_name = the entire padded string, because '^\S+\s*' does not match a string
-- that begins with whitespace. Verified against: 'Ada Lovelace', 'Ada',
-- 'Ada King Lovelace', '  Ada  Lovelace  ', NULL, ''.
WITH normalized AS (
  SELECT
    u.id,
    u.email,
    NULLIF(btrim(regexp_replace(COALESCE(u.name, ''), '\s+', ' ', 'g')), '') AS full_name
  FROM public.users u
)
INSERT INTO public.user_profiles (user_id, contact_email, legal_first_name, legal_last_name)
SELECT
  n.id,
  n.email,
  split_part(n.full_name, ' ', 1),
  NULLIF(regexp_replace(n.full_name, '^\S+\s*', ''), '')
FROM normalized n
ON CONFLICT (user_id) DO NOTHING;

-- ============================================================================
-- VERIFICATION QUERIES (run after applying)
-- ============================================================================
-- 1. RLS enabled on both tables.
-- SELECT tablename, rowsecurity FROM pg_tables
--  WHERE schemaname = 'public' AND tablename IN ('user_profiles', 'user_profile_eeo');
-- Expect rowsecurity = true for both.
--
-- 2. Four policies per table.
-- SELECT tablename, policyname, cmd FROM pg_policies
--  WHERE schemaname = 'public' AND tablename IN ('user_profiles', 'user_profile_eeo')
--  ORDER BY tablename, cmd;
-- Expect 4 rows per table: SELECT / INSERT / UPDATE / DELETE.
--
-- 3. THE IMPORTANT ONE -- `authenticated` must have NO privilege on the EEO table.
--
-- Use has_table_privilege, NOT information_schema.role_table_grants. That view is
-- filtered by grantor visibility (its definition restricts to enabled_roles), and
-- `postgres` is not a member of `supabase_admin`. A privilege granted to
-- `authenticated` by supabase_admin -- which is what a dashboard table-editor
-- action or a support intervention produces -- is invisible to the view AND is a
-- grant postgres cannot revoke. The view would report zero rows while the
-- extension reads every EEO row. has_table_privilege has no such blind spot.
--
-- SELECT
--   has_table_privilege('authenticated', 'public.user_profile_eeo', 'SELECT') AS auth_select,
--   has_table_privilege('authenticated', 'public.user_profile_eeo', 'INSERT') AS auth_insert,
--   has_table_privilege('authenticated', 'public.user_profile_eeo', 'UPDATE') AS auth_update,
--   has_table_privilege('authenticated', 'public.user_profile_eeo', 'DELETE') AS auth_delete,
--   has_table_privilege('anon',          'public.user_profile_eeo', 'SELECT') AS anon_select;
-- EVERY column must be false. Any true means the extension's JWT can reach
-- special-category data and this migration has failed.
--
-- And the EEO RPCs, same reasoning:
-- SELECT
--   has_function_privilege('authenticated', 'public.get_eeo_for_editing(uuid)', 'EXECUTE')      AS f1,
--   has_function_privilege('authenticated', 'public.upsert_eeo(uuid,text,text,text,text,text,text,text)', 'EXECUTE') AS f2,
--   has_function_privilege('authenticated', 'public.set_eeo_autofill_enabled(boolean,uuid)', 'EXECUTE') AS f3,
--   has_function_privilege('authenticated', 'public.delete_eeo(uuid)', 'EXECUTE')               AS f4;
-- All four must be false.
--
-- Note also: REVOKE only removes grants made by the current role, and a grant it
-- cannot remove raises WARNING, not ERROR -- so the migration can report success
-- with the privilege still in place. That is precisely why this check asks the
-- privilege system directly rather than trusting the REVOKE to have worked.
--
-- 4. Profile table IS directly readable (the engine depends on it).
-- SELECT grantee, privilege_type FROM information_schema.role_table_grants
--  WHERE table_schema = 'public' AND table_name = 'user_profiles' AND grantee = 'authenticated';
-- Expect SELECT / INSERT / UPDATE / DELETE.
--
-- 5. Functions are SECURITY DEFINER with a pinned search_path.
-- SELECT p.proname, p.prosecdef, p.proconfig
--   FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
--  WHERE n.nspname = 'public'
--    AND p.proname IN ('update_user_profiles_updated_at', 'update_user_profile_eeo_updated_at',
--                      'get_eeo_for_editing', 'upsert_eeo', 'set_eeo_autofill_enabled', 'delete_eeo');
-- Expect prosecdef = true and proconfig = {"search_path=public, pg_catalog"} for all six.
--
-- 6. No EXECUTE on the EEO RPCs for PUBLIC, anon OR authenticated.
-- SELECT routine_name, grantee FROM information_schema.routine_privileges
--  WHERE routine_schema = 'public'
--    AND routine_name IN ('get_eeo_for_editing','upsert_eeo','set_eeo_autofill_enabled','delete_eeo')
--  ORDER BY routine_name, grantee;
-- Expect service_role (and the owner) ONLY. If `authenticated` appears, the
-- extension's JWT can read EEO data through the RPC and the table separation is
-- defeated -- see the note above these GRANTs.
--
-- 6b. THE DENY PATH, exercised rather than inspected. Every check above reads a
--     catalog; none proves a real request is refused. Run this as the role the
--     extension actually uses:
--
--     SET ROLE authenticated;
--     SET request.jwt.claim.sub = '<any user uuid>';
--     SELECT * FROM public.user_profile_eeo;            -- expect: permission denied for table
--     SELECT * FROM public.get_eeo_for_editing();       -- expect: permission denied for function
--     SELECT * FROM public.user_profiles;               -- expect: 0 rows or only your own
--     RESET ROLE;
--
--     "permission denied" is the correct outcome, NOT an empty result. The
--     profile UI must distinguish them: an empty array means "no answers yet",
--     an error means "this client is not allowed to ask".
--
-- 6c. Cross-tenant document reference is rejected (validate_user_profiles_write):
--     UPDATE public.user_profiles SET default_resume_document_id =
--       (SELECT id FROM public.documents WHERE user_id <> '<your uuid>' LIMIT 1)
--     WHERE user_id = '<your uuid>';
--     Expect: ERROR 42501 "does not belong to user".
--
-- 6d. field_provenance rejects EEO keys:
--     UPDATE public.user_profiles SET field_provenance = '{"gender":{"source":"user"}}'::jsonb
--     WHERE user_id = '<your uuid>';
--     Expect: ERROR 22023 "must not contain the EEO key gender".
--
-- 7. Backfill covered every user.
-- SELECT (SELECT count(*) FROM public.users)         AS users,
--        (SELECT count(*) FROM public.user_profiles) AS profiles;
-- The two counts must match.
--
-- 8. Consent invariant holds.
-- SELECT count(*) FROM public.user_profile_eeo
--  WHERE (autofill_eeo_enabled AND consented_at IS NULL)
--     OR (NOT autofill_eeo_enabled AND consented_at IS NOT NULL);
-- Expect 0.
--
-- 9. Re-running this migration is a no-op (idempotency check).
--    Apply the whole file a second time; expect no errors and unchanged counts.

COMMIT;

-- ============================================================================
-- POST-COMMIT NOTE
-- ============================================================================
-- If the transaction above aborted, NOTHING was applied -- fix the reported error
-- and paste the whole file again. Do not paste fragments; the privilege window
-- described at the top is exactly what the transaction exists to prevent.
