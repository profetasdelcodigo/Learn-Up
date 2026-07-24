-- Fix chat_messages RLS
DROP POLICY IF EXISTS "Users can view messages in their rooms" ON public.chat_messages;
CREATE POLICY "Users can view messages in their rooms" ON public.chat_messages FOR SELECT USING (auth.uid() IN (SELECT CAST(jsonb_array_elements_text(participants) AS uuid) FROM public.chat_rooms WHERE id = room_id));
