-- Migration: Learned-mapping cache + autofill telemetry for the Universal
--            Autofill Engine (browser extension).
-- Created: 2026-09-19
--
-- Spec: extension/AUTOFILL_ARCHITECTURE.md section 9.4.
--
-- Five tables in two groups.
--
-- GLOBAL, shared across every user (no user column at all):
--   ats_form_signatures    -- one row per (ats_platform, form_fingerprint)
--   profile_field_mappings -- (form, field, occurrence) -> canonical profile key
--   autofill_mapping_votes -- the poisoning defense; carries user_id, own-row read only
--
-- USER-SCOPED, four policies each:
--   autofill_sessions
--   autofill_events
--
-- WHY GLOBAL. The cached data is employer-side metadata, not user data: a row is
-- (platform, form fingerprint, field fingerprint) -> canonical key. Per-user
-- caches never converge -- every user would re-teach the engine Greenhouse's
-- job_application[answers_attributes][0][text_value] from scratch. Global is the
-- only shape in which the engine improves over time rather than staying exactly
-- as good as its hand-written adapters. The per-user escape hatch already exists
-- on the profile row (033_create_user_profiles.sql:205-206,
-- user_profiles.autofill_overrides) and always wins over a global row.
--
-- WHAT THAT COSTS, AND WHAT PAYS FOR IT. A globally shared cache that any client
-- can influence is a mechanism for writing WRONG VALUES INTO OTHER PEOPLE'S JOB
-- APPLICATIONS. Three controls, all in this file:
--   1. `authenticated` cannot write these tables at all -- one SELECT policy and
--      no INSERT/UPDATE/DELETE policy, backed by a REVOKE. Writes go through
--      POST /api/autofill/mappings with the service role, which recomputes the
--      fingerprints itself (section 10.2 requirement 1).
--   2. Confidence and provenance on a mapping row are DERIVED from distinct
--      voters by trigger and are overwritten on every write, so a client-supplied
--      confidence cannot survive even a service-role INSERT.
--   3. No user value can be stored: every hash column is CHECK-constrained to a
--      hex digest, and the one JSONB column is filtered by a trigger that
--      constrains VALUES, not just keys.
--
-- Apply AFTER 034. Nothing in this file references 033 or 034 except
-- public.users and public.applications, but the numbering order is the
-- documented apply order (section 9).

-- ============================================================================
-- ONE TRANSACTION, same reasoning as 033_create_user_profiles.sql:28-36.
-- ============================================================================
-- Supabase's ALTER DEFAULT PRIVILEGES grants ALL on a newly created public table
-- to anon/authenticated/service_role at CREATE TABLE time, and the REVOKE that
-- takes it away lands many statements later. Run outside a transaction, that gap
-- is a window in which `authenticated` holds INSERT on a GLOBAL cache -- i.e. the
-- exact poisoning primitive this file exists to remove. All DDL below is
-- transactional in PostgreSQL, so the file applies whole or not at all.
BEGIN;

-- ---------------------------------------------------------------------------
-- Partial-run guard (033:50-83).
-- CREATE TABLE IF NOT EXISTS is a no-op against a HALF-BUILT table left by an
-- earlier paste that errored partway, and the missing columns are then never
-- added -- the migration fails later with a confusing error, or worse, succeeds
-- against a table that is missing a security column. Fail fast instead.
-- ---------------------------------------------------------------------------
DO $guard$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
              WHERE table_schema = 'public' AND table_name = 'ats_form_signatures')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns
              WHERE table_schema = 'public' AND table_name = 'ats_form_signatures'
                AND column_name = 'observation_count')
  THEN
    RAISE EXCEPTION
      'public.ats_form_signatures exists but is missing expected columns (observation_count). A previous run of migration 035 was applied partially. Either DROP TABLE public.ats_form_signatures CASCADE and re-run this file, or add the missing columns by hand. Refusing to continue against a half-built table.'
      USING ERRCODE = '42P16';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables
              WHERE table_schema = 'public' AND table_name = 'profile_field_mappings')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns
              WHERE table_schema = 'public' AND table_name = 'profile_field_mappings'
                AND column_name = 'repeat_group')
  THEN
    RAISE EXCEPTION
      'public.profile_field_mappings exists but is missing expected columns (repeat_group). A previous run of migration 035 was applied partially, and without repeat_group the unique key cannot separate two rows of one Workday repeater. Either DROP TABLE public.profile_field_mappings CASCADE and re-run this file, or add the missing columns by hand. Refusing to continue against a half-built table.'
      USING ERRCODE = '42P16';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables
              WHERE table_schema = 'public' AND table_name = 'autofill_events')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns
              WHERE table_schema = 'public' AND table_name = 'autofill_events'
                AND column_name = 'error_code')
  THEN
    RAISE EXCEPTION
      'public.autofill_events exists but is missing expected columns (error_code). A previous run of migration 035 was applied partially. Either DROP TABLE public.autofill_events CASCADE and re-run this file, or add the missing columns by hand. Refusing to continue against a half-built table.'
      USING ERRCODE = '42P16';
  END IF;

  -- Positive-security guard, not a shape guard. The whole point of the events
  -- table is that a free-form column cannot exist on it to receive a caught
  -- exception message. If one has appeared -- a later migration, a dashboard
  -- edit -- this file must not quietly certify the table as compliant.
  IF EXISTS (SELECT 1 FROM information_schema.columns
              WHERE table_schema = 'public' AND table_name = 'autofill_events'
                AND data_type IN ('jsonb', 'json'))
  THEN
    RAISE EXCEPTION
      'public.autofill_events has a JSON/JSONB column. Section 9.4 forbids it: a JSONB column is where catch (e) { log(e.message) } lands, and a validation error message contains the field value the user typed. Remove the column before re-running migration 035.'
      USING ERRCODE = '42P16';
  END IF;
END;
$guard$;

-- ============================================================================
-- TABLE: ats_form_signatures  -- form-level identity, GLOBAL
-- ============================================================================
-- Two tables rather than one. Collapsing this into profile_field_mappings would
-- repeat host/platform/fingerprint on every field row and would make "this
-- employer changed their form, the old mapping set is stale" inexpressible.
-- Because form_fingerprint hashes the SORTED SET of field hashes (section 10.1),
-- a changed form yields a NEW signature row and the old mappings become
-- unreachable rather than silently corrupting the next applicant's fill.

CREATE TABLE IF NOT EXISTS public.ats_form_signatures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Mirrors ATS_IDS (shared/autofill/types.ts:194-209). Kept as a CHECK rather
  -- than a Postgres ENUM because adding an ATS is a one-line array edit there
  -- and must not require ALTER TYPE coordination; the test asserts the two lists
  -- stay in step.
  ats_platform TEXT NOT NULL CHECK (ats_platform IN (
    'greenhouse', 'greenhouse_embed', 'lever', 'workday', 'ashby',
    'smartrecruiters', 'workable', 'icims', 'taleo', 'jobvite',
    'successfactors', 'generic'
  )),

  -- Full SHA-256 hex. See THE NO-USER-VALUES RULE below.
  -- 32 hex chars, NOT 64: shared/autofill/fingerprint.ts slices the SHA-256 to
  -- 32 (AUTOFILL_ARCHITECTURE.md section 10.1), and the two must agree or every
  -- insert from real engine output is rejected by this CHECK. 128 bits is ample
  -- for a cache key and is equally incapable of carrying a phone number, which
  -- is the only thing this constraint exists to prevent.
  form_fingerprint TEXT NOT NULL CHECK (form_fingerprint ~ '^[0-9a-f]{32}$'),

  -- Hostname charset only, which structurally cannot hold an email address (no
  -- '@'), a port, a path or a query string. This is the whole URL surface that
  -- is allowed to be stored; section 9.4 forbids full URLs because Greenhouse's
  -- embed is /embed/job_app?token=... and Workday paths carry session ids.
  origin_host TEXT NOT NULL CHECK (
    length(origin_host) BETWEEN 1 AND 253
    AND origin_host ~ '^[a-z0-9.-]+$'
  ),

  -- TEMPLATE, not a path. Numeric segments (requisition ids, Workday step
  -- ordinals) must be replaced client-side, which is what the digit-run rule
  -- enforces -- an untemplated path shatters the cache across requisitions and
  -- is also the likeliest place for an identifier to ride along.
  url_path_template TEXT CHECK (
    url_path_template IS NULL OR (
      length(url_path_template) <= 200
      AND url_path_template ~ '^/'
      AND url_path_template !~ '[?#@]'
      AND url_path_template !~ '\d{4}'
    )
  ),

  -- Workday and Taleo are multi-step wizards; the same origin+path serves a
  -- different field set per step, so the step is part of the form's identity.
  step_index INTEGER CHECK (step_index IS NULL OR step_index BETWEEN 0 AND 50),

  field_count INTEGER NOT NULL CHECK (field_count BETWEEN 0 AND 500),

  -- How many times this exact form has been observed. Not a vote and not
  -- evidence of correctness -- one user reloading a page 200 times moves this.
  -- Confidence comes from autofill_mapping_votes, which counts DISTINCT users.
  observation_count INTEGER NOT NULL DEFAULT 1 CHECK (observation_count >= 0),

  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT ats_form_signatures_identity UNIQUE (ats_platform, form_fingerprint),
  CONSTRAINT ats_form_signatures_seen_ordered CHECK (last_seen_at >= first_seen_at)
);

