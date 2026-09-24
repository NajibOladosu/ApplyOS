#!/bin/bash
# Fail the build if a server-side secret reached a shipped bundle.
#
# webpack.config.js points dotenv-webpack at the REPO ROOT .env.local with
# safe:false, so every variable in that file -- SUPABASE_SERVICE_ROLE_KEY,
# GEMINI_API_KEY, DKIM_PRIVATE_KEY -- is available for inlining. Only
# NEXT_PUBLIC_* values are referenced today, but a single future
# `process.env.SUPABASE_SERVICE_ROLE_KEY` would be substituted verbatim into a
# world-readable file that ships to every user. This is the gate.
#
# The anon key is expected in the bundle and is not a finding: it is public by
# design and is what RLS is written against.
set -uo pipefail
DIST="${1:-dist/chrome}"

if [ ! -d "$DIST" ]; then
  echo "check-secrets: $DIST does not exist — run the build first" >&2
  exit 1
fi

status=0
scan() {
  local label="$1" pattern="$2"
  local hits
  hits=$(grep -rlE "$pattern" "$DIST" 2>/dev/null || true)
  if [ -n "$hits" ]; then
    echo "check-secrets: FAIL — $label found in:" >&2
    echo "$hits" | sed 's/^/  /' >&2
    status=1
  fi
}

scan "service_role JWT or literal"      'service_role'
scan "Google/Gemini API key"            'AIza[0-9A-Za-z_-]{10,}'
scan "PEM private key"                  'BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY'
scan "Resend API key"                   're_[A-Za-z0-9]{20,}'
scan "Supabase service-role env name"   'SUPABASE_SERVICE_ROLE_KEY'
scan "CRON_SECRET"                      'CRON_SECRET'
scan "unsubscribe signing secret"       'UNSUBSCRIBE_SIGNING_SECRET'

if [ "$status" -eq 0 ]; then
  echo "check-secrets: OK — no server-side secret found in $DIST"
fi
exit "$status"
