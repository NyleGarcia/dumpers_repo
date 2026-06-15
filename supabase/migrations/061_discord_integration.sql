-- Discord webhook integration for broadcasting events to Discord channels
-- Event visibility:
--   Orders: Public (all subscribed webhooks)
--   Blueprints: Public (all subscribed webhooks)
--   Support: Org Only (official webhook only)
--   Admin: Org Only (official webhook only)

-- Global Discord settings (singleton, super-admin controlled)
CREATE TABLE IF NOT EXISTS public.discord_settings (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  enabled boolean NOT NULL DEFAULT false,
  orders_enabled boolean NOT NULL DEFAULT true,
  blueprints_enabled boolean NOT NULL DEFAULT true,
  support_enabled boolean NOT NULL DEFAULT true,
  admin_enabled boolean NOT NULL DEFAULT true,
  official_webhook_url text,
  official_webhook_name text DEFAULT 'Official Org Channel',
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES public.profiles(id)
);

INSERT INTO public.discord_settings (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.discord_settings ENABLE ROW LEVEL SECURITY;

-- Only super-admins can read settings (contains webhook URL)
DROP POLICY IF EXISTS "discord_settings_select_super_admin" ON public.discord_settings;
CREATE POLICY "discord_settings_select_super_admin"
  ON public.discord_settings FOR SELECT TO authenticated
  USING (public.is_super_admin());

DROP POLICY IF EXISTS "discord_settings_update_super_admin" ON public.discord_settings;
CREATE POLICY "discord_settings_update_super_admin"
  ON public.discord_settings FOR UPDATE TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());


-- Public webhook subscriptions (anyone can register)
CREATE TABLE IF NOT EXISTS public.discord_webhooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_url text NOT NULL,
  webhook_name text NOT NULL,
  subscribed_events text[] NOT NULL DEFAULT ARRAY['orders', 'blueprints'],
  registered_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_success_at timestamptz,
  failure_count int NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true
);

ALTER TABLE public.discord_webhooks ENABLE ROW LEVEL SECURITY;

-- Anyone can insert (register a webhook)
DROP POLICY IF EXISTS "discord_webhooks_insert_anon" ON public.discord_webhooks;
CREATE POLICY "discord_webhooks_insert_anon"
  ON public.discord_webhooks FOR INSERT TO anon
  WITH CHECK (true);

DROP POLICY IF EXISTS "discord_webhooks_insert_authenticated" ON public.discord_webhooks;
CREATE POLICY "discord_webhooks_insert_authenticated"
  ON public.discord_webhooks FOR INSERT TO authenticated
  WITH CHECK (true);

-- Only super-admins can view all webhooks
DROP POLICY IF EXISTS "discord_webhooks_select_super_admin" ON public.discord_webhooks;
CREATE POLICY "discord_webhooks_select_super_admin"
  ON public.discord_webhooks FOR SELECT TO authenticated
  USING (public.is_super_admin());

-- Only super-admins can update/delete webhooks
DROP POLICY IF EXISTS "discord_webhooks_update_super_admin" ON public.discord_webhooks;
CREATE POLICY "discord_webhooks_update_super_admin"
  ON public.discord_webhooks FOR UPDATE TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS "discord_webhooks_delete_super_admin" ON public.discord_webhooks;
CREATE POLICY "discord_webhooks_delete_super_admin"
  ON public.discord_webhooks FOR DELETE TO authenticated
  USING (public.is_super_admin());


-- Message queue (processed by edge function, wiped daily)
CREATE TABLE IF NOT EXISTS public.discord_message_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL CHECK (event_type IN ('orders', 'blueprints', 'support', 'admin')),
  title text NOT NULL,
  description text,
  color int DEFAULT 5814783,
  fields jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_discord_queue_pending 
  ON public.discord_message_queue(created_at) 
  WHERE processed_at IS NULL;

ALTER TABLE public.discord_message_queue ENABLE ROW LEVEL SECURITY;

-- Queue is only accessible via service role (edge functions)
-- No direct access for authenticated users


