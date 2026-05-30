-- Sessions, notification metadata, and AI document foundation.
-- Apply after 20260528210000_explicit_public_grants.sql.

create extension if not exists vector with schema extensions;

create table if not exists public.user_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid not null,
  device_name text not null default 'Dispositivo desconocido',
  browser text,
  os text,
  user_agent text,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  revoked_at timestamptz,
  unique (user_id, session_id)
);

alter table public.user_sessions enable row level security;

drop policy if exists "Users can read their own sessions" on public.user_sessions;
create policy "Users can read their own sessions"
  on public.user_sessions
  for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "Users can insert their own sessions" on public.user_sessions;
create policy "Users can insert their own sessions"
  on public.user_sessions
  for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "Users can update their own sessions" on public.user_sessions;
create policy "Users can update their own sessions"
  on public.user_sessions
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create index if not exists user_sessions_user_last_seen_idx
  on public.user_sessions (user_id, last_seen_at desc);
create index if not exists user_sessions_session_idx
  on public.user_sessions (session_id);

alter table public.notifications
  add column if not exists room_id uuid,
  add column if not exists event_type text,
  add column if not exists source text,
  add column if not exists priority text not null default 'normal',
  add column if not exists metadata jsonb not null default '{}'::jsonb,
  add column if not exists read_at timestamptz;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'notifications_priority_check'
      and conrelid = 'public.notifications'::regclass
  ) then
    alter table public.notifications
      add constraint notifications_priority_check
      check (priority in ('low', 'normal', 'high', 'urgent'));
  end if;
end $$;

create index if not exists notifications_user_room_unread_idx
  on public.notifications (user_id, room_id, is_read);
create index if not exists notifications_user_event_idx
  on public.notifications (user_id, event_type, created_at desc);

create table if not exists public.ai_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid,
  title text not null,
  source_url text,
  mime_type text,
  status text not null default 'ready',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_document_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.ai_documents(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  chunk_index integer not null,
  content text not null,
  embedding vector(768),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (document_id, chunk_index)
);

alter table public.ai_documents enable row level security;
alter table public.ai_document_chunks enable row level security;

drop policy if exists "Users manage own AI documents" on public.ai_documents;
create policy "Users manage own AI documents"
  on public.ai_documents
  for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "Users manage own AI document chunks" on public.ai_document_chunks;
create policy "Users manage own AI document chunks"
  on public.ai_document_chunks
  for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create index if not exists ai_documents_user_created_idx
  on public.ai_documents (user_id, created_at desc);
create index if not exists ai_document_chunks_document_idx
  on public.ai_document_chunks (document_id, chunk_index);
create index if not exists ai_document_chunks_user_created_idx
  on public.ai_document_chunks (user_id, created_at desc);
create index if not exists ai_document_chunks_embedding_idx
  on public.ai_document_chunks using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

grant select, insert, update, delete on table public.user_sessions to authenticated;
grant select, insert, update, delete on table public.ai_documents to authenticated;
grant select, insert, update, delete on table public.ai_document_chunks to authenticated;
grant all privileges on table public.user_sessions to service_role;
grant all privileges on table public.ai_documents to service_role;
grant all privileges on table public.ai_document_chunks to service_role;
