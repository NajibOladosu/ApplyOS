-- Create screenshot_metadata table to store AI analysis of screenshots
create table public.screenshot_metadata (
  id uuid primary key default gen_random_uuid(),
  file_name text not null unique,
  storage_path text not null,
  public_url text not null,
  page_category text not null check (page_category in (
    'Dashboard', 'Applications', 'Interview', 'Documents', 
    'Upload', 'Notifications', 'Feedback', 'Profile', 'Settings'
  )),
  feature_description text not null,
  ai_analysis jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Enable RLS
alter table public.screenshot_metadata enable row level security;

-- Create policy for service role
create policy "Service role has full access"
  on public.screenshot_metadata
  for all
  using (true)
  with check (true);

-- Create index for faster queries
create index idx_screenshot_page_category on public.screenshot_metadata(page_category);

-- Create trigger for updated_at
create trigger set_updated_at
before update on public.screenshot_metadata
for each row
execute function public.handle_updated_at();
