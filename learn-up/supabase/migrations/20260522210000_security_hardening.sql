-- Security hardening for Learn Up.
-- Apply together with the matching application code changes.

-- Server-only quota accounting.
alter table public.api_usage enable row level security;
drop policy if exists "api_usage_service_role_all" on public.api_usage;
create policy "api_usage_service_role_all"
on public.api_usage
for all
to service_role
using (true)
with check (true);

-- Users can no longer grant themselves elevated profile roles.
create or replace function public.enforce_profile_role_integrity()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.role is null or new.role = '' then
      new.role := 'estudiante';
    end if;

    -- Allow 'estudiante' and 'docente' from client side; protect 'admin'.
    if coalesce((select auth.role()), 'authenticated') <> 'service_role'
      and new.role not in ('estudiante', 'docente') then
      new.role := 'estudiante';
    end if;

    if new.role not in ('estudiante', 'docente', 'admin') then
      new.role := 'estudiante';
    end if;

    return new;
  end if;

  -- Protect against unauthorized role escalation (e.g. to admin) from client.
  -- Allow switching between 'estudiante' and 'docente' for now as requested.
  if coalesce((select auth.role()), 'authenticated') <> 'service_role'
    and new.role is distinct from old.role
    and new.role not in ('estudiante', 'docente') then
    new.role := old.role;
  end if;

  if new.role is null or new.role = '' then
    new.role := 'estudiante';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_profile_role_integrity() from public, anon, authenticated;

drop trigger if exists trg_enforce_profile_role_integrity on public.profiles;
create trigger trg_enforce_profile_role_integrity
before insert or update on public.profiles
for each row
execute function public.enforce_profile_role_integrity();

do $$
begin
  alter table public.profiles
    add constraint profiles_role_allowed
    check (role in ('estudiante', 'docente', 'admin'));
exception
  when duplicate_object then null;
end $$;

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles
for update
to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

-- Do not expose the older SECURITY DEFINER username helper to client roles.
do $$
begin
  revoke execute on function public.check_username(text) from anon, authenticated;
exception
  when undefined_function then null;
end $$;

-- Restrict cross-user notification creation to trusted server code.
drop policy if exists "notifications_insert_authenticated" on public.notifications;
drop policy if exists "notifications_insert_self" on public.notifications;
create policy "notifications_insert_self"
on public.notifications
for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and (sender_id is null or sender_id = (select auth.uid()))
);

-- A requester should not be able to accept their own pending friendship.
drop policy if exists "friendships_update_participant" on public.friendships;
drop policy if exists "friendships_update_addressee" on public.friendships;
create policy "friendships_update_addressee"
on public.friendships
for update
to authenticated
using (addressee_id = (select auth.uid()))
with check (addressee_id = (select auth.uid()));

-- Only group admins can update chat room metadata/membership directly.
-- Server actions use the service role for participant self-leave and timestamp updates.
drop policy if exists "chat_rooms_update_participant" on public.chat_rooms;
drop policy if exists "chat_rooms_update_admin" on public.chat_rooms;
create policy "chat_rooms_update_admin"
on public.chat_rooms
for update
to authenticated
using ((select auth.uid()) = any(admins))
with check ((select auth.uid()) = any(admins));

-- Remove overly broad habit policies; narrower own/member policies already exist.
drop policy if exists "Permitir todo a autenticados en personal habits" on public.personal_habit_tracker;
drop policy if exists "Permitir todo a autenticados en habits" on public.shared_habit_tracker;

-- Remove broad storage read/list and unrestricted upload policies.
drop policy if exists "Acceso público de lectura" on storage.objects;
drop policy if exists "Acceso público lectura avatars" on storage.objects;
drop policy if exists "Acceso público lectura library" on storage.objects;
drop policy if exists "Avatars públicos" on storage.objects;
drop policy if exists "Chat media público" on storage.objects;
drop policy if exists "Lectura pública" on storage.objects;
drop policy if exists "Public can read avatars" on storage.objects;
drop policy if exists "Public can read library" on storage.objects;
drop policy if exists "Users can read ai_media" on storage.objects;
drop policy if exists "Users can read chat-media" on storage.objects;
drop policy if exists "Users can read chat_files" on storage.objects;
drop policy if exists "Users can read user-media" on storage.objects;

