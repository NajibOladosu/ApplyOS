-- Migration 034: restrict client-side UPDATEs on public.users to user-editable columns.
--
-- Why: the policy "Users can update own profile" (migrations 001/018) allows an
-- authenticated user to UPDATE their own row with no column restriction and no
-- WITH CHECK clause. A signed-in user could therefore write columns that only
-- server code should control, for example:
--   - email_verified, verification_token, verification_token_expires_at,
--     last_verification_email_sent (email verification state)
--   - email (which can diverge from auth.users.email)
--
-- Fix: remove the table-level UPDATE privilege from the client roles and grant
-- UPDATE only on the columns the client legitimately writes:
--   - name            (profile page, extension sync)
--   - avatar_url      (profile page, /api/account/avatar)
--   - autofill_profile(profile page, browser extension sync)
--
-- Server code that needs the other columns already uses the service-role admin
-- client, which bypasses RLS and column grants (verify-email, resend-verification,
-- auth/callback, reset-password, signup). Those paths are unaffected.
--
-- Rollback: GRANT UPDATE ON public.users TO authenticated;  (only if a regression
-- is confirmed; re-introduces the over-broad client write access).

REVOKE UPDATE ON public.users FROM authenticated;
REVOKE UPDATE ON public.users FROM anon;

GRANT UPDATE (name, avatar_url, autofill_profile) ON public.users TO authenticated;
