-- ============================================================
-- LEARN UP - MASTER MIGRATION
-- Run this script once in your Supabase SQL Editor.
-- All statements are idempotent (IF NOT EXISTS / ON CONFLICT).
-- ============================================================

-- ── 1. PROFILES (ensure socials + network columns exist) ─────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS socials   JSONB  DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS linkedin  TEXT,
  ADD COLUMN IF NOT EXISTS instagram TEXT,
  ADD COLUMN IF NOT EXISTS tiktok    TEXT,
  ADD COLUMN IF NOT EXISTS role      TEXT   DEFAULT 'estudiante',
  ADD COLUMN IF NOT EXISTS school    TEXT,
  ADD COLUMN IF NOT EXISTS grade     TEXT;

-- ── HELPER: universal uid check for text[], uuid[], or jsonb arrays ─────────
-- Works regardless of whether the column is text[], uuid[], or jsonb.
CREATE OR REPLACE FUNCTION uid_in_array(arr JSONB, uid TEXT)
RETURNS BOOLEAN LANGUAGE sql STABLE AS $$
  SELECT arr ? uid OR arr @> to_jsonb(uid);
$$;

-- Overload for uuid[] columns (native PostgreSQL array type)
CREATE OR REPLACE FUNCTION uid_in_array(arr UUID[], uid TEXT)
RETURNS BOOLEAN LANGUAGE sql STABLE AS $$
  SELECT uid::uuid = ANY(arr);
$$;

-- Overload for text[] columns
CREATE OR REPLACE FUNCTION uid_in_array(arr TEXT[], uid TEXT)
RETURNS BOOLEAN LANGUAGE sql STABLE AS $$
  SELECT uid = ANY(arr);
$$;