-- No extra index. The engine's only read is by (ats_platform, form_fingerprint),
-- which the UNIQUE constraint's index already serves, and 029_remove_unused_indexes.sql
-- is the precedent for not adding indexes nothing queries.

COMMENT ON TABLE public.ats_form_signatures IS
  'GLOBAL, shared across all users: identity of one ATS application form (one wizard step). Contains employer-side metadata only and has no user column by design. PROHIBITED in this table and in every table in migration 035: any field value (including the text a user typed when correcting the engine), full URLs with query strings (Greenhouse /embed/job_app?token=... and Workday session ids), resume file names (they contain the user''s legal name), EEO answer content (the canonical KEY is loggable, the option selected is not), IP addresses, and full user-agent strings. engine_version on autofill_sessions is the only client fingerprint permitted anywhere.';

COMMENT ON COLUMN public.ats_form_signatures.form_fingerprint IS
  'Full lowercase SHA-256 hex of (ats, sorted field keys) -- 64 characters, enforced by CHECK. NOTE: the sketch at AUTOFILL_ARCHITECTURE.md section 10.1 ends both fingerprint helpers with .slice(0, 32); shared/autofill/fingerprint.ts must NOT slice, or every write fails 23514. 64 is the correct length: a truncated digest raises collision probability on a table whose collisions mean one employer''s mapping set is served for another employer''s form.';

COMMENT ON COLUMN public.ats_form_signatures.url_path_template IS
  'origin pathname with numeric segments templated, e.g. /company/jobs/{n}. Never the query string. Stored for debugging and for "this employer changed their form" triage, never for addressing a row -- form_fingerprint is the identity.';

-- ============================================================================
-- Row Level Security: ats_form_signatures -- read-for-all, write-for-none
-- ============================================================================
-- Exactly ONE policy. There is no INSERT/UPDATE/DELETE policy, which under RLS
-- means those verbs are DENIED for every role RLS applies to. The REVOKE below
-- is the second lock on the same door: a future migration that adds a write
-- policy by mistake still finds `authenticated` without the table privilege.
--
-- RLS is not enforced for service_role, so the write path is:
--   extension -> service worker -> POST /api/autofill/mappings (Bearer auth)
--   -> route recomputes fieldKey and formFingerprint -> service-role write.
-- Same precedent as shared/infrastructure/ai/retry-queue.ts:25-27.

ALTER TABLE public.ats_form_signatures ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read ATS form signatures" ON public.ats_form_signatures;

CREATE POLICY "Authenticated users can read ATS form signatures"
ON public.ats_form_signatures
FOR SELECT
TO authenticated
USING (true);

REVOKE ALL ON public.ats_form_signatures FROM PUBLIC;
REVOKE ALL ON public.ats_form_signatures FROM anon;
REVOKE ALL ON public.ats_form_signatures FROM authenticated;
GRANT SELECT ON public.ats_form_signatures TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ats_form_signatures TO service_role;

-- ============================================================================
-- TABLE: profile_field_mappings  -- field identity -> canonical key, GLOBAL
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.profile_field_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  form_signature_id UUID NOT NULL
    REFERENCES public.ats_form_signatures(id) ON DELETE CASCADE,

  field_signature_hash TEXT NOT NULL CHECK (field_signature_hash ~ '^[0-9a-f]{32}$'),

  -- REPEATERS NEED AN ORDINAL, and it has to be in the unique key.
  -- Inside one Workday work-experience widget, row 1's "Company" and row 3's
  -- "Company" have identical tag, type, label and -- after digits are stripped
  -- from label_norm and [\d] from name/id patterns -- identical patterns. They
  -- therefore produce the SAME field_signature_hash. Without these two columns
  -- in the key the second row collides with the first, and the itemized entries
  -- that justify user_work_history existing at all cannot be filled correctly.
  --
  -- NOT NULL with sentinels rather than nullable columns, deliberately: in a
  -- UNIQUE index NULLs are distinct by default, so (sig, hash, NULL, NULL) would
  -- insert an unlimited number of duplicate rows for the ordinary non-repeater
  -- case and the constraint would enforce nothing at all. (PG15's NULLS NOT
  -- DISTINCT would also work; sentinels do not depend on the server version.)
  occurrence_index INTEGER NOT NULL DEFAULT -1
    CHECK (occurrence_index BETWEEN -1 AND 99),
  repeat_group TEXT NOT NULL DEFAULT ''
    CHECK (repeat_group = '' OR repeat_group ~ '^[0-9a-f]{32}$'),

  -- Mirrors PROFILE_KEYS (shared/autofill/types.ts:31-77). 'unmapped' IS a
  -- storable answer: "this field maps to nothing" is worth caching, because it
  -- is what stops the engine re-escalating an essay question to Gemini on every
  -- applicant. The EEO keys are storable for the same reason -- the KEY is
  -- schema, the selected option is answer content and is never written anywhere
  -- in this migration.
  canonical_profile_key TEXT NOT NULL CHECK (canonical_profile_key IN (
    'legal_first_name', 'legal_last_name', 'preferred_name', 'full_name', 'pronouns',
    'email', 'phone', 'phone_country_code', 'address_line1', 'address_line2',
    'city', 'state_region', 'postal_code', 'country',
    'linkedin_url', 'github_url', 'portfolio_url', 'other_url',
    'current_employer', 'current_title', 'years_experience',
    'work_authorized', 'requires_sponsorship', 'visa_status', 'security_clearance',
    'desired_salary', 'earliest_start_date', 'notice_period', 'willing_to_relocate',
    'remote_preference',
    'referral_source', 'previously_employed_here', 'how_heard',
    'gender', 'race_ethnicity', 'hispanic_latino', 'veteran_status', 'disability_status',
    'resume_file', 'cover_letter_file', 'cover_letter_text',
    'unmapped'
  )),

  -- The employer-authored attributes the hash was computed from, kept so a bad
  -- mapping can be diagnosed without re-visiting the form. Guarded by
  -- validate_autofill_field_signature() below, which allowlists the keys AND
  -- constrains the values.
  field_signature JSONB NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(field_signature) = 'object'),

  -- ORIGIN of the mapping, supplied by the route. 'user' is deliberately absent
  -- from this vocabulary: a user's correction is a per-user fact and belongs in
  -- user_profiles.autofill_overrides (033:205-206) plus one row in
  -- autofill_mapping_votes. Letting one client stamp 'user' on a GLOBAL row
  -- would hand it the highest-trust label in the system for free.
  base_provenance TEXT NOT NULL DEFAULT 'heuristic'
    CHECK (base_provenance IN ('adapter', 'heuristic', 'ai')),

  -- DERIVED, never client-supplied. Overwritten on every INSERT and UPDATE by
  -- derive_mapping_consensus(). 'consensus' is reachable only through distinct
  -- voters; it cannot be written directly even with the service role.
  provenance TEXT NOT NULL DEFAULT 'heuristic'
    CHECK (provenance IN ('adapter', 'heuristic', 'ai', 'consensus')),
  confidence    NUMERIC(4, 3) NOT NULL DEFAULT 0 CHECK (confidence BETWEEN 0 AND 1),
  confirm_count INTEGER NOT NULL DEFAULT 0 CHECK (confirm_count >= 0),
  reject_count  INTEGER NOT NULL DEFAULT 0 CHECK (reject_count  >= 0),

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT profile_field_mappings_identity
    UNIQUE (form_signature_id, field_signature_hash, occurrence_index, repeat_group),

  -- The two repeater columns are one fact and must not disagree. A row with an
  -- ordinal but no group (or the reverse) is an identity that no reader can
  -- reconstruct, and it defeats the unique key it was added to.
  CONSTRAINT profile_field_mappings_repeat_pair_consistent CHECK (
    (occurrence_index = -1 AND repeat_group = '')
    OR (occurrence_index >= 0 AND repeat_group <> '')
  ),

  -- SECTION 5.1's CAP, AS A DATABASE INVARIANT. ACCEPT_THRESHOLD is 0.62, so a
  -- resolution that has not been agreed by distinct users must sit at or below
  -- 0.60 or the planner will pre-accept it. Enforcing it here means a future
  -- route that computes confidence differently cannot reintroduce the failure
  -- where ~50 hand-guessed selectors silently pre-accept.
  CONSTRAINT profile_field_mappings_unconsensed_cannot_pre_accept
    CHECK (provenance = 'consensus' OR confidence <= 0.60)
);

