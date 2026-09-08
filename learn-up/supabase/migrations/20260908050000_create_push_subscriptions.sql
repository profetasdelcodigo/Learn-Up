create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subscription jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint push_subscriptions_user_id_key unique (user_id),
  constraint push_subscriptions_subscription_object check (jsonb_typeof(subscription) = 'object')
);

create index if not exists idx_push_subscriptions_user_id on public.push_subscriptions(user_id);

alter table public.push_subscriptions enable row level security;

drop policy if exists push_subscriptions_select_own on public.push_subscriptions;
drop policy if exists push_subscriptions_insert_own on public.push_subscriptions;
drop policy if exists push_subscriptions_update_own on public.push_subscriptions;
drop policy if exists push_subscriptions_delete_own on public.push_subscriptions;

create policy push_subscriptions_select_own on public.push_subscriptions
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy push_subscriptions_insert_own on public.push_subscriptions
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy push_subscriptions_update_own on public.push_subscriptions
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy push_subscriptions_delete_own on public.push_subscriptions
  for delete to authenticated
  using ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.push_subscriptions to authenticated;
grant all privileges on public.push_subscriptions to service_role;
