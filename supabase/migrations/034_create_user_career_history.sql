-- Migration: Career history -- itemised work and education entries for the
--            Universal Autofill Engine (browser extension).
-- Created: 2026-09-19
--
-- Context: Workday / Taleo / iCIMS all render work experience and education as
--          REPEATING widgets with discrete inputs per entry (employer, title,
--          from, to, "I currently work here"). Nothing in this repo can feed
--          them. documents.parsed_data cannot: ParsedDocument
--          (shared/infrastructure/ai.ts:341-376) is per-document, AI-derived,
--          never confirmed by the user, and its start_date/end_date are
--          free-text strings like "2020" (:346, :353).
--
-- Spec: extension/AUTOFILL_ARCHITECTURE.md sections 9.2 and 9.3.
--
-- Apply AFTER 033 (public.user_profiles and public.user_profile_eeo must exist;
-- public.get_autofill_bundle() below reads both). Apply BEFORE 035.
--
-- THE DATE-PRECISION PROBLEM is the reason these tables are not two DATE
-- columns. A resume says "2020". A user editing the profile says 2020-03. A
-- Workday month/year picker needs a month. Storing 2020-01-01 for all three
-- silently asserts January, and the engine cannot tell an asserted January from
-- a known one -- so it either fills a wrong month or refuses to fill any. The
-- fix is DATE (day pinned to 01 by convention) PLUS an explicit precision
-- column the engine reads before it touches a month dropdown.

-- ============================================================================
-- ONE TRANSACTION, deliberately -- same reasoning as 033.
-- ============================================================================
-- Supabase's ALTER DEFAULT PRIVILEGES grants ALL on a newly created table in
-- schema public to anon/authenticated/service_role at CREATE TABLE time, and
-- ALL includes TRUNCATE, which RLS does NOT filter. The REVOKE that takes that
-- away lands many statements later. Outside a transaction that gap is a real
-- window in which anon can truncate every user's employment history. All DDL
-- below is transactional in PostgreSQL, so wrapping the file closes the window
-- and makes a partial paste impossible.
BEGIN;

-- ---------------------------------------------------------------------------
-- Partial-run guard (033 precedent).
-- CREATE TABLE IF NOT EXISTS is a no-op when the table exists -- including when
-- it exists HALF-BUILT from an earlier paste that errored partway. The columns
-- then never get added and the migration fails much later with a confusing
-- error against a stub table. Fail fast with an actionable message.
-- The sentinel is a late column in each CREATE TABLE, not an early one.
-- ---------------------------------------------------------------------------
DO $guard$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
              WHERE table_schema = 'public' AND table_name = 'user_work_history')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns
              WHERE table_schema = 'public' AND table_name = 'user_work_history'
                AND column_name = 'start_date_precision')
  THEN
    RAISE EXCEPTION
      'public.user_work_history exists but is missing expected columns (start_date_precision). A previous run of migration 034 was applied partially. Either DROP TABLE public.user_work_history CASCADE and re-run this file, or add the missing columns by hand. Refusing to continue against a half-built table.'
      USING ERRCODE = '42P16';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables
              WHERE table_schema = 'public' AND table_name = 'user_education')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns
              WHERE table_schema = 'public' AND table_name = 'user_education'
                AND column_name = 'gpa_scale')
  THEN
    RAISE EXCEPTION
      'public.user_education exists but is missing expected columns (gpa_scale). A previous run of migration 034 was applied partially. Either DROP TABLE public.user_education CASCADE and re-run this file, or add the missing columns by hand. Refusing to continue against a half-built table.'
      USING ERRCODE = '42P16';
  END IF;

  -- 033 is a hard prerequisite: get_autofill_bundle() below reads user_profiles
  -- and user_profile_eeo. CREATE FUNCTION does not resolve table references at
  -- definition time, so without this check the missing dependency would surface
  -- as a runtime 42P01 inside the extension rather than here.
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables
                  WHERE table_schema = 'public' AND table_name = 'user_profiles')
     OR NOT EXISTS (SELECT 1 FROM information_schema.tables
                  WHERE table_schema = 'public' AND table_name = 'user_profile_eeo')
  THEN
    RAISE EXCEPTION
      'migration 033_create_user_profiles.sql has not been applied (public.user_profiles and/or public.user_profile_eeo is missing). Apply 033 first; public.get_autofill_bundle() defined below reads both tables.'
      USING ERRCODE = '42P01';
  END IF;
END;
$guard$;

