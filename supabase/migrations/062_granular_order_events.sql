-- Break out order events into granular types for webhook subscriptions
-- New event types: order_new, order_fulfilled, order_cancelled
-- These replace the generic 'orders' event type for more targeted subscriptions

-- Add new columns to discord_settings for each order sub-type
ALTER TABLE public.discord_settings 
  ADD COLUMN IF NOT EXISTS order_new_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS order_fulfilled_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS order_cancelled_enabled boolean NOT NULL DEFAULT true;

-- Migrate existing orders_enabled to the new columns
UPDATE public.discord_settings 
SET 
  order_new_enabled = orders_enabled,
  order_fulfilled_enabled = orders_enabled,
  order_cancelled_enabled = orders_enabled;


-- Update the event_type check constraint on the queue table
ALTER TABLE public.discord_message_queue 
  DROP CONSTRAINT IF EXISTS discord_message_queue_event_type_check;

ALTER TABLE public.discord_message_queue 
  ADD CONSTRAINT discord_message_queue_event_type_check 
  CHECK (event_type IN ('orders', 'order_new', 'order_fulfilled', 'order_cancelled', 'blueprints', 'support', 'admin'));


-- Update queue function to handle granular order types
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
  ELSIF p_event_type = 'order_new' AND NOT v_settings.order_new_enabled THEN
    RETURN NULL;
  ELSIF p_event_type = 'order_fulfilled' AND NOT v_settings.order_fulfilled_enabled THEN
    RETURN NULL;
  ELSIF p_event_type = 'order_cancelled' AND NOT v_settings.order_cancelled_enabled THEN
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


-- Update settings function to include new order types
DROP FUNCTION IF EXISTS public.update_discord_settings(boolean, boolean, boolean, boolean, boolean, text, text);

CREATE OR REPLACE FUNCTION public.update_discord_settings(
  p_enabled boolean DEFAULT NULL,
  p_orders_enabled boolean DEFAULT NULL,
  p_order_new_enabled boolean DEFAULT NULL,
  p_order_fulfilled_enabled boolean DEFAULT NULL,
  p_order_cancelled_enabled boolean DEFAULT NULL,
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
    order_new_enabled = COALESCE(p_order_new_enabled, order_new_enabled),
    order_fulfilled_enabled = COALESCE(p_order_fulfilled_enabled, order_fulfilled_enabled),
    order_cancelled_enabled = COALESCE(p_order_cancelled_enabled, order_cancelled_enabled),
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

GRANT EXECUTE ON FUNCTION public.update_discord_settings(boolean, boolean, boolean, boolean, boolean, boolean, boolean, boolean, text, text) TO authenticated;


-- Update get_discord_settings to return new columns
DROP FUNCTION IF EXISTS public.get_discord_settings();

CREATE OR REPLACE FUNCTION public.get_discord_settings()
RETURNS TABLE (
  enabled boolean,
  orders_enabled boolean,
  order_new_enabled boolean,
  order_fulfilled_enabled boolean,
  order_cancelled_enabled boolean,
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
    ds.order_new_enabled,
    ds.order_fulfilled_enabled,
    ds.order_cancelled_enabled,
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


-- Update register webhook to allow granular order types
DROP FUNCTION IF EXISTS public.register_discord_webhook(text, text, text[], text);

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
  v_valid_events text[] := ARRAY['order_new', 'order_fulfilled', 'order_cancelled', 'blueprints'];
  v_filtered_events text[];
BEGIN
  -- Validate webhook URL format
  IF NOT p_webhook_url ~ '^https://discord\.com/api/webhooks/[0-9]+/[A-Za-z0-9_-]+$' 
     AND NOT p_webhook_url ~ '^https://discordapp\.com/api/webhooks/[0-9]+/[A-Za-z0-9_-]+$' THEN
    RAISE EXCEPTION 'Invalid Discord webhook URL format';
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
  
  INSERT INTO discord_webhooks (webhook_url, webhook_name, subscribed_events, registered_by)
  VALUES (p_webhook_url, p_webhook_name, v_filtered_events, p_registered_by)
  RETURNING id INTO v_webhook_id;
  
  RETURN v_webhook_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.register_discord_webhook(text, text, text[], text) TO anon;
GRANT EXECUTE ON FUNCTION public.register_discord_webhook(text, text, text[], text) TO authenticated;


-- Update get_discord_public_event_types to return granular order types
DROP FUNCTION IF EXISTS public.get_discord_public_event_types();

CREATE OR REPLACE FUNCTION public.get_discord_public_event_types()
RETURNS TABLE (
  event_type text,
  enabled boolean,
  display_name text,
  description text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 'order_new'::text, ds.order_new_enabled, 'New Orders'::text, 'When new crafting orders are placed'::text
  FROM discord_settings ds WHERE ds.id = 1
  UNION ALL
  SELECT 'order_fulfilled'::text, ds.order_fulfilled_enabled, 'Order Fulfilled'::text, 'When orders are completed by crafters'::text
  FROM discord_settings ds WHERE ds.id = 1
  UNION ALL
  SELECT 'order_cancelled'::text, ds.order_cancelled_enabled, 'Order Cancelled'::text, 'When orders are cancelled'::text
  FROM discord_settings ds WHERE ds.id = 1
  UNION ALL
  SELECT 'blueprints'::text, ds.blueprints_enabled, 'Blueprint Syncs'::text, 'When blueprint data is updated from game files'::text
  FROM discord_settings ds WHERE ds.id = 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_discord_public_event_types() TO anon;
GRANT EXECUTE ON FUNCTION public.get_discord_public_event_types() TO authenticated;


-- Migrate existing webhook subscriptions from 'orders' to the new granular types
UPDATE public.discord_webhooks
SET subscribed_events = array_cat(
  array_remove(array_remove(array_remove(subscribed_events, 'orders'), 'order_new'), 'order_fulfilled'),
  CASE 
    WHEN 'orders' = ANY(subscribed_events) 
    THEN ARRAY['order_new', 'order_fulfilled', 'order_cancelled']
    ELSE ARRAY[]::text[]
  END
)
WHERE 'orders' = ANY(subscribed_events);
