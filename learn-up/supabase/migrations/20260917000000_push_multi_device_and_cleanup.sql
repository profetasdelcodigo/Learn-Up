alter table public.push_subscriptions drop constraint if exists push_subscriptions_user_id_key;

create unique index if not exists push_subscriptions_user_endpoint_key
  on public.push_subscriptions (user_id, (subscription ->> 'endpoint'));

create index if not exists idx_push_subscriptions_endpoint
  on public.push_subscriptions ((subscription ->> 'endpoint'));
