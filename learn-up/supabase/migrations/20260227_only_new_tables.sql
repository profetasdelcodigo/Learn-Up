-- ============================================================
-- LEARN UP - ONLY NEW TABLES (Safe to run on existing DB)
-- This script ONLY creates tables that are NEW to the project.
-- Existing tables (profiles, notifications, chat_rooms, etc.) 
-- are NOT touched to avoid conflicts.
-- ============================================================

-- ── STEP 1: Safe helper functions ────────────────────────────
CREATE OR REPLACE FUNCTION uid_in_array(arr JSONB, uid TEXT)
RETURNS BOOLEAN LANGUAGE sql STABLE AS $$
  SELECT arr ? uid OR arr @> to_jsonb(uid);
$$;

CREATE OR REPLACE FUNCTION uid_in_array(arr UUID[], uid TEXT)
RETURNS BOOLEAN LANGUAGE sql STABLE AS $$
  SELECT uid::uuid = ANY(arr);
$$;

CREATE OR REPLACE FUNCTION uid_in_array(arr TEXT[], uid TEXT)
RETURNS BOOLEAN LANGUAGE sql STABLE AS $$
  SELECT uid = ANY(arr);
$$;

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ── STEP 2: Add missing columns to profiles ──────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS socials   JSONB  DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS role      TEXT   DEFAULT 'estudiante',
  ADD COLUMN IF NOT EXISTS school    TEXT,
  ADD COLUMN IF NOT EXISTS grade     TEXT;

-- ── STEP 3: LIBRARY ITEMS (NEW) ──────────────────────────────
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
CREATE POLICY "Approved items are public" ON public.library_items
  FOR SELECT USING (is_approved = true OR user_id = auth.uid() OR reviewer_id = auth.uid());
DROP POLICY IF EXISTS "Owners can insert library items" ON public.library_items;
CREATE POLICY "Owners can insert library items" ON public.library_items
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Reviewer can update library items" ON public.library_items;
CREATE POLICY "Reviewer can update library items" ON public.library_items
  FOR UPDATE USING (auth.uid() = reviewer_id OR auth.uid() = user_id);
DROP POLICY IF EXISTS "Reviewer can delete library items" ON public.library_items;
CREATE POLICY "Reviewer can delete library items" ON public.library_items
  FOR DELETE USING (auth.uid() = reviewer_id OR auth.uid() = user_id);

-- ── STEP 4: USER MEDIA - Álbum del Saber (NEW) ───────────────
CREATE TABLE IF NOT EXISTS public.user_media (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  file_url    TEXT NOT NULL,
  file_type   TEXT NOT NULL DEFAULT 'photo',
  source      TEXT DEFAULT 'camera',
  title       TEXT,
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL
);

ALTER TABLE public.user_media ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own media" ON public.user_media;
CREATE POLICY "Users can manage own media" ON public.user_media
  FOR ALL USING (auth.uid() = user_id);

-- ── STEP 5: AI SESSIONS (NEW) ────────────────────────────────
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
CREATE POLICY "Users can manage their own ai_sessions" ON public.ai_sessions
  FOR ALL USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS update_ai_sessions_updated_at_trigger ON public.ai_sessions;
CREATE TRIGGER update_ai_sessions_updated_at_trigger
  BEFORE UPDATE ON public.ai_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── STEP 6: AI MESSAGES (NEW) ────────────────────────────────
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
CREATE POLICY "Users can manage messages in their ai_sessions" ON public.ai_messages
  FOR ALL USING (
    session_id IN (SELECT id FROM public.ai_sessions WHERE user_id = auth.uid())
  );

-- ── STEP 7: SHARED CALENDARS (NEW) ───────────────────────────
CREATE TABLE IF NOT EXISTS public.shared_calendars (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT NOT NULL,
  created_by  UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  members     UUID[] DEFAULT ARRAY[]::UUID[],
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL
);

ALTER TABLE public.shared_calendars ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Members can access shared calendars" ON public.shared_calendars;
CREATE POLICY "Members can access shared calendars" ON public.shared_calendars
  FOR ALL USING (uid_in_array(members, auth.uid()::text) OR created_by = auth.uid());

-- ── STEP 8: SHARED CALENDAR EVENTS (NEW) ─────────────────────
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
CREATE POLICY "Calendar members can manage events" ON public.shared_calendar_events
  FOR ALL USING (
    calendar_id IN (
      SELECT id FROM public.shared_calendars
      WHERE uid_in_array(members, auth.uid()::text) OR created_by = auth.uid()
    )
  );

