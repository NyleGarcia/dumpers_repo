-- =============================================================================
-- Migration 071: Add Discord notification for new user sign-ups
-- Notifies admins when a new user completes onboarding (first time seeing welcome modal)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.mark_welcome_seen()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_already_seen boolean;
  v_display_name text;
  v_email text;
  v_rsi_handle text;
  v_discord_color int := 5865242; -- Discord blurple (info color)
BEGIN
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RETURN;
  END IF;

  -- Get current status and user info
  SELECT 
    has_seen_welcome,
    COALESCE(display_name, ''),
    COALESCE(email, ''),
    COALESCE(rsi_handle, '')
  INTO v_already_seen, v_display_name, v_email, v_rsi_handle
  FROM public.profiles
  WHERE id = v_user_id;

  -- Only notify if this is the FIRST time (not already seen)
  IF NOT COALESCE(v_already_seen, false) THEN
    -- Queue Discord admin notification for new user
    PERFORM public.queue_discord_message(
      'admin',
      'New User Joined',
      'A new member has completed onboarding.',
      v_discord_color,
      jsonb_build_array(
        jsonb_build_object('name', 'Display Name', 'value', COALESCE(NULLIF(v_display_name, ''), 'Not set'), 'inline', true),
        jsonb_build_object('name', 'RSI Handle', 'value', COALESCE(NULLIF(v_rsi_handle, ''), 'Not set'), 'inline', true),
        jsonb_build_object('name', 'Email', 'value', COALESCE(NULLIF(v_email, ''), 'Unknown'), 'inline', false)
      )
    );
  END IF;

  -- Mark as seen
  UPDATE public.profiles
  SET has_seen_welcome = true
  WHERE id = v_user_id;
END;
$$;