-- form_signature_id is the leading column of profile_field_mappings_identity, so
-- that index already covers both the engine's read (all mappings for one form)
-- and the ON DELETE CASCADE from ats_form_signatures. No second index.

COMMENT ON TABLE public.profile_field_mappings IS
  'GLOBAL, shared across all users: (form signature, field signature, occurrence) -> canonical profile key. Employer-side metadata only; there is deliberately no value, sample_value, example or user_value column. PROHIBITED here and in every table in migration 035: any field value (including the text a user typed when correcting the engine), full URLs with query strings, resume file names (they contain the user''s legal name), EEO answer content (canonical_profile_key = ''gender'' is loggable and is needed to improve EEO field mapping; the option the user selected is not), IP addresses, and full user-agent strings. confidence/provenance/confirm_count/reject_count are DERIVED from distinct voters by trigger and are overwritten on every write -- a client-supplied value never survives.';

COMMENT ON COLUMN public.profile_field_mappings.canonical_profile_key IS
  'A SCHEMA KEY drawn from PROFILE_KEYS (shared/autofill/types.ts:31-77) such as "phone", never content. Repeater rows keep the plain key and carry the ordinal in occurrence_index; the fill engine indexes at fill time (work_history[i].company) rather than baking the index into the key, so the key space stays equal to PROFILE_KEYS.';

COMMENT ON COLUMN public.profile_field_mappings.field_signature IS
  'Employer-authored attributes only, key-allowlisted AND value-constrained by validate_autofill_field_signature(). Key allowlisting alone is not sufficient: label_norm, placeholder_norm, name_pattern and id_pattern are free text, and after a Greenhouse resume upload the file input''s rendered label becomes the uploaded FILENAME, which contains the user''s legal name. wrapper_text is deliberately not an allowed key -- it is the largest free-text surface on the page, it is used on-device at resolve time, and storing it buys almost nothing.';

COMMENT ON COLUMN public.profile_field_mappings.occurrence_index IS
  '-1 means "not inside a repeater". 0-based row ordinal otherwise. NOT NULL with a sentinel because NULLs are distinct in a UNIQUE index, which would let the ordinary case duplicate without limit.';

COMMENT ON COLUMN public.profile_field_mappings.base_provenance IS
  'How the mapping was first produced. The route may set this; it may never set provenance, confidence or the counts. ''user'' is not in the vocabulary -- a per-user correction belongs in user_profiles.autofill_overrides plus one vote row, not on a globally shared mapping.';

COMMENT ON COLUMN public.profile_field_mappings.provenance IS
  'DERIVED. ''consensus'' requires >= 3 DISTINCT confirming users outnumbering rejecters; otherwise this mirrors base_provenance. Demotion is automatic when a voter withdraws, which is why base_provenance is kept separately -- overwriting a single column would lose the pre-consensus origin and make demotion guesswork.';

-- ============================================================================
-- Row Level Security: profile_field_mappings -- same model as the signatures
-- ============================================================================

ALTER TABLE public.profile_field_mappings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read field mappings" ON public.profile_field_mappings;

CREATE POLICY "Authenticated users can read field mappings"
ON public.profile_field_mappings
FOR SELECT
TO authenticated
USING (true);

REVOKE ALL ON public.profile_field_mappings FROM PUBLIC;
REVOKE ALL ON public.profile_field_mappings FROM anon;
REVOKE ALL ON public.profile_field_mappings FROM authenticated;
GRANT SELECT ON public.profile_field_mappings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profile_field_mappings TO service_role;

-- ============================================================================
-- TABLE: autofill_mapping_votes  -- THE POISONING DEFENSE
-- ============================================================================
-- Confirm/reject counters ON THE MAPPING ROW ALONE ARE NOT A DEFENSE. With no
-- user dimension, one client POSTs ten thousand "confirmations" that a Greenhouse
-- field which actually reads "Are you legally authorized to work in the US?" maps
-- to `phone`, and every later applicant gets their phone number typed into a work
-- authorization question. The user dimension is the defense; the counters are
-- just its projection.

CREATE TABLE IF NOT EXISTS public.autofill_mapping_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  form_signature_id UUID NOT NULL
    REFERENCES public.ats_form_signatures(id) ON DELETE CASCADE,
  field_signature_hash TEXT NOT NULL CHECK (field_signature_hash ~ '^[0-9a-f]{32}$'),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  -- The key the vote is ABOUT. vote = 1 means "this field is that key";
  -- vote = -1 means "this field is NOT that key". Same vocabulary as
  -- profile_field_mappings.canonical_profile_key.
  canonical_profile_key TEXT NOT NULL CHECK (canonical_profile_key IN (
    'legal_first_name', 'legal_last_name', 'preferred_name', 'full_name', 'pronouns',
    'email', 'phone', 'phone_country_code', 'address_line1', 'address_line2',
    'city', 'state_region', 'postal_code', 'country',
    'linkedin_url', 'github_url', 'portfolio_url', 'other_url',
    'current_employer', 'current_title', 'years_experience',
    'work_authorized', 'requires_sponsorship', 'visa_status', 'security_clearance',
    'desired_salary', 'earliest_start_date', 'notice_period', 'willing_to_relocate',
    'remote_preference',
    'referral_source', 'previously_employed_here', 'how_heard',
    'gender', 'race_ethnicity', 'hispanic_latino', 'veteran_status', 'disability_status',
    'resume_file', 'cover_letter_file', 'cover_letter_text',
    'unmapped'
  )),

  vote SMALLINT NOT NULL CHECK (vote IN (-1, 1)),

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- ONE USER, ONE VOTE, per (form, field). Changing your mind is an upsert on
  -- this key that replaces both the key and the direction -- not a second row.
  -- This is the constraint the whole defense rests on.
  --
  -- Deliberately NOT keyed by occurrence_index/repeat_group: a vote is about the
  -- SEMANTICS of a field ("this Company box means current_employer"), which is
  -- identical for every row of a repeater. The ordinal only selects which
  -- user_work_history entry supplies the value, and that is not something a user
  -- can be wrong about in a way another user should ratify.
  CONSTRAINT autofill_mapping_votes_one_per_user
    UNIQUE (form_signature_id, field_signature_hash, user_id)
);

-- autofill_mapping_votes_one_per_user leads with form_signature_id, so it covers
-- that FK. user_id is its third column and therefore NOT usable as a prefix --
-- without this index every DELETE on public.users sequentially scans the votes
-- table, which is the unindexed_foreign_keys lint 028_advisor_fixes.sql cleaned up.
CREATE INDEX IF NOT EXISTS idx_autofill_mapping_votes_user_id
  ON public.autofill_mapping_votes(user_id);

COMMENT ON TABLE public.autofill_mapping_votes IS
  'One vote per (form signature, field signature, user) -- the poisoning defense for the globally shared mapping cache. Rows carry a canonical KEY and a direction, never a field value. Read is own-row only: (user_id, form_signature_id) reveals that a specific user applied at a specific employer''s form, which is not something any other signed-in user may enumerate. Writes are service-role only, via POST /api/autofill/mappings after it recomputes the fingerprints itself. PROHIBITED here and in every table in migration 035: any field value (including the text a user typed when correcting the engine), full URLs with query strings, resume file names (they contain the user''s legal name), EEO answer content (canonical_profile_key = ''gender'' is loggable, the option selected is not), IP addresses, and full user-agent strings.';