-- ── STEP 9: SHARED CALENDAR MESSAGES (NEW) ───────────────────
CREATE TABLE IF NOT EXISTS public.shared_calendar_messages (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  calendar_id UUID REFERENCES public.shared_calendars(id) ON DELETE CASCADE,
  user_id     UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  content     TEXT NOT NULL,
  type        TEXT DEFAULT 'text',
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL
);

ALTER TABLE public.shared_calendar_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Calendar members can manage messages" ON public.shared_calendar_messages;
CREATE POLICY "Calendar members can manage messages" ON public.shared_calendar_messages
  FOR ALL USING (
    calendar_id IN (
      SELECT id FROM public.shared_calendars
      WHERE uid_in_array(members, auth.uid()::text) OR created_by = auth.uid()
    )
  );

-- ── STEP 10: SHARED HABIT TRACKER (NEW) ──────────────────────
CREATE TABLE IF NOT EXISTS public.shared_habit_tracker (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  calendar_id UUID REFERENCES public.shared_calendars(id) ON DELETE CASCADE,
  week_start  DATE NOT NULL,
  habits      JSONB DEFAULT '[]'::jsonb,
  updated_by  UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_at  TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL,
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL,
  UNIQUE(calendar_id, week_start)
);

ALTER TABLE public.shared_habit_tracker ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Calendar members can manage shared habits" ON public.shared_habit_tracker;
CREATE POLICY "Calendar members can manage shared habits" ON public.shared_habit_tracker
  FOR ALL USING (
    calendar_id IN (
      SELECT id FROM public.shared_calendars
      WHERE uid_in_array(members, auth.uid()::text) OR created_by = auth.uid()
    )
  );

-- ── STEP 11: PERSONAL CALENDAR EVENTS (NEW) ──────────────────
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
CREATE POLICY "Users can manage their calendar events" ON public.calendar_events
  FOR ALL USING (auth.uid() = user_id);

-- ── STEP 12: HABIT ENTRIES personal (NEW) ────────────────────
CREATE TABLE IF NOT EXISTS public.habit_entries (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  habit_name TEXT NOT NULL,
  week_start DATE NOT NULL,
  completed  JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL,
  UNIQUE(user_id, habit_name, week_start)
);

ALTER TABLE public.habit_entries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage their habit entries" ON public.habit_entries;
CREATE POLICY "Users can manage their habit entries" ON public.habit_entries
  FOR ALL USING (auth.uid() = user_id);

-- ── STEP 13: STORAGE BUCKETS ─────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit)
  VALUES ('ai_media', 'ai_media', true, 52428800) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public, file_size_limit)
  VALUES ('user-media', 'user-media', true, 104857600) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public, file_size_limit)
  VALUES ('library', 'library', true, 52428800) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public, file_size_limit)
  VALUES ('chat-media', 'chat-media', true, 52428800) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public, file_size_limit)
  VALUES ('chat_files', 'chat_files', true, 52428800) ON CONFLICT (id) DO NOTHING;

-- Storage policies (safe - uses IF NOT EXISTS equivalent with DROP IF EXISTS)
DROP POLICY IF EXISTS "Users can upload ai_media" ON storage.objects;
CREATE POLICY "Users can upload ai_media" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'ai_media');
DROP POLICY IF EXISTS "Users can read ai_media" ON storage.objects;
CREATE POLICY "Users can read ai_media" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'ai_media');

DROP POLICY IF EXISTS "Users can upload user-media" ON storage.objects;
CREATE POLICY "Users can upload user-media" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'user-media');
DROP POLICY IF EXISTS "Users can read user-media" ON storage.objects;
CREATE POLICY "Users can read user-media" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'user-media');

DROP POLICY IF EXISTS "Users can upload to library" ON storage.objects;
CREATE POLICY "Users can upload to library" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'library');
DROP POLICY IF EXISTS "Public can read library" ON storage.objects;
CREATE POLICY "Public can read library" ON storage.objects
  FOR SELECT USING (bucket_id = 'library');

DROP POLICY IF EXISTS "Users can upload to chat_files" ON storage.objects;
CREATE POLICY "Users can upload to chat_files" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'chat_files');
DROP POLICY IF EXISTS "Users can read chat_files" ON storage.objects;
CREATE POLICY "Users can read chat_files" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'chat_files');

-- ── STEP 14: Enable Realtime for new tables ───────────────────
ALTER PUBLICATION supabase_realtime ADD TABLE public.shared_calendar_messages;