-- ============================================================================
-- TABLE: user_work_history
-- ============================================================================
-- Surrogate `id` + `user_id`, per 032_create_application_contacts.sql:5-16.
-- The PK=user_id deviation in 033 was specific to strict 1:1 tables; these are
-- 1:N and ordered, so the repo's normal shape applies.
--
-- Column set is what the itemised widgets demand, nothing more. Each column
-- whose existence rests on external ATS knowledge rather than on something in
-- this repo is marked UNVERIFIED and is listed in
-- extension/AUTOFILL_ARCHITECTURE.md section 16; verify by capturing one live
-- posting per ATS into shared/autofill/__fixtures__/.

CREATE TABLE IF NOT EXISTS public.user_work_history (
  id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  -- Display/fill order, owned by the user. Not derived from dates: a person
  -- reasonably puts the role most relevant to THIS application first, and a
  -- Workday widget fills row 1 from element 1.
  sort_order INTEGER NOT NULL DEFAULT 0,

  -- Identity of the entry -------------------------------------------------
  company   TEXT NOT NULL,
  job_title TEXT,

  -- UNVERIFIED (external ATS knowledge): that Workday's Work Experience widget
  -- splits employer location into city / state / country rather than one line.
  location_city    TEXT,
  location_state   TEXT,
  location_country TEXT,

  -- UNVERIFIED: that Workday exposes an "I currently work here" checkbox.
  -- Separate from end_date IS NULL because a NULL end date is also what an
  -- unfinished import looks like; this column is an assertion, not an absence.
  is_current BOOLEAN NOT NULL DEFAULT FALSE,

  -- Dates, with precision -------------------------------------------------
  -- Day is pinned to 01 by convention (enforced below). The engine reads
  -- precision to decide what it may populate:
  --   'day'   -> fill day, month and year segments
  --   'month' -> fill month and year; leave a day segment for the human
  --   'year'  -> fill year only
  start_date           DATE,
  start_date_precision TEXT CHECK (start_date_precision IN ('year', 'month', 'day')),
  end_date             DATE,
  end_date_precision   TEXT CHECK (end_date_precision IN ('year', 'month', 'day')),

  -- Free text -------------------------------------------------------------
  description TEXT,

  -- UNVERIFIED: that Taleo / iCIMS ask "reason for leaving" and "may we contact
  -- this employer". may_contact_employer is the user's own answer about their
  -- own employer, so it carries no third-party PII.
  reason_for_leaving   TEXT,
  may_contact_employer BOOLEAN,

  -- Provenance ------------------------------------------------------------
  -- Mirrors user_profiles.field_provenance (033), one row at a time rather than
  -- one key at a time. verified_at IS NOT NULL is what the resume-import
  -- reconciler checks before it will overwrite the row.
  source            TEXT NOT NULL DEFAULT 'user'
                    CHECK (source IN ('user', 'resume_import', 'ats_capture')),
  source_document_id UUID REFERENCES public.documents(id) ON DELETE SET NULL,
  source_confidence  NUMERIC(3, 2),
  verified_at        TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  CONSTRAINT user_work_history_sort_order_nonneg
    CHECK (sort_order >= 0),

  -- A row whose employer is blank cannot fill any widget on any ATS; it is a
  -- half-saved form, not data. Rejected at write time rather than filtered at
  -- every read.
  CONSTRAINT user_work_history_company_not_blank
    CHECK (btrim(company) <> ''),

  -- THE POINT OF THIS TABLE. A DATE without its precision is an unlabelled
  -- guess, and an orphan precision describes nothing. Both or neither.
  CONSTRAINT user_work_history_start_precision_paired
    CHECK ((start_date IS NULL) = (start_date_precision IS NULL)),
  CONSTRAINT user_work_history_end_precision_paired
    CHECK ((end_date IS NULL) = (end_date_precision IS NULL)),

  -- The day = 01 convention, enforced rather than documented. Without this a
  -- writer can store 2020-06-17 with precision 'year', and a later reader that
  -- trusts precision emits "2020-01" while a reader that trusts the date emits
  -- "June 2020". 'year' additionally pins the month, because under 'year' the
  -- month is exactly the thing that is not known.
  CONSTRAINT user_work_history_start_day_convention
    CHECK (start_date IS NULL
           OR start_date_precision = 'day'
           OR (EXTRACT(DAY FROM start_date) = 1
               AND (start_date_precision = 'month'
                    OR EXTRACT(MONTH FROM start_date) = 1))),
  CONSTRAINT user_work_history_end_day_convention
    CHECK (end_date IS NULL
           OR end_date_precision = 'day'
           OR (EXTRACT(DAY FROM end_date) = 1
               AND (end_date_precision = 'month'
                    OR EXTRACT(MONTH FROM end_date) = 1))),

  CONSTRAINT user_work_history_dates_ordered
    CHECK (start_date IS NULL OR end_date IS NULL OR end_date >= start_date),

  -- "I currently work here" and an end date are contradictory, and the engine
  -- would tick the checkbox AND fill the To date on the same Workday row.
  CONSTRAINT user_work_history_current_has_no_end
    CHECK (NOT is_current OR end_date IS NULL),

  CONSTRAINT user_work_history_source_confidence_range
    CHECK (source_confidence IS NULL OR source_confidence BETWEEN 0 AND 1),

  -- An imported row with no document behind it cannot be traced back to what
  -- produced it, which is the whole value of source = 'resume_import'.
  CONSTRAINT user_work_history_import_has_document
    CHECK (source <> 'resume_import' OR source_document_id IS NOT NULL)
);