drop policy if exists "Subida autenticada" on storage.objects;
drop policy if exists "Subida usuarios autenticados avatars" on storage.objects;
drop policy if exists "Subida usuarios autenticados library" on storage.objects;
drop policy if exists "Users can upload avatars" on storage.objects;
drop policy if exists "Users can upload chat-media" on storage.objects;
drop policy if exists "Users can upload to chat_files" on storage.objects;
drop policy if exists "Users can upload to library" on storage.objects;
drop policy if exists "Usuarios pueden subir archivos" on storage.objects;
drop policy if exists "Usuarios suben chat media" on storage.objects;
drop policy if exists "Usuarios suben su avatar" on storage.objects;

drop policy if exists "storage_upload_avatars_own_folder" on storage.objects;
create policy "storage_upload_avatars_own_folder"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and lower(storage.extension(name)) in ('jpg', 'jpeg', 'png', 'webp')
);

drop policy if exists "storage_upload_library_own_folder" on storage.objects;
create policy "storage_upload_library_own_folder"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'library'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "storage_upload_chat_media_room_user_folder" on storage.objects;
create policy "storage_upload_chat_media_room_user_folder"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'chat-media'
  and (storage.foldername(name))[2] = (select auth.uid())::text
  and exists (
    select 1
    from public.chat_rooms room
    where room.id::text = (storage.foldername(name))[1]
      and (select auth.uid()) = any(room.participants)
  )
);

drop policy if exists "storage_upload_chat_files_shared_audio_user_folder" on storage.objects;
create policy "storage_upload_chat_files_shared_audio_user_folder"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'chat_files'
  and (storage.foldername(name))[1] = 'shared_audios'
  and (storage.foldername(name))[2] = (select auth.uid())::text
);

drop policy if exists "storage_read_avatars_public" on storage.objects;
create policy "storage_read_avatars_public"
on storage.objects
for select
to anon, authenticated
using (bucket_id = 'avatars');

drop policy if exists "storage_update_avatars_own_folder" on storage.objects;
create policy "storage_update_avatars_own_folder"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
)
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and lower(storage.extension(name)) in ('jpg', 'jpeg', 'png', 'webp')
);

drop policy if exists "storage_delete_avatars_own_folder" on storage.objects;
create policy "storage_delete_avatars_own_folder"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "storage_read_library_authenticated" on storage.objects;
create policy "storage_read_library_authenticated"
on storage.objects
for select
to authenticated
using (bucket_id = 'library');

drop policy if exists "storage_update_library_own_folder" on storage.objects;
create policy "storage_update_library_own_folder"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'library'
  and (storage.foldername(name))[1] = (select auth.uid())::text
)
with check (
  bucket_id = 'library'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "storage_delete_library_own_folder" on storage.objects;
create policy "storage_delete_library_own_folder"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'library'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "storage_read_ai_media_own_folder" on storage.objects;
create policy "storage_read_ai_media_own_folder"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'ai_media'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "storage_upload_ai_media_own_folder" on storage.objects;
create policy "storage_upload_ai_media_own_folder"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'ai_media'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and lower(storage.extension(name)) in (
    'pdf', 'txt', 'md', 'doc', 'docx', 'pptx', 'xlsx',
    'jpg', 'jpeg', 'png', 'webp', 'gif',
    'mp3', 'wav', 'ogg', 'm4a', 'mp4'
  )
);

drop policy if exists "storage_update_ai_media_own_folder" on storage.objects;
create policy "storage_update_ai_media_own_folder"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'ai_media'
  and (storage.foldername(name))[1] = (select auth.uid())::text
)
with check (
  bucket_id = 'ai_media'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "storage_delete_ai_media_own_folder" on storage.objects;
create policy "storage_delete_ai_media_own_folder"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'ai_media'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "storage_read_user_media_own_folder" on storage.objects;
create policy "storage_read_user_media_own_folder"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'user-media'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "storage_upload_user_media_own_folder" on storage.objects;
create policy "storage_upload_user_media_own_folder"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'user-media'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and lower(storage.extension(name)) in (
    'pdf', 'doc', 'docx', 'jpg', 'jpeg', 'png', 'webp',
    'gif', 'mp3', 'wav', 'ogg', 'm4a', 'mp4', 'webm'
  )
);

drop policy if exists "storage_update_user_media_own_folder" on storage.objects;
create policy "storage_update_user_media_own_folder"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'user-media'
  and (storage.foldername(name))[1] = (select auth.uid())::text
)
with check (
  bucket_id = 'user-media'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "storage_delete_user_media_own_folder" on storage.objects;
create policy "storage_delete_user_media_own_folder"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'user-media'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "storage_read_chat_media_room_participant" on storage.objects;
create policy "storage_read_chat_media_room_participant"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'chat-media'
  and exists (
    select 1
    from public.chat_rooms room
    where room.id::text = (storage.foldername(name))[1]
      and (select auth.uid()) = any(room.participants)
  )
);

