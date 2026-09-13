-- Synchronize room_members with the current chat_rooms.participants source of truth.
-- Only users that still exist in auth.users are copied.
INSERT INTO public.room_members (room_id, user_id, role)
SELECT
  cr.id,
  p.user_id,
  CASE
    WHEN p.user_id::text = ANY(COALESCE(cr.admins::text[], ARRAY[]::text[])) THEN 'admin'
    ELSE 'member'
  END
FROM public.chat_rooms AS cr
CROSS JOIN LATERAL unnest(cr.participants::uuid[]) AS p(user_id)
WHERE EXISTS (
  SELECT 1
  FROM auth.users AS u
  WHERE u.id = p.user_id
)
ON CONFLICT (room_id, user_id)
DO UPDATE SET role = EXCLUDED.role;

-- Remove stale membership rows whose user is no longer listed in participants.
DELETE FROM public.room_members rm
WHERE NOT EXISTS (
  SELECT 1
  FROM public.chat_rooms cr
  WHERE cr.id = rm.room_id
    AND rm.user_id = ANY(cr.participants::uuid[])
);

-- Harden membership updates: the authenticated user must remain the owner
-- of the membership row after the update as well as before it.
DROP POLICY IF EXISTS "Users can update their own membership (e.g. mute, last_read_at)" ON public.room_members;
CREATE POLICY "Users can update their own membership (e.g. mute, last_read_at)"
ON public.room_members
FOR UPDATE
TO authenticated
USING ((SELECT auth.uid()) = user_id)
WITH CHECK ((SELECT auth.uid()) = user_id);