-- ── 2. NOTIFICATIONS ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.notifications (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  sender_id   UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  type        TEXT NOT NULL,
  title       TEXT NOT NULL DEFAULT '',
  message     TEXT NOT NULL DEFAULT '',
  link        TEXT,
  is_read     BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own notifications" ON public.notifications;
CREATE POLICY "Users can read own notifications"
  ON public.notifications FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
CREATE POLICY "Users can update own notifications"
  ON public.notifications FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Authenticated users can insert notifications" ON public.notifications;
CREATE POLICY "Authenticated users can insert notifications"
  ON public.notifications FOR INSERT TO authenticated WITH CHECK (true);

-- ── 3. LIBRARY ITEMS ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.library_items (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  reviewer_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  title       TEXT NOT NULL,
  description TEXT DEFAULT '',
  subject     TEXT DEFAULT '',
  file_url    TEXT NOT NULL,
  file_type   TEXT DEFAULT 'document',
  is_approved BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL,
  updated_at  TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL
);

ALTER TABLE public.library_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Approved items are public" ON public.library_items;
CREATE POLICY "Approved items are public"
  ON public.library_items FOR SELECT USING (is_approved = true OR user_id = auth.uid() OR reviewer_id = auth.uid());

DROP POLICY IF EXISTS "Owners can insert library items" ON public.library_items;
CREATE POLICY "Owners can insert library items"
  ON public.library_items FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Reviewer can update library items" ON public.library_items;
CREATE POLICY "Reviewer can update library items"
  ON public.library_items FOR UPDATE USING (auth.uid() = reviewer_id OR auth.uid() = user_id);

DROP POLICY IF EXISTS "Reviewer can delete library items" ON public.library_items;
CREATE POLICY "Reviewer can delete library items"
  ON public.library_items FOR DELETE USING (auth.uid() = reviewer_id OR auth.uid() = user_id);

-- ── 4. USER MEDIA (Álbum del Saber) ──────────────────────────
CREATE TABLE IF NOT EXISTS public.user_media (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  file_url    TEXT NOT NULL,
  file_type   TEXT NOT NULL DEFAULT 'photo',  -- photo | video | audio | document
  source      TEXT DEFAULT 'camera',          -- camera | library | chat | ai
  title       TEXT,
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL
);

ALTER TABLE public.user_media ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own media" ON public.user_media;
CREATE POLICY "Users can manage own media"
  ON public.user_media FOR ALL USING (auth.uid() = user_id);

-- ── 5. AI SESSIONS ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ai_sessions (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  ai_type    TEXT NOT NULL,
  title      TEXT NOT NULL DEFAULT 'Nueva Sesión',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL
);

ALTER TABLE public.ai_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own ai_sessions" ON public.ai_sessions;
CREATE POLICY "Users can manage their own ai_sessions"
  ON public.ai_sessions FOR ALL USING (auth.uid() = user_id);

-- ── 6. AI MESSAGES ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ai_messages (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID REFERENCES public.ai_sessions(id) ON DELETE CASCADE,
  role       TEXT NOT NULL DEFAULT 'user',
  content    TEXT NOT NULL DEFAULT '',
  media_url  TEXT,
  media_type TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL
);

ALTER TABLE public.ai_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage messages in their ai_sessions" ON public.ai_messages;
CREATE POLICY "Users can manage messages in their ai_sessions"
  ON public.ai_messages FOR ALL
  USING (
    session_id IN (SELECT id FROM public.ai_sessions WHERE user_id = auth.uid())
  );

-- ── 7. SHARED CALENDARS ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.shared_calendars (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT NOT NULL,
  created_by  UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  members     JSONB DEFAULT '[]'::jsonb,  -- Array of user UUIDs
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL
);

ALTER TABLE public.shared_calendars ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can access shared calendars" ON public.shared_calendars;
CREATE POLICY "Members can access shared calendars"
  ON public.shared_calendars FOR ALL
  USING (
    uid_in_array(members, auth.uid()::text)
    OR created_by = auth.uid()
  );

-- ── 8. SHARED CALENDAR EVENTS ────────────────────────────────
CREATE TABLE IF NOT EXISTS public.shared_calendar_events (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  calendar_id UUID REFERENCES public.shared_calendars(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  description TEXT DEFAULT '',
  start_time  TIMESTAMP WITH TIME ZONE,
  end_time    TIMESTAMP WITH TIME ZONE,
  created_by  UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL
);

ALTER TABLE public.shared_calendar_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Calendar members can manage events" ON public.shared_calendar_events;
CREATE POLICY "Calendar members can manage events"
  ON public.shared_calendar_events FOR ALL
  USING (
    calendar_id IN (
      SELECT id FROM public.shared_calendars
      WHERE uid_in_array(members, auth.uid()::text) OR created_by = auth.uid()
    )
  );

-- ── 9. SHARED CALENDAR MESSAGES ──────────────────────────────
CREATE TABLE IF NOT EXISTS public.shared_calendar_messages (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  calendar_id UUID REFERENCES public.shared_calendars(id) ON DELETE CASCADE,
  user_id     UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  content     TEXT NOT NULL,
  type        TEXT DEFAULT 'text',  -- 'text' | 'audio' | 'system'
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL
);

ALTER TABLE public.shared_calendar_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Calendar members can manage messages" ON public.shared_calendar_messages;
CREATE POLICY "Calendar members can manage messages"
  ON public.shared_calendar_messages FOR ALL
  USING (
    calendar_id IN (
      SELECT id FROM public.shared_calendars
      WHERE uid_in_array(members, auth.uid()::text) OR created_by = auth.uid()
    )
  );

-- ── 10. FRIENDSHIPS ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.friendships (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  friend_id   UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  status      TEXT NOT NULL DEFAULT 'pending',  -- 'pending' | 'accepted' | 'rejected'
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL,
  UNIQUE(user_id, friend_id)
);

ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their friendships" ON public.friendships;
CREATE POLICY "Users can manage their friendships"
  ON public.friendships FOR ALL
  USING (auth.uid() = user_id OR auth.uid() = friend_id);

-- ── 11. CHAT ROOMS ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.chat_rooms (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type                TEXT NOT NULL DEFAULT 'private',  -- 'private' | 'group'
  name                TEXT,
  participants        JSONB DEFAULT '[]'::jsonb,
  admins              JSONB DEFAULT '[]'::jsonb,
  avatar_url          TEXT,
  description         TEXT,
  last_message        TEXT,
  only_admins_message BOOLEAN DEFAULT false,
  updated_at          TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL,
  created_at          TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL
);

ALTER TABLE public.chat_rooms ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Participants can access chat rooms" ON public.chat_rooms;
CREATE POLICY "Participants can access chat rooms"
  ON public.chat_rooms FOR ALL
  USING (
    -- Supports JSONB array, text[], or uuid[] columns
    auth.uid()::text = ANY(
      ARRAY(SELECT jsonb_array_elements_text(
        CASE jsonb_typeof(participants)
          WHEN 'array' THEN participants
          ELSE to_jsonb(ARRAY[]::text[])
        END
      ))
    )
  );

DROP POLICY IF EXISTS "Authenticated users can create chat rooms" ON public.chat_rooms;
CREATE POLICY "Authenticated users can create chat rooms"
  ON public.chat_rooms FOR INSERT TO authenticated WITH CHECK (true);

-- ── 12. CHAT MESSAGES ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id                 UUID REFERENCES public.chat_rooms(id) ON DELETE CASCADE,
  user_id                 UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  content                 TEXT NOT NULL DEFAULT '',
  is_edited               BOOLEAN DEFAULT false,
  is_deleted_for_everyone BOOLEAN DEFAULT false,
  deleted_for             JSONB DEFAULT '[]'::jsonb,
  created_at              TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL,
  updated_at              TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL
);

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Room participants can access messages" ON public.chat_messages;
CREATE POLICY "Room participants can access messages"
  ON public.chat_messages FOR ALL
  USING (
    room_id IN (
      SELECT id FROM public.chat_rooms
      WHERE auth.uid()::text = ANY(
        ARRAY(SELECT jsonb_array_elements_text(
          CASE jsonb_typeof(participants)
            WHEN 'array' THEN participants
            ELSE to_jsonb(ARRAY[]::text[])
          END
        ))
      )
    )
  );

-- ── 13. PUSH SUBSCRIPTIONS ───────────────────────────────────
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  endpoint   TEXT NOT NULL,
  keys       JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL,
  UNIQUE(user_id, endpoint)
);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their push subscriptions" ON public.push_subscriptions;
CREATE POLICY "Users can manage their push subscriptions"
  ON public.push_subscriptions FOR ALL USING (auth.uid() = user_id);