drop policy if exists "storage_update_chat_media_own_upload" on storage.objects;
create policy "storage_update_chat_media_own_upload"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'chat-media'
  and (storage.foldername(name))[2] = (select auth.uid())::text
)
with check (
  bucket_id = 'chat-media'
  and (storage.foldername(name))[2] = (select auth.uid())::text
);

drop policy if exists "storage_delete_chat_media_own_upload" on storage.objects;
create policy "storage_delete_chat_media_own_upload"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'chat-media'
  and (storage.foldername(name))[2] = (select auth.uid())::text
);

drop policy if exists "storage_read_chat_files_authenticated" on storage.objects;
create policy "storage_read_chat_files_authenticated"
on storage.objects
for select
to authenticated
using (bucket_id = 'chat_files');

drop policy if exists "storage_update_chat_files_shared_audio_user_folder" on storage.objects;
create policy "storage_update_chat_files_shared_audio_user_folder"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'chat_files'
  and (storage.foldername(name))[1] = 'shared_audios'
  and (storage.foldername(name))[2] = (select auth.uid())::text
)
with check (
  bucket_id = 'chat_files'
  and (storage.foldername(name))[1] = 'shared_audios'
  and (storage.foldername(name))[2] = (select auth.uid())::text
);

drop policy if exists "storage_delete_chat_files_shared_audio_user_folder" on storage.objects;
create policy "storage_delete_chat_files_shared_audio_user_folder"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'chat_files'
  and (storage.foldername(name))[1] = 'shared_audios'
  and (storage.foldername(name))[2] = (select auth.uid())::text
);

-- Foreign-key and lookup indexes flagged by Supabase advisors.
create index if not exists idx_ai_messages_session_id on public.ai_messages(session_id);
create index if not exists idx_ai_sessions_user_id on public.ai_sessions(user_id);
create index if not exists idx_calendar_events_user_id on public.calendar_events(user_id);
create index if not exists idx_calendar_events_shared_calendar_id on public.calendar_events(shared_calendar_id);
create index if not exists idx_chat_messages_room_id on public.chat_messages(room_id);
create index if not exists idx_chat_messages_user_id on public.chat_messages(user_id);
create index if not exists idx_chat_rooms_participants_gin on public.chat_rooms using gin(participants);
create index if not exists idx_chat_rooms_admins_gin on public.chat_rooms using gin(admins);
create index if not exists idx_friendships_requester_id on public.friendships(requester_id);
create index if not exists idx_friendships_addressee_id on public.friendships(addressee_id);
create index if not exists idx_library_items_user_id on public.library_items(user_id);
create index if not exists idx_library_items_reviewer_id on public.library_items(reviewer_id);
create index if not exists idx_notifications_user_id on public.notifications(user_id);
create index if not exists idx_notifications_sender_id on public.notifications(sender_id);
create index if not exists idx_push_subscriptions_user_id on public.push_subscriptions(user_id);
create index if not exists idx_shared_calendar_events_calendar_id on public.shared_calendar_events(calendar_id);
create index if not exists idx_shared_calendar_events_created_by on public.shared_calendar_events(created_by);
create index if not exists idx_shared_calendar_messages_calendar_id on public.shared_calendar_messages(calendar_id);
create index if not exists idx_shared_calendar_messages_user_id on public.shared_calendar_messages(user_id);
create index if not exists idx_shared_calendar_members_calendar_id on public.shared_calendar_members(calendar_id);
create index if not exists idx_shared_calendar_members_user_id on public.shared_calendar_members(user_id);
create index if not exists idx_shared_calendars_owner_id on public.shared_calendars(owner_id);
create index if not exists idx_shared_calendars_created_by on public.shared_calendars(created_by);
create index if not exists idx_shared_calendars_members_gin on public.shared_calendars using gin(members);
create index if not exists idx_personal_habit_tracker_user_id on public.personal_habit_tracker(user_id);
create index if not exists idx_shared_habit_tracker_calendar_id on public.shared_habit_tracker(calendar_id);
create index if not exists idx_shared_habit_tracker_updated_by on public.shared_habit_tracker(updated_by);
create index if not exists idx_user_media_user_id on public.user_media(user_id);
