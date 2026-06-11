-- Notify all approved members when a new custom order is created
-- (except the person who created it)

-- Trigger function to notify members of new orders
CREATE OR REPLACE FUNCTION public.notify_new_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_requester_name text;
  v_member_id uuid;
  v_price_label text;
BEGIN
  -- Only trigger on new pending orders
  IF NEW.status != 'pending' THEN
    RETURN NEW;
  END IF;
  
  -- Get requester name
  SELECT COALESCE(rsi_handle, display_name, email, 'Someone')
  INTO v_requester_name
  FROM public.profiles
  WHERE id = NEW.requester_id;
  
  -- Format price
  v_price_label := public.format_dfp_auec(NEW.total_dfp_auec);
  
  -- Notify all approved members except the requester
  FOR v_member_id IN
    SELECT id FROM public.profiles
    WHERE role IN ('member', 'officer', 'super-admin')
    AND id != NEW.requester_id
    AND ghost_mode IS NOT TRUE
  LOOP
    PERFORM public.create_user_notification(
      v_member_id,
      'order_new',
      'New Order Available',
      v_requester_name || ' posted: ' || NEW.title || ' · ' || v_price_label,
      jsonb_build_object('order_id', NEW.id, 'total_dfp_auec', NEW.total_dfp_auec)
    );
  END LOOP;
  
  RETURN NEW;
END;
$$;

-- Create the trigger
DROP TRIGGER IF EXISTS trigger_notify_new_order ON public.custom_orders;
CREATE TRIGGER trigger_notify_new_order
  AFTER INSERT ON public.custom_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_new_order();
