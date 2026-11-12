-- Credentials are encrypted in the application before insertion. No browser role
-- can read this table, including its ciphertext. The service role is used only
-- after authenticating the requesting user in an API route.
create table if not exists public.user_ai_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  text_source text not null default 'applyos' check (text_source in ('applyos', 'claude', 'openai', 'gemini')),
  audio_source text not null default 'applyos' check (audio_source in ('applyos', 'openai', 'gemini')),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_ai_connections (
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('claude', 'openai', 'gemini')),
  encrypted_key text not null,
  tested_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  primary key (user_id, provider)
);

alter table public.user_ai_preferences enable row level security;
alter table public.user_ai_connections enable row level security;
revoke all on public.user_ai_preferences from anon, authenticated;
revoke all on public.user_ai_connections from anon, authenticated;
-- No client policies: service-role access is intentionally server-only.