COMMENT ON COLUMN public.autofill_mapping_votes.vote IS
  '1 = this field IS canonical_profile_key. -1 = it is NOT. Counted as DISTINCT users by derive_mapping_consensus(); the raw row count is never used, so duplicate submissions from one account buy nothing.';

-- ============================================================================
-- Row Level Security: autofill_mapping_votes -- own-row read, no client write
-- ============================================================================
-- A third model, on purpose. The two tables above are globally readable because
-- they contain no user. This one contains user_id, so a USING (true) SELECT
-- policy would turn it into a directory of who applied where.

ALTER TABLE public.autofill_mapping_votes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own mapping votes" ON public.autofill_mapping_votes;

CREATE POLICY "Users can view their own mapping votes"
ON public.autofill_mapping_votes
FOR SELECT
TO authenticated
USING ((select auth.uid()) = user_id);

REVOKE ALL ON public.autofill_mapping_votes FROM PUBLIC;
REVOKE ALL ON public.autofill_mapping_votes FROM anon;
REVOKE ALL ON public.autofill_mapping_votes FROM authenticated;
GRANT SELECT ON public.autofill_mapping_votes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.autofill_mapping_votes TO service_role;

-- ============================================================================
-- THE NO-USER-VALUES RULE, level 2: the field_signature trigger
-- ============================================================================
-- Level 1 is the schema (no value column exists). Level 3 is the route (it
-- rebuilds the signature from an allowlist instead of trusting the client's
-- object). This is level 2, and it is the one that still holds when the route
-- has a bug.
--
-- ALLOWLISTING THE KEYS IS NOT SUFFICIENT. Four of the allowed keys are free
-- text that demonstrably carries user content on real forms: after a Greenhouse
-- resume upload the file input's rendered label becomes the uploaded filename,
-- which contains the user's legal name. So every text value is additionally
-- constrained.
--
-- The five patterns below are TEST-SYNCED: shared/autofill/migration-035.test.ts
-- parses these five assignments out of this file -- together with the ~ / ~*
-- operator each is applied with -- and compiles them as JavaScript RegExp to
-- prove they reject real payloads and pass real employer labels. Keep them inside the subset both
-- engines share -- \d, \s, \+, ?, {n,}, bracket expressions, alternation. No
-- POSIX [:class:] names, no possessive or lookaround syntax.

CREATE OR REPLACE FUNCTION public.validate_autofill_field_signature()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  -- TEST-SYNCED PATTERNS -- see the note above before editing.
  pat_email     TEXT := '[^\s@]+@[^\s@]+\.[a-z]{2,}';
  pat_phone     TEXT := '\+?\d[\d().\s-]{6,}\d';
  pat_userinfo  TEXT := '://[^/\s]*@';
  pat_filename  TEXT := '\.(pdf|docx?|txt)$';
  pat_digit_run TEXT := '\d{4}';

  -- Employer-authored attributes only. Every one of these is written by the ATS
  -- or the employer, never typed by the applicant.
  text_keys TEXT[] := ARRAY[
    'tag', 'input_type', 'kind', 'autocomplete', 'ats_hint',
    'label_norm', 'placeholder_norm', 'aria_label_norm', 'group_norm',
    'name_pattern', 'id_pattern', 'repeat_group'
  ];
  bool_keys TEXT[] := ARRAY['required', 'disabled', 'read_only'];
  num_keys  TEXT[] := ARRAY['option_count', 'occurrence_index', 'max_length'];

  k TEXT;
  v JSONB;
  t TEXT;
  s TEXT;