-- ── 14. CALENDAR EVENTS (personal) ───────────────────────────
CREATE TABLE IF NOT EXISTS public.calendar_events (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  description TEXT DEFAULT '',
  start_time  TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time    TIMESTAMP WITH TIME ZONE,
  color       TEXT DEFAULT '#D4AF37',
  is_shared   BOOLEAN DEFAULT false,
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL
);

ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their calendar events" ON public.calendar_events;
CREATE POLICY "Users can manage their calendar events"
  ON public.calendar_events FOR ALL USING (auth.uid() = user_id);

-- ── 15. HABIT TRACKER ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.habit_entries (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  habit_name TEXT NOT NULL,
  week_start DATE NOT NULL,  -- YYYY-MM-DD of the Monday for that week
  completed  JSONB DEFAULT '[]'::jsonb,  -- Array of day indices (0=Mon..6=Sun) that are done
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL,
  UNIQUE(user_id, habit_name, week_start)
);

ALTER TABLE public.habit_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their habit entries" ON public.habit_entries;
CREATE POLICY "Users can manage their habit entries"
  ON public.habit_entries FOR ALL USING (auth.uid() = user_id);

-- ── FUNCTIONS: auto-update updated_at ────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Auto-trigger for ai_sessions
DROP TRIGGER IF EXISTS update_ai_sessions_updated_at_trigger ON public.ai_sessions;
CREATE TRIGGER update_ai_sessions_updated_at_trigger
  BEFORE UPDATE ON public.ai_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Auto-trigger for library_items
