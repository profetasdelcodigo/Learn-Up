CREATE OR REPLACE FUNCTION public.sync_room_members_from_chat_room()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.room_members rm
  WHERE rm.room_id = NEW.id
    AND NOT (rm.user_id = ANY(COALESCE(NEW.participants, ARRAY[]::uuid[])));

  INSERT INTO public.room_members (room_id, user_id, role)
  SELECT
    NEW.id,
    p.user_id,
    CASE
      WHEN p.user_id = ANY(COALESCE(NEW.admins, ARRAY[]::uuid[])) THEN 'admin'
      ELSE 'member'
    END
  FROM unnest(COALESCE(NEW.participants, ARRAY[]::uuid[])) AS p(user_id)
  WHERE EXISTS (SELECT 1 FROM auth.users u WHERE u.id = p.user_id)
  ON CONFLICT (room_id, user_id)
  DO UPDATE SET role = EXCLUDED.role;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_room_members_from_chat_rooms ON public.chat_rooms;

CREATE TRIGGER trg_sync_room_members_from_chat_rooms
AFTER INSERT OR UPDATE OF participants, admins ON public.chat_rooms
FOR EACH ROW
EXECUTE FUNCTION public.sync_room_members_from_chat_room();

COMMENT ON FUNCTION public.sync_room_members_from_chat_room() IS
'Keeps room_members synchronized with the canonical chat_rooms.participants/admins fields.';
