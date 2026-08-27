create table if not exists public.welcome_emails_sent (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  sent_at timestamptz not null default now()
);

-- Enable RLS
alter table public.welcome_emails_sent enable row level security;

-- Only service role can insert (triggered by webhook/backend)
drop policy if exists "Service role can manage welcome emails" on public.welcome_emails_sent;
create policy "Service role can manage welcome emails" 
  on public.welcome_emails_sent
  for all 
  using (auth.jwt() ->> 'role' = 'service_role');
