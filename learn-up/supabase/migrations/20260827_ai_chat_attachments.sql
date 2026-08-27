-- Learn Up: chat message idempotency for attachments/retries.
-- Safe to run multiple times.

ALTER TABLE public.ai_messages
  ADD COLUMN IF NOT EXISTS client_message_id text;

CREATE UNIQUE INDEX IF NOT EXISTS ai_messages_client_message_id_uidx
  ON public.ai_messages(client_message_id)
  WHERE client_message_id IS NOT NULL;

-- Verify attachment columns exist before relying on persisted media.
-- No destructive migration is performed here.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'ai_messages'
      AND column_name = 'media_url'
  ) THEN
    ALTER TABLE public.ai_messages ADD COLUMN media_url text;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'ai_messages'
      AND column_name = 'media_type'
  ) THEN
    ALTER TABLE public.ai_messages ADD COLUMN media_type text;
  END IF;
END $$;
