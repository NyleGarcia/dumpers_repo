-- One-off repair: link a user to verified Dumpers org by email
-- Run in Supabase SQL editor (replace the email if needed)

DO $$
DECLARE
  target_user_id uuid;
  dumpers_id uuid;
BEGIN
  SELECT id INTO target_user_id
  FROM public.profiles
  WHERE email = 'YOUR_EMAIL_HERE'
  LIMIT 1;

  IF target_user_id IS NULL THEN
    RAISE EXCEPTION 'No profile found for that email';
  END IF;

  dumpers_id := public.get_default_org_id();
  IF dumpers_id IS NULL THEN
    RAISE EXCEPTION 'Dumpers org missing — re-run 010 and 018';
  END IF;

  PERFORM public.assign_dumpers_org_membership(target_user_id);

  RAISE NOTICE 'Repaired user % → Dumpers org %', target_user_id, dumpers_id;
END $$;

SELECT
  p.email,
  p.org_id,
  o.name AS org_name,
  o.slug,
  m.org_role,
  m.verified_at,
  m.joined_at
FROM public.profiles p
LEFT JOIN public.organizations o ON o.id = p.org_id
LEFT JOIN public.org_memberships m
  ON m.user_id = p.id AND m.org_id = p.org_id
WHERE p.email = 'YOUR_EMAIL_HERE';
