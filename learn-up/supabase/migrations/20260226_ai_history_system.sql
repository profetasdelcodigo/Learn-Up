-- Migration for AI Chat History and Sessions
CREATE TABLE IF NOT EXISTS public.ai_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  ai_type TEXT NOT NULL, -- 'profesor', 'consejero', 'nutricion', 'examen'
  title TEXT NOT NULL DEFAULT 'Nueva Sesión',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.ai_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID REFERENCES public.ai_sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'user', -- 'user' or 'assistant'
  content TEXT NOT NULL,
  media_url TEXT, -- for multimedia uploads
  media_type TEXT, -- 'image', 'video', 'audio', 'document'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS
ALTER TABLE public.ai_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own ai_sessions"
  ON public.ai_sessions
  FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage messages in their ai_sessions"
  ON public.ai_messages
  FOR ALL
  USING (
    session_id IN (
      SELECT id FROM public.ai_sessions WHERE user_id = auth.uid()
    )
  );

-- Function to update updated_at
CREATE OR REPLACE FUNCTION update_ai_sessions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_ai_sessions_updated_at_trigger ON public.ai_sessions;
CREATE TRIGGER update_ai_sessions_updated_at_trigger
BEFORE UPDATE ON public.ai_sessions
FOR EACH ROW
EXECUTE FUNCTION update_ai_sessions_updated_at();

-- Add storage bucket for AI media if not exists
INSERT INTO storage.buckets (id, name, public) 
VALUES ('ai_media', 'ai_media', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Users can upload ai_media" ON storage.objects
FOR INSERT TO authenticated WITH CHECK (bucket_id = 'ai_media' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can read ai_media" ON storage.objects
FOR SELECT TO authenticated USING (bucket_id = 'ai_media');