-- Helper function to queue a Discord message
CREATE OR REPLACE FUNCTION public.queue_discord_message(
  p_event_type text,
  p_title text,
  p_description text DEFAULT NULL,
  p_color int DEFAULT 5814783,
  p_fields jsonb DEFAULT '[]'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_settings discord_settings;
  v_message_id uuid;
BEGIN
  -- Check if Discord is enabled globally
  SELECT * INTO v_settings FROM discord_settings WHERE id = 1;
  
  IF NOT v_settings.enabled THEN
    RETURN NULL;
  END IF;
  
  -- Check if this event type is enabled
  IF p_event_type = 'orders' AND NOT v_settings.orders_enabled THEN
    RETURN NULL;
  ELSIF p_event_type = 'blueprints' AND NOT v_settings.blueprints_enabled THEN
    RETURN NULL;
  ELSIF p_event_type = 'support' AND NOT v_settings.support_enabled THEN
    RETURN NULL;
  ELSIF p_event_type = 'admin' AND NOT v_settings.admin_enabled THEN
    RETURN NULL;
  END IF;
  
  -- Insert into queue
  INSERT INTO discord_message_queue (event_type, title, description, color, fields)
  VALUES (p_event_type, p_title, p_description, p_color, p_fields)
  RETURNING id INTO v_message_id;
  
  RETURN v_message_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.queue_discord_message(text, text, text, int, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.queue_discord_message(text, text, text, int, jsonb) TO service_role;


-- Get queue status for admin UI
CREATE OR REPLACE FUNCTION public.get_discord_queue_status()
RETURNS TABLE (
  pending_count bigint,
  oldest_pending timestamptz,
  processed_today bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Super-admin access required';
  END IF;
  
  RETURN QUERY
  SELECT
    COUNT(*) FILTER (WHERE processed_at IS NULL) as pending_count,
    MIN(created_at) FILTER (WHERE processed_at IS NULL) as oldest_pending,
    COUNT(*) FILTER (WHERE processed_at IS NOT NULL AND processed_at > now() - interval '1 day') as processed_today;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_discord_queue_status() TO authenticated;


-- Clear the message queue (manual or scheduled)
CREATE OR REPLACE FUNCTION public.clear_discord_queue(p_only_processed boolean DEFAULT true)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted int;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Super-admin access required';
  END IF;
  
  IF p_only_processed THEN
    DELETE FROM discord_message_queue WHERE processed_at IS NOT NULL;
  ELSE
    DELETE FROM discord_message_queue;
  END IF;
  
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

GRANT EXECUTE ON FUNCTION public.clear_discord_queue(boolean) TO authenticated;


-- Update Discord settings
CREATE OR REPLACE FUNCTION public.update_discord_settings(
  p_enabled boolean DEFAULT NULL,
  p_orders_enabled boolean DEFAULT NULL,
  p_blueprints_enabled boolean DEFAULT NULL,
  p_support_enabled boolean DEFAULT NULL,
  p_admin_enabled boolean DEFAULT NULL,
  p_official_webhook_url text DEFAULT NULL,
  p_official_webhook_name text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Super-admin access required';
  END IF;
  
  UPDATE discord_settings
  SET
    enabled = COALESCE(p_enabled, enabled),
    orders_enabled = COALESCE(p_orders_enabled, orders_enabled),
    blueprints_enabled = COALESCE(p_blueprints_enabled, blueprints_enabled),
    support_enabled = COALESCE(p_support_enabled, support_enabled),
    admin_enabled = COALESCE(p_admin_enabled, admin_enabled),
    official_webhook_url = COALESCE(p_official_webhook_url, official_webhook_url),
    official_webhook_name = COALESCE(p_official_webhook_name, official_webhook_name),
    updated_at = now(),
    updated_by = auth.uid()
  WHERE id = 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_discord_settings(boolean, boolean, boolean, boolean, boolean, text, text) TO authenticated;


-- Get Discord settings (for edge function - returns all including webhook URL)
CREATE OR REPLACE FUNCTION public.get_discord_settings()
RETURNS TABLE (
  enabled boolean,
  orders_enabled boolean,
  blueprints_enabled boolean,
  support_enabled boolean,
  admin_enabled boolean,
  official_webhook_url text,
  official_webhook_name text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ds.enabled,
    ds.orders_enabled,
    ds.blueprints_enabled,
    ds.support_enabled,
    ds.admin_enabled,
    ds.official_webhook_url,
    ds.official_webhook_name
  FROM discord_settings ds
  WHERE ds.id = 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_discord_settings() TO service_role;
GRANT EXECUTE ON FUNCTION public.get_discord_settings() TO authenticated;


-- Get active webhooks for a specific event type
CREATE OR REPLACE FUNCTION public.get_discord_webhooks_for_event(p_event_type text)
RETURNS TABLE (
  id uuid,
  webhook_url text,
  webhook_name text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    dw.id,
    dw.webhook_url,
    dw.webhook_name
  FROM discord_webhooks dw
  WHERE dw.active = true
    AND p_event_type = ANY(dw.subscribed_events);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_discord_webhooks_for_event(text) TO service_role;


-- Record webhook success/failure
CREATE OR REPLACE FUNCTION public.record_discord_webhook_result(
  p_webhook_id uuid,
  p_success boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_success THEN
    UPDATE discord_webhooks
    SET 
      last_success_at = now(),
      failure_count = 0
    WHERE id = p_webhook_id;
  ELSE
    UPDATE discord_webhooks
    SET 
      failure_count = failure_count + 1,
      active = CASE WHEN failure_count >= 4 THEN false ELSE active END
    WHERE id = p_webhook_id;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_discord_webhook_result(uuid, boolean) TO service_role;


-- Mark message as processed
CREATE OR REPLACE FUNCTION public.mark_discord_message_processed(p_message_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE discord_message_queue
  SET processed_at = now()
  WHERE id = p_message_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_discord_message_processed(uuid) TO service_role;


-- Get pending messages from queue
CREATE OR REPLACE FUNCTION public.get_pending_discord_messages(p_limit int DEFAULT 50)
RETURNS TABLE (
  id uuid,
  event_type text,
  title text,
  description text,
  color int,
  fields jsonb,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    dmq.id,
    dmq.event_type,
    dmq.title,
    dmq.description,
    dmq.color,
    dmq.fields,
    dmq.created_at
  FROM discord_message_queue dmq
  WHERE dmq.processed_at IS NULL
  ORDER BY dmq.created_at ASC
  LIMIT p_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_pending_discord_messages(int) TO service_role;


-- Register a new public webhook
CREATE OR REPLACE FUNCTION public.register_discord_webhook(
  p_webhook_url text,
  p_webhook_name text,
  p_subscribed_events text[],
  p_registered_by text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_webhook_id uuid;
  v_valid_events text[] := ARRAY['orders', 'blueprints'];
  v_filtered_events text[];
BEGIN
  -- Validate webhook URL format
  IF NOT p_webhook_url ~ '^https://discord\.com/api/webhooks/[0-9]+/[A-Za-z0-9_-]+$' 
     AND NOT p_webhook_url ~ '^https://discordapp\.com/api/webhooks/[0-9]+/[A-Za-z0-9_-]+$' THEN
    RAISE EXCEPTION 'Invalid Discord webhook URL format';
  END IF;
  
  -- Filter to only allow public event types (orders, blueprints)
  SELECT ARRAY_AGG(e)
  INTO v_filtered_events
  FROM unnest(p_subscribed_events) e
  WHERE e = ANY(v_valid_events);
  
  IF v_filtered_events IS NULL OR array_length(v_filtered_events, 1) = 0 THEN
    v_filtered_events := ARRAY['orders', 'blueprints'];
  END IF;
  
  INSERT INTO discord_webhooks (webhook_url, webhook_name, subscribed_events, registered_by)
  VALUES (p_webhook_url, p_webhook_name, v_filtered_events, p_registered_by)
  RETURNING id INTO v_webhook_id;
  
  RETURN v_webhook_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.register_discord_webhook(text, text, text[], text) TO anon;
GRANT EXECUTE ON FUNCTION public.register_discord_webhook(text, text, text[], text) TO authenticated;


-- Get enabled event types for public display (for subscription page)
CREATE OR REPLACE FUNCTION public.get_discord_public_event_types()
RETURNS TABLE (
  event_type text,
  enabled boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 'orders'::text as event_type, ds.orders_enabled as enabled
  FROM discord_settings ds WHERE ds.id = 1
  UNION ALL
  SELECT 'blueprints'::text as event_type, ds.blueprints_enabled as enabled
  FROM discord_settings ds WHERE ds.id = 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_discord_public_event_types() TO anon;
GRANT EXECUTE ON FUNCTION public.get_discord_public_event_types() TO authenticated;
