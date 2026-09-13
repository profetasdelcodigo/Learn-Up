-- Harden chat room updates at the database boundary.
-- Only admins may update room metadata or membership arrays.
-- User self-leave and message activity updates use trusted server-side clients.
DROP POLICY IF EXISTS "chat_rooms_update_participant" ON public.chat_rooms;
DROP POLICY IF EXISTS "chat_rooms_update_admin" ON public.chat_rooms;

CREATE POLICY "chat_rooms_update_admin"
ON public.chat_rooms
FOR UPDATE
TO authenticated
USING ((SELECT auth.uid()) = ANY(admins))
WITH CHECK ((SELECT auth.uid()) = ANY(admins));
