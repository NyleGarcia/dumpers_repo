-- Allow users to manage their own registered webhooks
-- - Track which user registered each webhook
-- - Limit users to 4 webhooks max
-- - Prevent duplicate webhook URLs

-- Add user tracking column
ALTER TABLE public.discord_webhooks 
  ADD COLUMN IF NOT EXISTS registered_by_user_id uuid REFERENCES public.profiles(id);

-- Create index for user lookups
CREATE INDEX IF NOT EXISTS idx_discord_webhooks_user 
  ON public.discord_webhooks(registered_by_user_id) 
  WHERE registered_by_user_id IS NOT NULL;

-- Create unique index to prevent duplicate webhook URLs
CREATE UNIQUE INDEX IF NOT EXISTS idx_discord_webhooks_url_unique 
  ON public.discord_webhooks(webhook_url);


-- Allow users to view their own webhooks
DROP POLICY IF EXISTS "discord_webhooks_select_own" ON public.discord_webhooks;
CREATE POLICY "discord_webhooks_select_own"
  ON public.discord_webhooks FOR SELECT TO authenticated
  USING (registered_by_user_id = auth.uid() OR public.is_super_admin());

-- Allow users to delete their own webhooks  
DROP POLICY IF EXISTS "discord_webhooks_delete_own" ON public.discord_webhooks;
CREATE POLICY "discord_webhooks_delete_own"
  ON public.discord_webhooks FOR DELETE TO authenticated
  USING (registered_by_user_id = auth.uid() OR public.is_super_admin());

-- Allow users to update their own webhooks (for toggling active, updating events)
DROP POLICY IF EXISTS "discord_webhooks_update_own" ON public.discord_webhooks;
CREATE POLICY "discord_webhooks_update_own"
  ON public.discord_webhooks FOR UPDATE TO authenticated
  USING (registered_by_user_id = auth.uid() OR public.is_super_admin())
  WITH CHECK (registered_by_user_id = auth.uid() OR public.is_super_admin());


-- Update register function with user tracking, duplicate check, and limit enforcement
DROP FUNCTION IF EXISTS public.register_discord_webhook(text, text, text[], text);

CREATE OR REPLACE FUNCTION public.register_discord_webhook(
  p_webhook_url text,
  p_webhook_name text,
  p_subscribed_events text[],
  p_registered_by text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_webhook_id uuid;
  v_user_id uuid;
  v_existing_count int;
  v_valid_events text[] := ARRAY['order_new', 'order_fulfilled', 'order_cancelled', 'blueprints'];
  v_filtered_events text[];
BEGIN
  -- Get current user ID (will be NULL for anon)
  v_user_id := auth.uid();
  
  -- Require authentication
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Authentication required to register webhooks');
  END IF;
  
  -- Validate webhook URL format
  IF NOT p_webhook_url ~ '^https://discord\.com/api/webhooks/[0-9]+/[A-Za-z0-9_-]+$' 
     AND NOT p_webhook_url ~ '^https://discordapp\.com/api/webhooks/[0-9]+/[A-Za-z0-9_-]+$' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid Discord webhook URL format');
  END IF;
  
  -- Check for duplicate webhook URL
  IF EXISTS (SELECT 1 FROM discord_webhooks WHERE webhook_url = p_webhook_url) THEN
    RETURN jsonb_build_object('success', false, 'error', 'This Discord channel is already registered');
  END IF;
  
  -- Check user's webhook count (limit to 4)
  SELECT COUNT(*) INTO v_existing_count
  FROM discord_webhooks
  WHERE registered_by_user_id = v_user_id;
  
  IF v_existing_count >= 4 THEN
    RETURN jsonb_build_object('success', false, 'error', 'You have reached the maximum of 4 registered webhooks. Please delete one to add another.');
  END IF;
  
  -- Filter to only allow public event types
  SELECT ARRAY_AGG(e)
  INTO v_filtered_events
  FROM unnest(p_subscribed_events) e
  WHERE e = ANY(v_valid_events);
  
  -- Default to all events if none selected
  IF v_filtered_events IS NULL OR array_length(v_filtered_events, 1) = 0 THEN
    v_filtered_events := ARRAY['order_new', 'order_fulfilled', 'order_cancelled', 'blueprints'];
  END IF;
  
  INSERT INTO discord_webhooks (webhook_url, webhook_name, subscribed_events, registered_by, registered_by_user_id)
  VALUES (p_webhook_url, p_webhook_name, v_filtered_events, p_registered_by, v_user_id)
  RETURNING id INTO v_webhook_id;
  
  RETURN jsonb_build_object('success', true, 'webhook_id', v_webhook_id);
END;
$$;

-- Only allow authenticated users now (no anon)
GRANT EXECUTE ON FUNCTION public.register_discord_webhook(text, text, text[], text) TO authenticated;


-- Function to get user's own webhooks
CREATE OR REPLACE FUNCTION public.get_my_discord_webhooks()
RETURNS TABLE (
  id uuid,
  webhook_name text,
  subscribed_events text[],
  created_at timestamptz,
  last_success_at timestamptz,
  failure_count int,
  active boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN;
  END IF;
  
  RETURN QUERY
  SELECT 
    dw.id,
    dw.webhook_name,
    dw.subscribed_events,
    dw.created_at,
    dw.last_success_at,
    dw.failure_count,
    dw.active
  FROM discord_webhooks dw
  WHERE dw.registered_by_user_id = auth.uid()
  ORDER BY dw.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_discord_webhooks() TO authenticated;


-- Function to delete user's own webhook
CREATE OR REPLACE FUNCTION public.delete_my_discord_webhook(p_webhook_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted int;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Authentication required');
  END IF;
  
  DELETE FROM discord_webhooks
  WHERE id = p_webhook_id
    AND registered_by_user_id = auth.uid();
  
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  
  IF v_deleted = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Webhook not found or not owned by you');
  END IF;
  
  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_my_discord_webhook(uuid) TO authenticated;


-- Function to update user's own webhook events
CREATE OR REPLACE FUNCTION public.update_my_discord_webhook(
  p_webhook_id uuid,
  p_webhook_name text DEFAULT NULL,
  p_subscribed_events text[] DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_valid_events text[] := ARRAY['order_new', 'order_fulfilled', 'order_cancelled', 'blueprints'];
  v_filtered_events text[];
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Authentication required');
  END IF;
  
  -- Check ownership
  IF NOT EXISTS (
    SELECT 1 FROM discord_webhooks 
    WHERE id = p_webhook_id AND registered_by_user_id = auth.uid()
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Webhook not found or not owned by you');
  END IF;
  
  -- Filter events if provided
  IF p_subscribed_events IS NOT NULL THEN
    SELECT ARRAY_AGG(e)
    INTO v_filtered_events
    FROM unnest(p_subscribed_events) e
    WHERE e = ANY(v_valid_events);
    
    IF v_filtered_events IS NULL OR array_length(v_filtered_events, 1) = 0 THEN
      RETURN jsonb_build_object('success', false, 'error', 'At least one valid event type required');
    END IF;
  END IF;
  
  UPDATE discord_webhooks
  SET
    webhook_name = COALESCE(p_webhook_name, webhook_name),
    subscribed_events = COALESCE(v_filtered_events, subscribed_events)
  WHERE id = p_webhook_id
    AND registered_by_user_id = auth.uid();
  
  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_my_discord_webhook(uuid, text, text[]) TO authenticated;
