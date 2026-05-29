-- Explicit Data API grants for Supabase's 2026 opt-in exposure model.
--
-- Grants only make objects reachable by PostgREST/GraphQL/supabase-js.
-- Row visibility and writes are still controlled by RLS policies.

grant usage on schema public to anon, authenticated, service_role;

-- Trusted server role.
grant all privileges on all tables in schema public to service_role;
grant all privileges on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;

alter default privileges for role postgres in schema public
  grant all privileges on tables to service_role;
alter default privileges for role postgres in schema public
  grant all privileges on sequences to service_role;
alter default privileges for role postgres in schema public
  grant execute on functions to service_role;

-- Signed-in app users. Keep this list explicit; do not grant ALL on the schema
-- to anon/authenticated. Add new tables here when app code needs Data API access.
do $$
declare
  table_grants jsonb := jsonb_build_object(
    'ai_media', 'select, insert, update, delete',
    'ai_messages', 'select, insert, update, delete',
    'ai_sessions', 'select, insert, update, delete',
    'calendar_events', 'select, insert, update, delete',
    'chat_messages', 'select, insert, update, delete',
    'chat_rooms', 'select, insert, update, delete',
    'friendships', 'select, insert, update, delete',
    'habits', 'select, insert, update, delete',
    'knowledge_edges', 'select, insert, update, delete',
    'knowledge_nodes', 'select, insert, update, delete',
    'library_favorites', 'select, insert, update, delete',
    'library_items', 'select, insert, update, delete',
    'notifications', 'select, insert, update, delete',
    'personal_habit_tracker', 'select, insert, update, delete',
    'profiles', 'select, insert, update',
    'push_subscriptions', 'select, insert, update, delete',
    'shared_calendar_events', 'select, insert, update, delete',
    'shared_calendar_members', 'select, insert, update, delete',
    'shared_calendar_messages', 'select, insert, update, delete',
    'shared_calendars', 'select, insert, update, delete',
    'shared_habit_tracker', 'select, insert, update, delete',
    'user_media', 'select, insert, update, delete'
  );
  item record;
begin
  for item in select key as table_name, value as privileges from jsonb_each_text(table_grants)
  loop
    if to_regclass(format('public.%I', item.table_name)) is not null then
      execute format(
        'grant %s on table public.%I to authenticated',
        item.privileges,
        item.table_name
      );
    end if;
  end loop;
end $$;

-- Read-only app views used by signed-in users.
do $$
declare
  view_name text;
begin
  foreach view_name in array array['friends_with_profiles']
  loop
    if to_regclass(format('public.%I', view_name)) is not null then
      execute format('grant select on table public.%I to authenticated', view_name);
    end if;
  end loop;
end $$;

-- Sequences used by authenticated inserts into tables with sequence-backed ids.
grant usage, select on all sequences in schema public to authenticated;

-- RPCs intentionally exposed to signed-in app users.
do $$
declare
  fn record;
begin
  for fn in
    select p.oid::regprocedure as signature
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'check_username_availability',
        'match_knowledge_nodes'
      )
  loop
    execute format('grant execute on function %s to authenticated', fn.signature);
  end loop;
end $$;

-- No anonymous table access is required by the current app.
-- If a future public read endpoint is intentional, grant SELECT on that table
-- explicitly and keep RLS enabled.
