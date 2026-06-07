-- Manual unban script for DBA use (super-admin should use Admin Panel instead)
-- Set target_user_id below, then run in Supabase SQL Editor.
-- Also unban auth user: Dashboard → Authentication → Users, or auth.admin ban_duration: 'none'

DO $$
DECLARE
  target_user_id uuid := '00000000-0000-0000-0000-000000000000'; -- ← replace
  ban_row public.banned_users%ROWTYPE;
BEGIN
  SELECT * INTO ban_row
  FROM public.banned_users
  WHERE id = target_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User % is not in banned_users', target_user_id;
  END IF;

  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = target_user_id) THEN
    RAISE EXCEPTION 'Profile already exists for %', target_user_id;
  END IF;

  DELETE FROM public.banned_users WHERE id = target_user_id;

  INSERT INTO public.profiles (id, email, display_name, avatar_url, rsi_handle, role)
  VALUES (
    ban_row.id,
    ban_row.email,
    ban_row.display_name,
    ban_row.avatar_url,
    ban_row.rsi_handle,
    'pending'
  );

  RAISE NOTICE 'Unbanned % — profile restored as pending', target_user_id;
END;
$$;
