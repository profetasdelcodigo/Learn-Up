-- Migration: Create notification_log table for push notification traceability

CREATE TABLE IF NOT EXISTS public.notification_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  payload JSONB,
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  status TEXT
);

-- Enable RLS
ALTER TABLE public.notification_log ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own notification logs
CREATE POLICY "Users can view their own notification logs"
  ON public.notification_log
  FOR SELECT
  USING (auth.uid() = user_id);

-- Explicit Grants (Required for PostgREST as per May 30 2026 change)
GRANT SELECT ON public.notification_log TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.notification_log TO authenticated;
GRANT USAGE ON SCHEMA public TO anon, authenticated;
