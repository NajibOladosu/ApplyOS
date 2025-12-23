-- Create marketing_content_calendar table
create table if not exists public.marketing_content_calendar (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'pending',
  publish_at timestamptz not null default now(),
  pillar text,
  feature text,
  pain_point text,
  cta text,
  screenshot_key text,
  linkedin_copy text,
  twitter_copy text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Enable RLS
alter table public.marketing_content_calendar enable row level security;

-- Create policy for service role (optional as it bypasses RLS, but for documentation)
create policy "Service role has full access"
  on public.marketing_content_calendar
  for all
  using (true)
  with check (true);

-- Create a trigger for updated_at
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_updated_at on public.marketing_content_calendar;
create trigger set_updated_at
before update on public.marketing_content_calendar
for each row
execute function public.handle_updated_at();
