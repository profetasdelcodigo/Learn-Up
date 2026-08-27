ALTER TABLE public.ai_messages ADD COLUMN IF NOT EXISTS client_message_id text;

CREATE UNIQUE INDEX IF NOT EXISTS ai_messages_client_message_id_uidx
  ON public.ai_messages(client_message_id)
  WHERE client_message_id IS NOT NULL;
