-- Enable Realtime for critical tables that need instant event propagation
-- user_sessions: instant logout across devices
-- notifications: instant notification delivery
-- chat_messages: real-time messaging
-- Note: If table already exists in publication, this will error. Using DO block for safety.

DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN
    SELECT unnest(ARRAY['user_sessions', 'notifications', 'chat_messages'])
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = tbl
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', tbl);
      RAISE NOTICE 'Added % to supabase_realtime', tbl;
    ELSE
      RAISE NOTICE '% already in supabase_realtime, skipping', tbl;
    END IF;
  END LOOP;
END $$;