-- Serves both purposes: user_id is a REFERENCES column and Postgres does NOT
-- auto-index the referencing side, so without an index every DELETE on
-- public.users sequentially scans this table and Supabase's advisor reports
-- unindexed_foreign_keys -- the lint 028_advisor_fixes.sql:34 cleaned up.
-- Leading with user_id and trailing with sort_order also covers
-- get_autofill_bundle()'s exact access path (own rows, in order), so this is
-- one index doing two jobs rather than speculative indexing of the kind
-- 029_remove_unused_indexes.sql removed.
CREATE INDEX IF NOT EXISTS idx_user_work_history_user_id_sort_order
  ON public.user_work_history(user_id, sort_order);

-- The other FK on the referencing side. Partial, because most rows are typed by
-- the user and carry no document; the index only has to make DELETE on
-- public.documents cheap.
CREATE INDEX IF NOT EXISTS idx_user_work_history_source_document_id
  ON public.user_work_history(source_document_id)
  WHERE source_document_id IS NOT NULL;

COMMENT ON TABLE public.user_work_history IS
  'Itemised employment entries for the autofill engine, 1:N with public.users and explicitly ordered by sort_order. Exists because Workday / Taleo / iCIMS render work experience as a repeating widget with discrete inputs per entry, and documents.parsed_data (per-document, AI-derived, free-text dates) cannot feed one.';

COMMENT ON COLUMN public.user_work_history.start_date_precision IS
  'How much of start_date is actually known: ''year'' (day and month are the 01-01 convention, not facts), ''month'' (day is the 01 convention), ''day'' (all three are facts). The fill engine reads this before populating a month dropdown; without it, a resume''s "2020" is indistinguishable from a user''s "January 2020" and the engine asserts a month nobody supplied.';

COMMENT ON COLUMN public.user_work_history.is_current IS
  'The user''s assertion that they still hold this role, which is what an ATS "I currently work here" checkbox asks. Not inferred from end_date IS NULL: a half-finished import also has no end date, and ticking a checkbox on that basis puts a claim on a legal form that the user never made.';

COMMENT ON COLUMN public.user_work_history.verified_at IS
  'When the user last confirmed this row in the profile UI. The resume importer refuses to overwrite any row where this is non-NULL -- the user always wins, mirroring the field_provenance rule in 033. Deliberately NOT enforced by a trigger: an owner edit and an importer write are both plain UPDATEs from the same role, and the only thing that distinguishes them is the source value the writer stamps, so a database-side rule would reject legitimate owner edits that leave source untouched.';

COMMENT ON COLUMN public.user_work_history.source_confidence IS
  'Model confidence 0.00-1.00 for source = ''resume_import'' rows, NULL otherwise. Lets the profile UI mark an entry "imported -- please confirm" instead of presenting a guess as fact.';

COMMENT ON COLUMN public.user_work_history.may_contact_employer IS
  'UNVERIFIED (external ATS knowledge): that Taleo / iCIMS ask this per employer. The user''s own answer about their own employer -- no third-party contact details are stored here; see the note on supervisor fields in this migration.';

-- Deliberately excluded from this table, with reasons:
--
-- * supervisor_name / supervisor_phone / supervisor_email -- third-party PII
--   about someone who has not consented and is not a user, carrying its own
--   retention obligation. 033 deferred `references` for exactly this reason. If
--   it ships it ships as its own table with its own opt-in, not as columns on
--   the autofill profile. Forms that demand it are surfaced as "needs you".
-- * starting_salary / ending_salary -- compensation history. Illegal for an
--   employer to ask in several US states, classified 'compensation' by the
--   engine (which never pre-accepts it anyway), and not required by the
--   Workday widget this table exists to feed.
-- * employment_type -- no itemised widget in section 4.5 or 4.6 asks for it.
--   Adding a column on the chance an ATS wants it is how a schema rots.