DROP TRIGGER IF EXISTS update_library_items_updated_at_trigger ON public.library_items;
CREATE TRIGGER update_library_items_updated_at_trigger
  BEFORE UPDATE ON public.library_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── STORAGE BUCKETS ───────────────────────────────────────────
-- ai_media: for AI input files (images, pdfs, audio for Groq)
INSERT INTO storage.buckets (id, name, public, file_size_limit)
  VALUES ('ai_media', 'ai_media', true, 52428800)
  ON CONFLICT (id) DO NOTHING;

-- user-media: for Album del Saber (photos, videos captured)
INSERT INTO storage.buckets (id, name, public, file_size_limit)
  VALUES ('user-media', 'user-media', true, 104857600)
  ON CONFLICT (id) DO NOTHING;

-- library: for Biblioteca del Sabio uploaded files
INSERT INTO storage.buckets (id, name, public, file_size_limit)
  VALUES ('library', 'library', true, 52428800)
  ON CONFLICT (id) DO NOTHING;

-- chat-media: for file attachments in chat
INSERT INTO storage.buckets (id, name, public, file_size_limit)
  VALUES ('chat-media', 'chat-media', true, 52428800)
  ON CONFLICT (id) DO NOTHING;

-- ── STORAGE POLICIES ─────────────────────────────────────────
-- ai_media: authenticated users can upload to their own folder
DROP POLICY IF EXISTS "Users can upload ai_media" ON storage.objects;
CREATE POLICY "Users can upload ai_media"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'ai_media' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Users can read ai_media" ON storage.objects;
CREATE POLICY "Users can read ai_media"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'ai_media');

-- user-media
DROP POLICY IF EXISTS "Users can upload user-media" ON storage.objects;
CREATE POLICY "Users can upload user-media"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'user-media' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Users can read user-media" ON storage.objects;
CREATE POLICY "Users can read user-media"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'user-media');

-- library
DROP POLICY IF EXISTS "Users can upload to library" ON storage.objects;
CREATE POLICY "Users can upload to library"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'library');

DROP POLICY IF EXISTS "Public can read library" ON storage.objects;
CREATE POLICY "Public can read library"
  ON storage.objects FOR SELECT USING (bucket_id = 'library');

-- chat-media
DROP POLICY IF EXISTS "Users can upload chat-media" ON storage.objects;
CREATE POLICY "Users can upload chat-media"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'chat-media');

DROP POLICY IF EXISTS "Users can read chat-media" ON storage.objects;
CREATE POLICY "Users can read chat-media"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'chat-media');

-- ── REALTIME ENABLE (for live features) ────────────────────────
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.shared_calendar_messages;

-- ── 16. SHARED HABIT TRACKER (Group Habits inside Shared Calendars) ────────
CREATE TABLE IF NOT EXISTS public.shared_habit_tracker (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  calendar_id UUID REFERENCES public.shared_calendars(id) ON DELETE CASCADE,
  week_start  DATE NOT NULL,  -- Monday date for the week
  habits      JSONB DEFAULT '[]'::jsonb,  -- Array of HabitActivity objects
  updated_by  UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_at  TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL,
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL,
  UNIQUE(calendar_id, week_start)
);

ALTER TABLE public.shared_habit_tracker ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Calendar members can manage shared habits" ON public.shared_habit_tracker;
CREATE POLICY "Calendar members can manage shared habits"
  ON public.shared_habit_tracker FOR ALL
  USING (
    calendar_id IN (
      SELECT id FROM public.shared_calendars
      WHERE uid_in_array(members, auth.uid()::text) OR created_by = auth.uid()
    )
  );

-- ── chat_files bucket (for audio recordings in shared calendar chat) ────────
INSERT INTO storage.buckets (id, name, public, file_size_limit)
  VALUES ('chat_files', 'chat_files', true, 52428800)
  ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Users can upload to chat_files" ON storage.objects;
CREATE POLICY "Users can upload to chat_files"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'chat_files');

DROP POLICY IF EXISTS "Users can read chat_files" ON storage.objects;
CREATE POLICY "Users can read chat_files"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'chat_files');