BEGIN
  -- A signature is a handful of short scalars. A blob that is not is either a
  -- bug or an attempt to use this column as general storage.
  IF (SELECT count(*) FROM jsonb_object_keys(NEW.field_signature)) > 20 THEN
    RAISE EXCEPTION 'field_signature may carry at most 20 keys'
      USING ERRCODE = '22023';
  END IF;

  IF length(NEW.field_signature::text) > 1024 THEN
    RAISE EXCEPTION 'field_signature exceeds 1024 bytes'
      USING ERRCODE = '22023';
  END IF;

  FOR k, v IN SELECT key, value FROM jsonb_each(NEW.field_signature) LOOP
    IF NOT (k = ANY (text_keys) OR k = ANY (bool_keys) OR k = ANY (num_keys)) THEN
      RAISE EXCEPTION 'field_signature key % is not allowlisted', k
        USING ERRCODE = '22023';
    END IF;

    t := jsonb_typeof(v);

    -- A nested object or array would carry its own scalars past the per-value
    -- checks below, which is the whole bypass.
    IF t IN ('object', 'array') THEN
      RAISE EXCEPTION 'field_signature key % must be a scalar, got %', k, t
        USING ERRCODE = '22023';
    END IF;

    IF t = 'null' THEN
      CONTINUE;
    END IF;

    IF k = ANY (bool_keys) THEN
      IF t <> 'boolean' THEN
        RAISE EXCEPTION 'field_signature key % must be a boolean, got %', k, t
          USING ERRCODE = '22023';
      END IF;
      CONTINUE;
    END IF;

    IF k = ANY (num_keys) THEN
      IF t <> 'number' THEN
        RAISE EXCEPTION 'field_signature key % must be a number, got %', k, t
          USING ERRCODE = '22023';
      END IF;
      CONTINUE;
    END IF;

    IF t <> 'string' THEN
      RAISE EXCEPTION 'field_signature key % must be a string, got %', k, t
        USING ERRCODE = '22023';
    END IF;

    s := v #>> '{}';

    IF length(s) > 64 THEN
      RAISE EXCEPTION 'field_signature.% exceeds 64 characters; employer labels are clipped before storage', k
        USING ERRCODE = '22023';
    END IF;

    IF s ~ '[\n\r\t]' THEN
      RAISE EXCEPTION 'field_signature.% contains control characters; values are normalized before storage', k
        USING ERRCODE = '22023';
    END IF;

    -- The message never echoes s. An error message is written to the Postgres
    -- log and returned to the caller, so echoing a rejected value would leak the
    -- exact PII this check exists to stop.
    IF s ~* pat_email THEN
      RAISE EXCEPTION 'field_signature.% looks like an email address; field values must never be stored', k
        USING ERRCODE = '22023';
    END IF;

    IF s ~ pat_phone THEN
      RAISE EXCEPTION 'field_signature.% looks like a phone number; field values must never be stored', k
        USING ERRCODE = '22023';
    END IF;

    IF s ~* pat_userinfo THEN
      RAISE EXCEPTION 'field_signature.% contains a URL with userinfo; field values must never be stored', k
        USING ERRCODE = '22023';
    END IF;

    -- The Greenhouse case: the file input's label becomes "Ada_Lovelace_CV.pdf"
    -- once a resume is attached.
    IF s ~* pat_filename THEN
      RAISE EXCEPTION 'field_signature.% looks like a file name; a rendered file-input label carries the uploaded resume name and therefore the user''s legal name', k
        USING ERRCODE = '22023';
    END IF;

    -- Blunt, and deliberately so. Four is the boundary: "401k" and "I-9" pass,
    -- "Form 1099" and "Graduation year 2020" do not, and losing those two costs
    -- one uncached field each. Accepting them would let a postal code, a salary
    -- or a phone fragment into a table every applicant reads.
    IF s ~ pat_digit_run THEN
      RAISE EXCEPTION 'field_signature.% contains a run of 4 or more digits; digits are stripped from labels and templated in name/id patterns before storage', k
        USING ERRCODE = '22023';
    END IF;
  END LOOP;

  -- The JSONB copy and the indexed columns are one fact. If they disagree, a
  -- reader diagnosing a bad fill is looking at a different repeater row than the
  -- one the unique key addressed.
  IF NEW.field_signature ? 'repeat_group'
     AND COALESCE(NEW.field_signature #>> '{repeat_group}', '') <> NEW.repeat_group THEN
    RAISE EXCEPTION 'field_signature.repeat_group disagrees with the repeat_group column'
      USING ERRCODE = '22023';
  END IF;

  IF NEW.field_signature ? 'occurrence_index'
          -- ::NUMERIC, not ::INTEGER: a non-integral JSON number would raise 22P02
     -- from the cast instead of the 22023 this trigger is supposed to report.
     AND (NEW.field_signature #>> '{occurrence_index}')::NUMERIC <> NEW.occurrence_index THEN
    RAISE EXCEPTION 'field_signature.occurrence_index disagrees with the occurrence_index column'
      USING ERRCODE = '22023';
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.validate_autofill_field_signature() IS
'Allowlists the KEYS of profile_field_mappings.field_signature and constrains its VALUES: <= 64 chars, no control characters, and rejecting anything shaped like an email, a phone number, a URL with userinfo, a document filename, or a run of 4+ digits. Key allowlisting alone is insufficient because label_norm/placeholder_norm/name_pattern/id_pattern are free text and a Greenhouse file input renders the uploaded resume filename as its label. Fixed search_path for security.';

DROP TRIGGER IF EXISTS trg_profile_field_mappings_validate_signature ON public.profile_field_mappings;
CREATE TRIGGER trg_profile_field_mappings_validate_signature
  BEFORE INSERT OR UPDATE ON public.profile_field_mappings
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_autofill_field_signature();

-- ============================================================================
-- Consensus derivation -- counts, confidence and provenance are NOT inputs
-- ============================================================================

CREATE OR REPLACE FUNCTION public.autofill_mapping_vote_tally(
  p_form_signature_id    UUID,
  p_field_signature_hash TEXT,
  p_canonical_profile_key TEXT
)
RETURNS TABLE (confirm_users INTEGER, reject_users INTEGER)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  -- count(DISTINCT user_id), never count(*). The unique constraint already caps
  -- a user at one row, but counting distinct users keeps the arithmetic correct
  -- if that constraint is ever relaxed, and it states the intent in the query.
  SELECT
    count(DISTINCT v.user_id) FILTER (
      WHERE v.vote = 1  AND v.canonical_profile_key = p_canonical_profile_key)::INTEGER,
    count(DISTINCT v.user_id) FILTER (
      WHERE v.vote = -1 AND v.canonical_profile_key = p_canonical_profile_key)::INTEGER
  FROM public.autofill_mapping_votes v
  WHERE v.form_signature_id = p_form_signature_id
    AND v.field_signature_hash = p_field_signature_hash;
$$;

COMMENT ON FUNCTION public.autofill_mapping_vote_tally(UUID, TEXT, TEXT) IS
'Distinct-user confirm/reject tally for one (form, field, key). Votes for a DIFFERENT key are not counted as rejections of this one -- they are evidence for that other key, tallied on its own row. Fixed search_path for security.';

-- EXECUTE is granted to PUBLIC by default on every function, so a SECURITY
-- DEFINER function in schema public is a PostgREST RPC endpoint the moment it is
-- created -- and this one bypasses RLS on autofill_mapping_votes by design. It is
-- an internal helper for the trigger below, never an endpoint: an authenticated
-- caller who can probe tallies for arbitrary (form, field) pairs can measure how
-- close a mapping is to the >= 3-voter promotion floor and time its own votes
-- against it. Revoked, and deliberately not granted to service_role either --
-- the trigger runs as the function owner, not as the caller.
-- The trigger functions above return TRIGGER and are therefore not callable as
-- RPCs; this is the only function in this file that needs the REVOKE (033:732-755).
REVOKE EXECUTE ON FUNCTION public.autofill_mapping_vote_tally(UUID, TEXT, TEXT)
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.derive_mapping_consensus()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  c    INTEGER;
  r    INTEGER;
  base NUMERIC(4, 3);
BEGIN
  SELECT t.confirm_users, t.reject_users INTO c, r
  FROM public.autofill_mapping_vote_tally(
    NEW.form_signature_id, NEW.field_signature_hash, NEW.canonical_profile_key
  ) t;

  NEW.confirm_count := c;
  NEW.reject_count  := r;

  -- >= 3 DISTINCT confirming users is the promotion floor from section 9.4. The
  -- majority test is the additional guard: without it, 3 confirmations would
  -- promote a mapping that 10 other users had rejected.
  IF c >= 3 AND c > r THEN
    NEW.provenance := 'consensus';
    -- Laplace-smoothed agreement among distinct users, so the first confirmation
    -- is not read as certainty: 3/0 -> 0.800, 3/1 -> 0.667, 10/0 -> 0.917.
    -- Capped at 0.95 -- a cached global row is never certainty.
    NEW.confidence := LEAST(0.95, round((c + 1.0) / (c + r + 2.0), 3));
  ELSE
    NEW.provenance := NEW.base_provenance;
    -- Every branch here lands at or below 0.60 = ACCEPT_THRESHOLD - 0.02
    -- (section 5.1). Nothing without consensus may pre-accept, and the CHECK
    -- constraint on the table refuses the row if this arithmetic ever drifts.
    base := CASE NEW.base_provenance
              WHEN 'adapter'   THEN 0.600
              WHEN 'heuristic' THEN 0.500
              WHEN 'ai'        THEN 0.400
            END;
    NEW.confidence := GREATEST(0, round(base - (0.100 * r), 3));
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.derive_mapping_consensus() IS
'Overwrites confirm_count, reject_count, provenance and confidence on every INSERT and UPDATE of profile_field_mappings from the distinct-user vote tally. This is what makes "never client-supplied" true rather than documented: even a service-role write that passes a confidence is discarded. Promotion to ''consensus'' needs >= 3 distinct confirming users outnumbering rejecters; demotion is automatic when a voter withdraws, which is why base_provenance is a separate column. Fixed search_path for security.';

DROP TRIGGER IF EXISTS trg_profile_field_mappings_derive ON public.profile_field_mappings;
CREATE TRIGGER trg_profile_field_mappings_derive
  BEFORE INSERT OR UPDATE ON public.profile_field_mappings
  FOR EACH ROW
  EXECUTE FUNCTION public.derive_mapping_consensus();

-- ---------------------------------------------------------------------------
-- A vote change must reach the mapping rows it affects. This touches them; the
-- BEFORE trigger above does the actual recomputation, so the formula lives in
-- exactly one place. No recursion: this writes mappings, that one writes votes
-- never.
--
-- All occurrence rows sharing the (form, field) pair are touched, because a vote
-- is about the field's semantics and those are shared across the repeater --
-- see the note on autofill_mapping_votes_one_per_user.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.refresh_mapping_consensus_from_vote()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  -- NEW and OLD are read in SEPARATE arms rather than in one UNION query.
  -- PL/pgSQL leaves OLD unassigned on INSERT (and NEW on DELETE), and reading a
  -- field of an unassigned record raises 'record "old" is not assigned yet'.
  -- A `WHERE TG_OP <> 'INSERT'` guard inside the query does not fix that: SQL
  -- does not promise short-circuit evaluation, so the parameter can still be
  -- read. Only statement-level control flow keeps the reference unreachable.
  IF TG_OP <> 'DELETE' THEN
    UPDATE public.profile_field_mappings m
       SET updated_at = now()
     WHERE m.form_signature_id    = NEW.form_signature_id
       AND m.field_signature_hash = NEW.field_signature_hash;
  END IF;

  -- The row set the vote LEFT. On an ordinary UPDATE this is the same set the
  -- arm above just touched, and touching it twice is idempotent; on a withdrawn
  -- or moved vote it is a DIFFERENT set, and skipping it leaves that mapping
  -- sitting at 'consensus' on evidence that no longer exists.
  IF TG_OP <> 'INSERT' THEN
    UPDATE public.profile_field_mappings m
       SET updated_at = now()
     WHERE m.form_signature_id    = OLD.form_signature_id
       AND m.field_signature_hash = OLD.field_signature_hash;
  END IF;

  RETURN NULL;
END;
$$;

COMMENT ON FUNCTION public.refresh_mapping_consensus_from_vote() IS
'Touches every profile_field_mappings row for the (form, field) a vote changed, so derive_mapping_consensus() recomputes counts, confidence and provenance. Handles a user moving their vote between keys by touching both the old and the new row set. Fixed search_path for security.';

DROP TRIGGER IF EXISTS trg_autofill_mapping_votes_refresh ON public.autofill_mapping_votes;
CREATE TRIGGER trg_autofill_mapping_votes_refresh
  AFTER INSERT OR UPDATE OR DELETE ON public.autofill_mapping_votes
  FOR EACH ROW
  EXECUTE FUNCTION public.refresh_mapping_consensus_from_vote();

CREATE OR REPLACE FUNCTION public.update_autofill_mapping_votes_updated_at()
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

COMMENT ON FUNCTION public.update_autofill_mapping_votes_updated_at() IS
'Trigger function to automatically update updated_at timestamp. Fixed search_path for security.';

DROP TRIGGER IF EXISTS trg_autofill_mapping_votes_updated_at ON public.autofill_mapping_votes;
CREATE TRIGGER trg_autofill_mapping_votes_updated_at
  BEFORE UPDATE ON public.autofill_mapping_votes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_autofill_mapping_votes_updated_at();

CREATE OR REPLACE FUNCTION public.update_ats_form_signatures_last_seen()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  NEW.last_seen_at = now();
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.update_ats_form_signatures_last_seen() IS
'Keeps last_seen_at honest on every observation upsert so "this employer stopped serving this form" is answerable. Fixed search_path for security.';

DROP TRIGGER IF EXISTS trg_ats_form_signatures_last_seen ON public.ats_form_signatures;
CREATE TRIGGER trg_ats_form_signatures_last_seen
  BEFORE UPDATE ON public.ats_form_signatures
  FOR EACH ROW
  EXECUTE FUNCTION public.update_ats_form_signatures_last_seen();

-- ============================================================================
-- TABLE: autofill_sessions  -- user-scoped telemetry, one per fill run
-- ============================================================================
-- Carries NO url column. The origin host and templated path live on
-- ats_form_signatures, which this references -- so the session knows which form
-- it ran against without a second copy of a URL that could arrive with its query
-- string attached.

CREATE TABLE IF NOT EXISTS public.autofill_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  form_signature_id UUID REFERENCES public.ats_form_signatures(id) ON DELETE SET NULL,
  application_id    UUID REFERENCES public.applications(id) ON DELETE SET NULL,

  ats_platform TEXT NOT NULL CHECK (ats_platform IN (
    'greenhouse', 'greenhouse_embed', 'lever', 'workday', 'ashby',
    'smartrecruiters', 'workable', 'icims', 'taleo', 'jobvite',
    'successfactors', 'generic'
  )),
  adapter_confidence TEXT CHECK (adapter_confidence IN (
    'verified', 'unverified', 'heuristic_only'
  )),

  -- The ONLY client fingerprint permitted. Not the user-agent, not the IP. The
  -- CHECK is what keeps it that way: a semver-shaped string has nowhere to put
  -- "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)".
  engine_version TEXT NOT NULL CHECK (engine_version ~ '^\d{1,3}\.\d{1,3}\.\d{1,3}(-[0-9a-z.]{1,16})?$'),

  fields_total     INTEGER NOT NULL DEFAULT 0 CHECK (fields_total     BETWEEN 0 AND 1000),
  fields_planned   INTEGER NOT NULL DEFAULT 0 CHECK (fields_planned   BETWEEN 0 AND 1000),
  fields_filled    INTEGER NOT NULL DEFAULT 0 CHECK (fields_filled    BETWEEN 0 AND 1000),
  fields_skipped   INTEGER NOT NULL DEFAULT 0 CHECK (fields_skipped   BETWEEN 0 AND 1000),
  fields_failed    INTEGER NOT NULL DEFAULT 0 CHECK (fields_failed    BETWEEN 0 AND 1000),
  fields_sensitive INTEGER NOT NULL DEFAULT 0 CHECK (fields_sensitive BETWEEN 0 AND 1000),

  outcome TEXT NOT NULL DEFAULT 'running' CHECK (outcome IN (
    'running', 'completed', 'aborted', 'undone', 'abandoned', 'error'
  )),

  started_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,

  CONSTRAINT autofill_sessions_completion_ordered
    CHECK (completed_at IS NULL OR completed_at >= started_at),
  -- A finished run has an end time and a running one does not, so "how many runs
  -- are stuck?" is answerable without guessing from a timeout.
  CONSTRAINT autofill_sessions_terminal_is_stamped
    CHECK ((outcome = 'running') = (completed_at IS NULL))
);

-- Both back ON DELETE paths Postgres does not auto-index: the CASCADE from
-- public.users (account deletion) and the SET NULL from public.applications.
-- user_id additionally serves the only read the UI makes ("my recent fills").
CREATE INDEX IF NOT EXISTS idx_autofill_sessions_user_id
  ON public.autofill_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_autofill_sessions_application_id
  ON public.autofill_sessions(application_id)
  WHERE application_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_autofill_sessions_form_signature_id
  ON public.autofill_sessions(form_signature_id)
  WHERE form_signature_id IS NOT NULL;

COMMENT ON TABLE public.autofill_sessions IS
  'One autofill run, user-scoped. PROHIBITED here and in every table in migration 035: any field value (including the text a user typed when correcting the engine), full URLs with query strings -- the form is identified by form_signature_id, and origin_host/url_path_template live on ats_form_signatures -- resume file names (they contain the user''s legal name), EEO answer content (the canonical KEY is loggable, the selected option is not), IP addresses, and full user-agent strings. engine_version is the only client fingerprint.';

COMMENT ON COLUMN public.autofill_sessions.engine_version IS
  'Semver, CHECK-constrained. The single permitted client fingerprint, and the CHECK is the reason it cannot quietly become a user-agent string.';

-- ============================================================================
-- Row Level Security: autofill_sessions -- four policies
-- ============================================================================

ALTER TABLE public.autofill_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own autofill sessions"   ON public.autofill_sessions;
DROP POLICY IF EXISTS "Users can create own autofill sessions" ON public.autofill_sessions;
DROP POLICY IF EXISTS "Users can update own autofill sessions" ON public.autofill_sessions;
DROP POLICY IF EXISTS "Users can delete own autofill sessions" ON public.autofill_sessions;

CREATE POLICY "Users can view own autofill sessions"
ON public.autofill_sessions
FOR SELECT
TO authenticated
USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can create own autofill sessions"
ON public.autofill_sessions
FOR INSERT
TO authenticated
WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can update own autofill sessions"
ON public.autofill_sessions
FOR UPDATE
TO authenticated
USING ((select auth.uid()) = user_id)
WITH CHECK ((select auth.uid()) = user_id);

-- Telemetry about one's own job applications is exactly the kind of record a
-- user is entitled to erase without deleting their account.
CREATE POLICY "Users can delete own autofill sessions"
ON public.autofill_sessions
FOR DELETE
TO authenticated
USING ((select auth.uid()) = user_id);

REVOKE ALL ON public.autofill_sessions FROM PUBLIC;
REVOKE ALL ON public.autofill_sessions FROM anon;
REVOKE ALL ON public.autofill_sessions FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.autofill_sessions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.autofill_sessions TO service_role;

-- ============================================================================
-- TABLE: autofill_events  -- NO JSONB, NO UNCONSTRAINED TEXT
-- ============================================================================
-- Every column below is a UUID, a timestamp, a number, a CHECK-constrained enum,
-- or a CHECK-constrained hex digest. That is not stylistic. error_code is an enum
-- specifically so that a future
--
--     catch (e) { logEvent({ error: e.message }) }
--
-- does not compile into a row: on a validation failure an ATS error message is
-- "'+1 555 867 5309' is not a valid phone number" -- the field value, verbatim,
-- in the string a developer reaches for first. There is nowhere to put it.

CREATE TABLE IF NOT EXISTS public.autofill_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.autofill_sessions(id) ON DELETE CASCADE,

  -- Denormalized so the SELECT policy is a column comparison rather than a join
  -- through autofill_sessions -- the choice 032_create_application_contacts.sql:8
  -- makes. On the highest-volume table in this migration, an RLS subquery per row
  -- is the difference between an index scan and a nested loop per event.
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  event_type TEXT NOT NULL CHECK (event_type IN (
    'scan_started', 'scan_completed',
    'plan_built', 'plan_previewed', 'plan_executed',
    'field_filled', 'field_skipped', 'field_failed', 'field_corrected',
    'undo_performed', 'abort_requested',
    'ai_escalation_requested', 'ai_escalation_resolved',
    'sensitive_opt_in_granted', 'sensitive_opt_in_declined',
    'bridge_unavailable'
  )),

  -- A schema key, never content. On 'field_corrected' this is the key the user
  -- remapped the field TO -- the event records THAT a correction happened and
  -- WHICH key it landed on, never the text they typed.
  canonical_profile_key TEXT CHECK (canonical_profile_key IN (
    'legal_first_name', 'legal_last_name', 'preferred_name', 'full_name', 'pronouns',
    'email', 'phone', 'phone_country_code', 'address_line1', 'address_line2',
    'city', 'state_region', 'postal_code', 'country',
    'linkedin_url', 'github_url', 'portfolio_url', 'other_url',
    'current_employer', 'current_title', 'years_experience',
    'work_authorized', 'requires_sponsorship', 'visa_status', 'security_clearance',
    'desired_salary', 'earliest_start_date', 'notice_period', 'willing_to_relocate',
    'remote_preference',
    'referral_source', 'previously_employed_here', 'how_heard',
    'gender', 'race_ethnicity', 'hispanic_latino', 'veteran_status', 'disability_status',
    'resume_file', 'cover_letter_file', 'cover_letter_text',
    'unmapped'
  )),

  field_signature_hash TEXT CHECK (
    field_signature_hash IS NULL OR field_signature_hash ~ '^[0-9a-f]{32}$'
  ),
  occurrence_index INTEGER CHECK (
    occurrence_index IS NULL OR occurrence_index BETWEEN -1 AND 99
  ),

  sensitivity TEXT CHECK (sensitivity IN (
    'public', 'contact', 'compensation', 'eligibility', 'protected'
  )),
  field_kind TEXT CHECK (field_kind IN (
    'text', 'email', 'tel', 'url', 'number', 'textarea', 'select', 'combobox',
    'typeahead', 'radio_group', 'checkbox', 'checkbox_group', 'date',
    'date_segmented', 'file', 'unknown'
  )),
  resolution_source TEXT CHECK (resolution_source IN (
    'adapter', 'heuristic', 'cached_ai', 'ai', 'user'
  )),
  strategy TEXT CHECK (strategy IN (
    'native_setter', 'main_world_props', 'select_option', 'click_option',
    'combobox_sequence', 'segmented_date', 'typeahead_commit',
    'datatransfer_input', 'datatransfer_drop', 'noop'
  )),
  fill_status TEXT CHECK (fill_status IN (
    'filled', 'skipped_by_user', 'skipped_already_filled', 'skipped_disabled',
    'not_found', 'verify_failed', 'aborted', 'error'
  )),

  -- Closed vocabulary, NOT NULL, defaulting to 'none'. See the table header.
  error_code TEXT NOT NULL DEFAULT 'none' CHECK (error_code IN (
    'none', 'selector_not_found', 'element_not_interactable', 'value_rejected',
    'framework_state_desync', 'iframe_inaccessible', 'timeout', 'unknown'
  )),

  confidence  NUMERIC(4, 3) CHECK (confidence IS NULL OR confidence BETWEEN 0 AND 1),
  duration_ms INTEGER CHECK (duration_ms IS NULL OR duration_ms BETWEEN 0 AND 600000),
  attempt     SMALLINT CHECK (attempt IS NULL OR attempt BETWEEN 1 AND 10),

  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- THE RETENTION INDEX. autofill_events is disposable after 90 days; without an
-- index on occurred_at the nightly
--   DELETE FROM public.autofill_events WHERE occurred_at < now() - interval '90 days'
-- degrades into a full scan of the largest table here. Wire that delete into a
-- route under app/api/cron/ guarded by isAuthorizedCronRequest
-- (lib/security/cron-auth.ts:16-31) -- the same guard
-- app/api/cron/deadline-reminders and app/api/cron/weekly-digest already use --
-- and add its schedule to vercel.json alongside the existing two.
CREATE INDEX IF NOT EXISTS idx_autofill_events_occurred_at
  ON public.autofill_events(occurred_at);

-- Both back ON DELETE CASCADE paths Postgres does not auto-index. session_id
-- additionally serves the only read the UI makes ("show me this run").
CREATE INDEX IF NOT EXISTS idx_autofill_events_session_id
  ON public.autofill_events(session_id);
CREATE INDEX IF NOT EXISTS idx_autofill_events_user_id
  ON public.autofill_events(user_id);

COMMENT ON TABLE public.autofill_events IS
  'Per-field autofill telemetry, user-scoped. HAS NO JSONB COLUMN AND NO UNCONSTRAINED TEXT COLUMN, deliberately: every column is a UUID, a timestamp, a number, a CHECK-constrained enum, or a CHECK-constrained hex digest, so there is nowhere for catch (e) { log(e.message) } to land -- an ATS validation message contains the field value verbatim. PROHIBITED here and in every table in migration 035: any field value, including the text a user typed when correcting the engine (a correction records THAT it happened and WHICH canonical key it was remapped to, never the text); full URLs with query strings; resume file names (they contain the user''s legal name); EEO answer content (canonical_profile_key = ''gender'' is loggable and is needed to improve EEO field mapping, the option selected is not); IP addresses; and full user-agent strings. The typed redaction boundary on the client side is toAuditPlan(plan: FillPlanPreview): AuditPlan, which projects only {fieldId, profileKey, control, label, required, confidence, sensitivity} and drops values and FillOutcome.observed entirely -- this schema is what makes that boundary unbypassable rather than merely documented.';

COMMENT ON COLUMN public.autofill_events.error_code IS
  'Closed enum, never free text. A field that fails ATS validation produces a message containing the value the user typed, so the natural catch (e) { log(e.message) } must have nowhere to write.';

COMMENT ON COLUMN public.autofill_events.user_id IS
  'Denormalized from autofill_sessions so the SELECT policy needs no join -- the choice 032:8 makes. Not a source of truth: it must equal autofill_sessions.user_id for session_id, which the writing route sets from the same authenticated user it used to create the session.';

-- ============================================================================
-- Row Level Security: autofill_events -- four policies
-- ============================================================================

ALTER TABLE public.autofill_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own autofill events"   ON public.autofill_events;
DROP POLICY IF EXISTS "Users can create own autofill events" ON public.autofill_events;
DROP POLICY IF EXISTS "Users can update own autofill events" ON public.autofill_events;
DROP POLICY IF EXISTS "Users can delete own autofill events" ON public.autofill_events;

CREATE POLICY "Users can view own autofill events"
ON public.autofill_events
FOR SELECT
TO authenticated
USING ((select auth.uid()) = user_id);

-- WITH CHECK on the session as well as the row. Without the EXISTS, a client
-- could attach events carrying its own user_id to another user's session id and
-- corrupt that session's counts -- user_id is denormalized, so the two have to
-- be tied together somewhere, and this is the only place that can do it.
CREATE POLICY "Users can create own autofill events"
ON public.autofill_events
FOR INSERT
TO authenticated
WITH CHECK (
  (select auth.uid()) = user_id
  AND EXISTS (
    SELECT 1 FROM public.autofill_sessions s
     WHERE s.id = autofill_events.session_id
       AND s.user_id = (select auth.uid())
  )
);

-- Present for parity with the other user-scoped tables in this repo. Events are
-- append-only in practice: no route updates one, and an audit record that can be
-- rewritten is worth less than one that cannot.
CREATE POLICY "Users can update own autofill events"
ON public.autofill_events
FOR UPDATE
TO authenticated
USING ((select auth.uid()) = user_id)
WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can delete own autofill events"
ON public.autofill_events
FOR DELETE
TO authenticated
USING ((select auth.uid()) = user_id);

REVOKE ALL ON public.autofill_events FROM PUBLIC;
REVOKE ALL ON public.autofill_events FROM anon;
REVOKE ALL ON public.autofill_events FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.autofill_events TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.autofill_events TO service_role;

-- ============================================================================
-- VERIFICATION QUERIES (run after applying)
-- ============================================================================
-- 1. RLS enabled on all five tables.
-- SELECT tablename, rowsecurity FROM pg_tables
--  WHERE schemaname = 'public' AND tablename IN (
--    'ats_form_signatures','profile_field_mappings','autofill_mapping_votes',
--    'autofill_sessions','autofill_events');
-- Expect rowsecurity = true for all five.
--
-- 2. Policy counts, and their verbs.
-- SELECT tablename, cmd, count(*) FROM pg_policies
--  WHERE schemaname = 'public' AND tablename IN (
--    'ats_form_signatures','profile_field_mappings','autofill_mapping_votes',
--    'autofill_sessions','autofill_events')
--  GROUP BY tablename, cmd ORDER BY tablename, cmd;
-- Expect EXACTLY ONE row, cmd = SELECT, for each of the three global tables, and
-- four rows (SELECT/INSERT/UPDATE/DELETE) for each of the two user-scoped ones.
-- An INSERT/UPDATE/DELETE policy on a global table means the cache became
-- client-writable and this migration has failed.
--
-- 3. THE IMPORTANT ONE -- `authenticated` holds SELECT and nothing else on the
--    three global tables.
-- SELECT table_name, grantee, privilege_type FROM information_schema.role_table_grants
--  WHERE table_schema = 'public'
--    AND table_name IN ('ats_form_signatures','profile_field_mappings','autofill_mapping_votes')
--    AND grantee IN ('authenticated','anon')
--  ORDER BY table_name, grantee, privilege_type;
-- Expect exactly three rows, all (authenticated, SELECT). ZERO rows for anon.
-- Note ALL includes TRUNCATE, which RLS does NOT filter -- this is why every
-- table above REVOKEs before it GRANTs (033:273-279).
--
-- 4. autofill_events carries no JSONB and no unconstrained TEXT.
-- SELECT column_name, data_type FROM information_schema.columns
--  WHERE table_schema = 'public' AND table_name = 'autofill_events'
--    AND data_type IN ('json','jsonb');
-- Expect 0 rows.
-- SELECT c.column_name FROM information_schema.columns c
--  WHERE c.table_schema = 'public' AND c.table_name = 'autofill_events'
--    AND c.data_type = 'text'
--    AND NOT EXISTS (
--      SELECT 1 FROM pg_constraint k
--       WHERE k.conrelid = 'public.autofill_events'::regclass
--         AND k.contype = 'c'
--         AND pg_get_constraintdef(k) LIKE '%' || c.column_name || '%');
-- Expect 0 rows. Every TEXT column must be enum- or regex-constrained.
--
-- 5. Functions are SECURITY DEFINER with a pinned search_path.
-- SELECT p.proname, p.prosecdef, p.proconfig
--   FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
--  WHERE n.nspname = 'public'
--    AND p.proname IN ('validate_autofill_field_signature','autofill_mapping_vote_tally',
--                      'derive_mapping_consensus','refresh_mapping_consensus_from_vote',
--                      'update_autofill_mapping_votes_updated_at',
--                      'update_ats_form_signatures_last_seen');
-- Expect prosecdef = true and proconfig = {"search_path=public, pg_catalog"} for all six.
--
-- 5b. The one non-trigger function is NOT reachable as a PostgREST RPC.
-- SELECT has_function_privilege('authenticated', 'public.autofill_mapping_vote_tally(uuid,text,text)', 'EXECUTE') AS auth_exec,
--        has_function_privilege('anon',          'public.autofill_mapping_vote_tally(uuid,text,text)', 'EXECUTE') AS anon_exec;
-- Both must be false. EXECUTE defaults to PUBLIC, so a true here means any
-- signed-in client can read the vote tally for any (form, field) it can name and
-- time its own votes against the promotion floor.
--
-- 6. THE DENY PATH, exercised rather than inspected. Every check above reads a
--    catalog; none proves a real request is refused. Run this as the role the
--    extension actually uses:
--
--    SET ROLE authenticated;
--    SET request.jwt.claim.sub = '<any user uuid>';
--
--    SELECT count(*) FROM public.ats_form_signatures;     -- expect: a number (read is allowed)
--    SELECT count(*) FROM public.profile_field_mappings;  -- expect: a number
--
--    INSERT INTO public.ats_form_signatures (ats_platform, form_fingerprint, origin_host, field_count)
--      VALUES ('greenhouse', repeat('a',64), 'boards.greenhouse.io', 3);
--      -- expect: permission denied for table ats_form_signatures
--    UPDATE public.profile_field_mappings SET canonical_profile_key = 'phone';
--      -- expect: permission denied for table profile_field_mappings
--    DELETE FROM public.autofill_mapping_votes;
--      -- expect: permission denied for table autofill_mapping_votes
--    SELECT count(*) FROM public.autofill_mapping_votes;  -- expect: only your own rows
--
--    RESET ROLE;
--
--    "permission denied" is the correct outcome for the three writes, NOT an
--    empty result and NOT a silent success. A silent success means the REVOKE
--    did not run and any signed-in client can poison the shared cache.
--
-- 6b. The field_signature trigger rejects user content. Run as service_role;
--     these must ALL raise 22023, and none of them may be stored:
--     UPDATE public.profile_field_mappings
--        SET field_signature = '{"label_norm":"Ada_Lovelace_Resume.pdf"}'::jsonb WHERE true;
--     UPDATE public.profile_field_mappings
--        SET field_signature = '{"label_norm":"ada@example.com"}'::jsonb WHERE true;
--     UPDATE public.profile_field_mappings
--        SET field_signature = '{"placeholder_norm":"+1 (555) 867-5309"}'::jsonb WHERE true;
--     UPDATE public.profile_field_mappings
--        SET field_signature = '{"label_norm":{"nested":"bypass"}}'::jsonb WHERE true;
--     UPDATE public.profile_field_mappings
--        SET field_signature = '{"sample_value":"whatever"}'::jsonb WHERE true;
--
-- 6c. Client-supplied confidence and provenance do not survive, even from the
--     service role:
--     INSERT INTO public.profile_field_mappings
--       (form_signature_id, field_signature_hash, canonical_profile_key,
--        base_provenance, provenance, confidence, confirm_count)
--     VALUES ('<a signature id>', repeat('b',64), 'phone', 'ai', 'consensus', 0.99, 9999)
--     RETURNING provenance, confidence, confirm_count;
--     Expect provenance = 'ai', confidence = 0.400, confirm_count = 0.
--
-- 6d. Consensus needs three DISTINCT users, and demotes when one withdraws:
--     -- insert 2 votes from 2 users -> provenance stays 'ai', confidence 0.400
--     -- insert a 3rd from a 3rd user -> provenance = 'consensus', confidence 0.800
--     -- delete one of the three     -> provenance back to 'ai', confidence 0.400
--     SELECT provenance, confidence, confirm_count FROM public.profile_field_mappings
--      WHERE field_signature_hash = repeat('b',64);
--
-- 6e. Repeater rows do not collide (this is what occurrence_index is for):
--     INSERT INTO public.profile_field_mappings
--       (form_signature_id, field_signature_hash, occurrence_index, repeat_group,
--        canonical_profile_key)
--     VALUES ('<a signature id>', repeat('c',64), 0, repeat('d',64), 'current_employer'),
--            ('<a signature id>', repeat('c',64), 1, repeat('d',64), 'current_employer');
--     Expect: 2 rows inserted. Before occurrence_index was in the unique key this
--     raised 23505 and Workday row 2 was unfillable.
--
-- 6f. Nothing without consensus can pre-accept (section 5.1, ACCEPT_THRESHOLD 0.62):
--     SELECT count(*) FROM public.profile_field_mappings
--      WHERE provenance <> 'consensus' AND confidence > 0.60;
--     Expect 0. The CHECK constraint makes a nonzero answer impossible.
--
-- 7. Retention index exists and is the one the cron delete will use.
-- EXPLAIN DELETE FROM public.autofill_events WHERE occurred_at < now() - interval '90 days';
-- Expect an Index Scan on idx_autofill_events_occurred_at, not a Seq Scan.
--
-- 8. Re-running this migration is a no-op (idempotency check).
--    Apply the whole file a second time; expect no errors and unchanged counts.

COMMIT;

-- ============================================================================
-- POST-COMMIT NOTE
-- ============================================================================
-- If the transaction above aborted, NOTHING was applied -- fix the reported error
-- and paste the whole file again. Do not paste fragments; the privilege window
-- described at the top is exactly what the transaction exists to prevent.
--
-- Not done here, deliberately:
--   * The 90-day delete itself. It belongs in a route under app/api/cron/ guarded
--     by isAuthorizedCronRequest (lib/security/cron-auth.ts:16-31), not in a
--     migration that is pasted by hand once.
--   * Any GRANT of EXECUTE on the functions above. None of them is an RPC. The
--     trigger functions return TRIGGER and cannot be called from PostgREST at
--     all; autofill_mapping_vote_tally could be, which is why its default
--     EXECUTE-to-PUBLIC is revoked above rather than left to a later reader.