-- ============================================================================
-- TABLE: user_education
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.user_education (
  id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  sort_order INTEGER NOT NULL DEFAULT 0,

  school TEXT NOT NULL,

  -- Two columns, not one, because they answer different widgets. `degree` is
  -- the string as the user would write it ("B.S.", "Bachelor of Science with
  -- Honours") and feeds a free-text input or a fuzzy option match.
  -- `degree_level` is a closed vocabulary the engine can branch on to pick an
  -- option out of a Workday degree dropdown, where "B.S." matches nothing.
  degree       TEXT,
  degree_level TEXT CHECK (degree_level IN (
    'high_school', 'associate', 'bachelor', 'master',
    'doctorate', 'professional', 'certificate', 'other'
  )),
  field_of_study TEXT,

  -- "Currently attending". Same reasoning as user_work_history.is_current.
  is_current BOOLEAN NOT NULL DEFAULT FALSE,

  start_date           DATE,
  start_date_precision TEXT CHECK (start_date_precision IN ('year', 'month', 'day')),
  end_date             DATE,
  end_date_precision   TEXT CHECK (end_date_precision IN ('year', 'month', 'day')),

  -- UNVERIFIED (external ATS knowledge): that Workday's education widget asks
  -- for GPA alongside an explicit scale. Stored as a pair because "3.8" is
  -- meaningless without it -- a 3.8/5.0 filled into a form that assumes /4.0
  -- misrepresents the user upward on a document they sign.
  gpa       NUMERIC(5, 2),
  gpa_scale NUMERIC(5, 2),

  source            TEXT NOT NULL DEFAULT 'user'
                    CHECK (source IN ('user', 'resume_import', 'ats_capture')),
  source_document_id UUID REFERENCES public.documents(id) ON DELETE SET NULL,
  source_confidence  NUMERIC(3, 2),
  verified_at        TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  CONSTRAINT user_education_sort_order_nonneg
    CHECK (sort_order >= 0),

  CONSTRAINT user_education_school_not_blank
    CHECK (btrim(school) <> ''),

  CONSTRAINT user_education_start_precision_paired
    CHECK ((start_date IS NULL) = (start_date_precision IS NULL)),
  CONSTRAINT user_education_end_precision_paired
    CHECK ((end_date IS NULL) = (end_date_precision IS NULL)),

  CONSTRAINT user_education_start_day_convention
    CHECK (start_date IS NULL
           OR start_date_precision = 'day'
           OR (EXTRACT(DAY FROM start_date) = 1
               AND (start_date_precision = 'month'
                    OR EXTRACT(MONTH FROM start_date) = 1))),
  CONSTRAINT user_education_end_day_convention
    CHECK (end_date IS NULL
           OR end_date_precision = 'day'
           OR (EXTRACT(DAY FROM end_date) = 1
               AND (end_date_precision = 'month'
                    OR EXTRACT(MONTH FROM end_date) = 1))),

  CONSTRAINT user_education_dates_ordered
    CHECK (start_date IS NULL OR end_date IS NULL OR end_date >= start_date),

  -- An expected graduation date is a real thing a form asks for, so unlike
  -- user_work_history a currently-enrolled row MAY carry a future end_date.
  -- What it must not carry is a completed one.
  CONSTRAINT user_education_current_end_not_past
    CHECK (NOT is_current OR end_date IS NULL OR end_date >= CURRENT_DATE),

  CONSTRAINT user_education_gpa_paired
    CHECK ((gpa IS NULL) = (gpa_scale IS NULL)),
  CONSTRAINT user_education_gpa_scale_positive
    CHECK (gpa_scale IS NULL OR gpa_scale > 0),
  CONSTRAINT user_education_gpa_in_range
    CHECK (gpa IS NULL OR (gpa >= 0 AND gpa <= gpa_scale)),

  CONSTRAINT user_education_source_confidence_range
    CHECK (source_confidence IS NULL OR source_confidence BETWEEN 0 AND 1),

  CONSTRAINT user_education_import_has_document
    CHECK (source <> 'resume_import' OR source_document_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_user_education_user_id_sort_order
  ON public.user_education(user_id, sort_order);

CREATE INDEX IF NOT EXISTS idx_user_education_source_document_id
  ON public.user_education(source_document_id)
  WHERE source_document_id IS NOT NULL;

COMMENT ON TABLE public.user_education IS
  'Itemised education entries for the autofill engine, 1:N with public.users and explicitly ordered by sort_order. Carries no location columns, unlike user_work_history: the Workday education widget identifies a school by name and offers no city/state/country inputs, so those columns would never be read.';

COMMENT ON COLUMN public.user_education.degree_level IS
  'Closed vocabulary the fill engine branches on to select an option from a degree dropdown. The free-text `degree` column holds what the user would write ("B.S."), which matches no dropdown option; this column is what makes the option selectable.';

COMMENT ON COLUMN public.user_education.gpa_scale IS
  'The denominator the GPA was earned against (4.00, 5.00, 10.00, 100.00, ...). Stored with the GPA and constrained to move with it: filling 3.8 into a form that assumes /4.0 when the value was 3.8/5.0 overstates the user on a document they sign.';

COMMENT ON COLUMN public.user_education.is_current IS
  'Currently enrolled. Unlike user_work_history.is_current this permits a non-past end_date, because "expected graduation" is a question forms genuinely ask.';

COMMENT ON COLUMN public.user_education.start_date_precision IS
  'How much of start_date is actually known -- see public.user_work_history.start_date_precision.';

-- ============================================================================
-- Row Level Security
-- ============================================================================
-- Four policies per table, all four verbs declared, per 033. Policies use
-- (select auth.uid()) per 018_optimize_rls_policies.sql, which is the
-- advisor-clean form; 032:37 reverted to bare auth.uid() and that is the
-- regression, not the convention.

ALTER TABLE public.user_work_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own work history"   ON public.user_work_history;
DROP POLICY IF EXISTS "Users can create own work history" ON public.user_work_history;
DROP POLICY IF EXISTS "Users can update own work history" ON public.user_work_history;
DROP POLICY IF EXISTS "Users can delete own work history" ON public.user_work_history;

CREATE POLICY "Users can view own work history"
ON public.user_work_history
FOR SELECT
TO public
USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can create own work history"
ON public.user_work_history
FOR INSERT
TO public
WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can update own work history"
ON public.user_work_history
FOR UPDATE
TO public
USING ((select auth.uid()) = user_id)
WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can delete own work history"
ON public.user_work_history
FOR DELETE
TO public
USING ((select auth.uid()) = user_id);

ALTER TABLE public.user_education ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own education"   ON public.user_education;
DROP POLICY IF EXISTS "Users can create own education" ON public.user_education;
DROP POLICY IF EXISTS "Users can update own education" ON public.user_education;
DROP POLICY IF EXISTS "Users can delete own education" ON public.user_education;

CREATE POLICY "Users can view own education"
ON public.user_education
FOR SELECT
TO public
USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can create own education"
ON public.user_education
FOR INSERT
TO public
WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can update own education"
ON public.user_education
FOR UPDATE
TO public
USING ((select auth.uid()) = user_id)
WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can delete own education"
ON public.user_education
FOR DELETE
TO public
USING ((select auth.uid()) = user_id);

-- REVOKE before GRANT, deliberately. Supabase's ALTER DEFAULT PRIVILEGES grants
-- ALL on a new public table to anon/authenticated/service_role at CREATE TABLE
-- time, and ALL includes TRUNCATE -- which is NOT filtered by RLS. A bare GRANT
-- would leave `authenticated` holding TRUNCATE, TRIGGER and REFERENCES
-- inherited from those defaults (verified by execution while applying 033), so
-- any signed-in role could empty every user's employment history. Revoke the
-- inherited set first, then grant exactly the four verbs.
REVOKE ALL ON public.user_work_history FROM anon;
REVOKE ALL ON public.user_work_history FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_work_history TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_work_history TO service_role;

REVOKE ALL ON public.user_education FROM anon;
REVOKE ALL ON public.user_education FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_education TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_education TO service_role;

-- ============================================================================
-- Triggers
-- ============================================================================
-- Fixed search_path on every function per
-- 014_fix_function_search_path_security.sql.
--
-- One function per concern, two triggers each. 033 defined a separate
-- updated_at function per table because its two tables were separate concerns
-- in separate sections; here both tables carry the same columns for the same
-- reason, and a second byte-identical copy would be a second thing to keep in
-- step for no gain.

CREATE OR REPLACE FUNCTION public.update_user_career_updated_at()
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

COMMENT ON FUNCTION public.update_user_career_updated_at() IS
'Trigger function to automatically update updated_at timestamp on user_work_history and user_education. Fixed search_path for security.';

DROP TRIGGER IF EXISTS trg_user_work_history_updated_at ON public.user_work_history;
CREATE TRIGGER trg_user_work_history_updated_at
  BEFORE UPDATE ON public.user_work_history
  FOR EACH ROW
  EXECUTE FUNCTION public.update_user_career_updated_at();

DROP TRIGGER IF EXISTS trg_user_education_updated_at ON public.user_education;
CREATE TRIGGER trg_user_education_updated_at
  BEFORE UPDATE ON public.user_education
  FOR EACH ROW
  EXECUTE FUNCTION public.update_user_career_updated_at();

-- ---------------------------------------------------------------------------
-- Cross-tenant FK guard -- the same hole validate_user_profiles_write() closes
-- in 033 for user_profiles.default_resume_document_id.
--
-- Referential-integrity checks ALWAYS bypass RLS, so a plain REFERENCES accepts
-- any existing documents.id. A user may INSERT into their own work history --
-- the INSERT policy permits it, user_id is theirs -- while pointing
-- source_document_id at a stranger's document UUID. The row then claims another
-- tenant's resume as its provenance, and any UI that joins through to
-- documents.file_name leaks that file name. Storage RLS
-- (013_add_storage_bucket_policies.sql) blocks the download, but the reference
-- itself must not be storable.
--
-- One function for both tables: the check is over (user_id, source_document_id),
-- which both carry under the same names, so TG_TABLE_NAME is enough to make the
-- error message specific.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.validate_user_career_row_write()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  -- SECURITY DEFINER bypasses RLS here, so the ownership test is explicit
  -- rather than implied by row visibility.
  IF NEW.source_document_id IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM public.documents d
                      WHERE d.id = NEW.source_document_id
                        AND d.user_id = NEW.user_id) THEN
    RAISE EXCEPTION
      'source_document_id % does not belong to user % (public.%)',
      NEW.source_document_id, NEW.user_id, TG_TABLE_NAME
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.validate_user_career_row_write() IS
'Enforces the one invariant RLS structurally cannot on user_work_history / user_education: source_document_id must reference a document owned by the same user, because foreign-key checks bypass RLS. Fixed search_path for security.';

DROP TRIGGER IF EXISTS trg_user_work_history_validate ON public.user_work_history;
CREATE TRIGGER trg_user_work_history_validate
  BEFORE INSERT OR UPDATE ON public.user_work_history
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_user_career_row_write();

DROP TRIGGER IF EXISTS trg_user_education_validate ON public.user_education;
CREATE TRIGGER trg_user_education_validate
  BEFORE INSERT OR UPDATE ON public.user_education
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_user_career_row_write();

-- ============================================================================
-- public.get_autofill_bundle() -- the single read the fill engine performs
-- ============================================================================
-- Lives in 034 rather than 033 because it reads the two tables created above.
--
-- THE CONSENT GATE IS THE POINT. The `eeo` block is returned only when
-- user_profile_eeo.autofill_eeo_enabled IS TRUE, and that test is here, in SQL.
-- The extension holds the user's own JWT and talks to PostgREST directly
-- (extension/src/.../supabase-client.ts:10-37), so a check written in the
-- service worker is a suggestion, not a gate -- the same JWT can issue the
-- ungated request by hand. What makes the gate real is that `authenticated` has
-- no table privilege on public.user_profile_eeo at all (033) and no EXECUTE on
-- the four EEO edit RPCs, so this function is the only route by which an EEO
-- value can reach the extension, and it applies the filter itself.
--
-- NO p_user_id PARAMETER, deliberately -- and this is the one place that rule
-- differs from 033's EEO RPCs. Those are granted to service_role only, so an
-- explicit subject is safe: only trusted server code can pass one. This one is
-- granted to `authenticated`, which is the role the extension's JWT assumes.
-- A p_user_id argument here would let any signed-in user read any other user's
-- entire profile, work history, education and consented EEO answers with one
-- rpc() call. The subject is (select auth.uid()) and nothing else.
--
-- VOLATILE (the default), not STABLE, also deliberately. PostgREST routes
-- STABLE and IMMUTABLE functions to GET as well as POST; a GET puts the call in
-- a URL, where proxies and browser history may retain it. This function returns
-- the user's full identity payload in the response body, so POST-only is the
-- right shape even though the body is read-only.
--
-- Returns a complete object even when the user has no user_profiles row yet --
-- a new account before the service layer's first upsert, or a user who
-- exercised the DELETE policy 033 declares. A single top-level
-- `SELECT ... FROM user_profiles` (as sketched in section 9.2) yields NULL for
-- the WHOLE bundle in that case, silently hiding work history and education
-- that do exist, and the extension would read `bundle.profile` off null.

CREATE OR REPLACE FUNCTION public.get_autofill_bundle()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  uid    UUID := (select auth.uid());
  result JSONB;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501';
  END IF;

  SELECT jsonb_build_object(
    -- autofill_overrides is lifted to its own top-level key because the engine
    -- consults it per field during resolution, not as part of the profile.
    'profile', COALESCE(
      (SELECT to_jsonb(p) - 'autofill_overrides'
         FROM public.user_profiles p WHERE p.user_id = uid),
      'null'::jsonb),

    'overrides', COALESCE(
      (SELECT p.autofill_overrides
         FROM public.user_profiles p WHERE p.user_id = uid),
      '{}'::jsonb),

    -- sort_order is the user's own ordering and is not unique, so the tiebreak
    -- is explicit. Without it, two rows sharing a sort_order come back in
    -- whatever order the scan produced, and the same bundle fills a Workday
    -- repeater differently on two consecutive runs -- which breaks the
    -- idempotency the engine relies on (section 7.3).
    'work', COALESCE(
      (SELECT jsonb_agg(to_jsonb(w)
              ORDER BY w.sort_order, w.start_date DESC NULLS LAST, w.id)
         FROM public.user_work_history w WHERE w.user_id = uid),
      '[]'::jsonb),

    'education', COALESCE(
      (SELECT jsonb_agg(to_jsonb(e)
              ORDER BY e.sort_order, e.end_date DESC NULLS LAST, e.id)
         FROM public.user_education e WHERE e.user_id = uid),
      '[]'::jsonb),

    -- THE GATE. `IS TRUE` rather than a bare boolean so the filter still holds
    -- if the NOT NULL on autofill_eeo_enabled is ever relaxed -- a NULL there
    -- must mean "no consent", never "unknown, pass it through".
    'eeo', COALESCE(
      (SELECT to_jsonb(x)
         FROM public.user_profile_eeo x
        WHERE x.user_id = uid AND x.autofill_eeo_enabled IS TRUE),
      'null'::jsonb)
  ) INTO result;

  RETURN result;
END;
$$;

COMMENT ON FUNCTION public.get_autofill_bundle() IS
'The fill engine''s single read: { profile, overrides, work[], education[], eeo }. Subject is auth.uid() only -- there is deliberately no p_user_id parameter, because unlike 033''s service-role-only EEO RPCs this function is granted to `authenticated`, and a subject argument would make it a cross-tenant read. The eeo block is omitted (JSON null) unless user_profile_eeo.autofill_eeo_enabled IS TRUE; that gate is enforced here because the extension holds the user JWT and can call PostgREST directly, so a client-side check is not a gate. Returns a complete object even when the user has no profile row. Fixed search_path for security.';

-- SECURITY DEFINER functions are granted EXECUTE to PUBLIC by default and no
-- migration in this repo revokes it (checked 014 and 017), so revoke before
-- granting. service_role is not granted: it holds no JWT, auth.uid() is NULL
-- for it, and every call would raise 42501 -- granting would imply a server-side
-- path that does not exist. Server code reads the tables directly.
REVOKE EXECUTE ON FUNCTION public.get_autofill_bundle() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.get_autofill_bundle() TO authenticated;

-- ============================================================================
-- VERIFICATION QUERIES (run after applying)
-- ============================================================================
-- 1. RLS enabled on both tables.
-- SELECT tablename, rowsecurity FROM pg_tables
--  WHERE schemaname = 'public' AND tablename IN ('user_work_history', 'user_education');
-- Expect rowsecurity = true for both.
--
-- 2. Four policies per table.
-- SELECT tablename, policyname, cmd FROM pg_policies
--  WHERE schemaname = 'public' AND tablename IN ('user_work_history', 'user_education')
--  ORDER BY tablename, cmd;
-- Expect 4 rows per table: SELECT / INSERT / UPDATE / DELETE.
--
-- 3. `authenticated` holds exactly the four verbs -- no TRUNCATE.
-- SELECT table_name, grantee, privilege_type FROM information_schema.role_table_grants
--  WHERE table_schema = 'public'
--    AND table_name IN ('user_work_history', 'user_education')
--    AND grantee IN ('anon', 'authenticated')
--  ORDER BY table_name, grantee, privilege_type;
-- Expect SELECT / INSERT / UPDATE / DELETE for `authenticated` and ZERO rows
-- for `anon`. If TRUNCATE appears, the REVOKE did not run and any signed-in
-- role can empty these tables -- RLS does not filter TRUNCATE.
--
-- 4. Both FK columns on the referencing side are indexed.
-- SELECT tablename, indexname FROM pg_indexes
--  WHERE schemaname = 'public' AND tablename IN ('user_work_history', 'user_education')
--  ORDER BY tablename, indexname;
-- Expect the user_id+sort_order index and the source_document_id index on each.
--
-- 5. Functions are SECURITY DEFINER with a pinned search_path.
-- SELECT p.proname, p.prosecdef, p.proconfig
--   FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
--  WHERE n.nspname = 'public'
--    AND p.proname IN ('update_user_career_updated_at',
--                      'validate_user_career_row_write',
--                      'get_autofill_bundle');
-- Expect prosecdef = true and proconfig = {"search_path=public, pg_catalog"} for all three.
--
-- 6. get_autofill_bundle EXECUTE: authenticated yes, PUBLIC/anon no.
-- SELECT grantee, privilege_type FROM information_schema.routine_privileges
--  WHERE routine_schema = 'public' AND routine_name = 'get_autofill_bundle';
-- Expect `authenticated` (and the owner) only.
--
-- 6b. THE DENY PATH, exercised rather than inspected. Every check above reads a
--     catalog; none proves a real request behaves. Run as the role the
--     extension actually uses:
--
--     SET ROLE authenticated;
--     SET request.jwt.claim.sub = '<user A uuid>';
--
--     SELECT public.get_autofill_bundle() -> 'eeo';
--       -- With user A's autofill_eeo_enabled = FALSE (the 033 default):
--       --   expect JSON null. If an object comes back, the consent gate is
--       --   broken and special-category data is reaching a content script
--       --   running inside a third-party ATS page.
--       -- After: SELECT public.set_eeo_autofill_enabled(true, '<user A uuid>');
--       --   (service_role only -- run it in a separate service-role session)
--       --   expect an object.
--
--     SELECT count(*) FROM public.user_work_history;   -- expect: user A's rows only
--     SELECT * FROM public.user_profile_eeo;           -- expect: permission denied for table
--     TRUNCATE public.user_work_history;               -- expect: permission denied for table
--
--     RESET ROLE;
--     SET ROLE anon;
--     SELECT public.get_autofill_bundle();             -- expect: permission denied for function
--     RESET ROLE;
--
--     "permission denied" is the correct outcome for the last three, NOT an
--     empty result. A caller must be able to tell "nothing stored" from "you
--     are not allowed to ask".
--
-- 6c. Cross-tenant document reference is rejected (validate_user_career_row_write):
--     INSERT INTO public.user_work_history (user_id, company, source, source_document_id)
--     VALUES ('<user A uuid>', 'Acme',  'resume_import',
--             (SELECT id FROM public.documents WHERE user_id <> '<user A uuid>' LIMIT 1));
--     Expect: ERROR 42501 "does not belong to user".
--
-- 7. THE DATE-PRECISION INVARIANTS. Each of these must fail with 23514:
--     INSERT INTO public.user_work_history (user_id, company, start_date)
--       VALUES ('<uuid>', 'Acme', '2020-03-01');                    -- date without precision
--     INSERT INTO public.user_work_history (user_id, company, start_date, start_date_precision)
--       VALUES ('<uuid>', 'Acme', '2020-03-17', 'month');           -- day <> 01 under 'month'
--     INSERT INTO public.user_work_history (user_id, company, start_date, start_date_precision)
--       VALUES ('<uuid>', 'Acme', '2020-06-01', 'year');            -- month <> 01 under 'year'
--     INSERT INTO public.user_work_history (user_id, company, is_current, end_date, end_date_precision)
--       VALUES ('<uuid>', 'Acme', TRUE, '2021-01-01', 'year');      -- current role with an end date
--    And this must succeed -- the resume case the table exists for:
--     INSERT INTO public.user_work_history (user_id, company, start_date, start_date_precision)
--       VALUES ('<uuid>', 'Acme', '2020-01-01', 'year');
--
-- 8. GPA pairing.
--     INSERT INTO public.user_education (user_id, school, gpa)
--       VALUES ('<uuid>', 'MIT', 3.80);                             -- expect 23514: no scale
--     INSERT INTO public.user_education (user_id, school, gpa, gpa_scale)
--       VALUES ('<uuid>', 'MIT', 4.50, 4.00);                       -- expect 23514: gpa > scale
--
-- 9. Bundle shape survives an empty account (the case the section 9.2 sketch
--    gets wrong). As a user with no user_profiles row:
--     SELECT jsonb_object_keys(public.get_autofill_bundle());
--     Expect all five keys, with profile = null, overrides = {}, work = [],
--     education = [], eeo = null. NOT a single SQL NULL.
--
-- 10. Re-running this migration is a no-op (idempotency check).
--     Apply the whole file a second time; expect no errors and unchanged counts.

COMMIT;

-- ============================================================================
-- POST-COMMIT NOTE
-- ============================================================================
-- If the transaction above aborted, NOTHING was applied -- fix the reported
-- error and paste the whole file again. Do not paste fragments; the privilege
-- window described at the top is exactly what the transaction exists to prevent.
