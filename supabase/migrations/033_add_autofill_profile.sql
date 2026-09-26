-- Autofill profile storage for the browser extension.
--
-- The extension's autofill engine (field registry -> matcher -> plan -> fill)
-- is driven by a structured profile: identity, contact, links, work,
-- eligibility, education, voluntary EEO answers, open-ended answers, and the
-- saved-answers library learned from past applications.
--
-- The web app is the source of truth so the profile syncs across devices and
-- browsers; the extension keeps a chrome.storage.local cache for offline use
-- and pushes edits back up. Storing it as a single jsonb column (rather than
-- normalised tables) matches how the profile is actually consumed: it is read
-- and written as one document, never queried field-by-field.
--
-- RLS: the existing "Users can view/update own profile" policies on
-- public.users cover the new column, so no new policies are needed.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS autofill_profile JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.users.autofill_profile IS
  'Autofill profile document consumed by the ApplyOS browser extension. Shaped by extension/src/shared/profile.ts (AutofillProfile). Never queried field-by-field; read and written whole.';
