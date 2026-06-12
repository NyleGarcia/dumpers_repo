-- Officer Rating System with Escalation
-- Allows members to rate officers after ticket resolution
-- Enables escalation to super-admin if rating < 3 stars (officer-resolved only)

-- Create resolver type enum
DO $$ BEGIN
  CREATE TYPE ticket_resolver AS ENUM ('officer', 'member');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Add new columns to support_tickets
ALTER TABLE public.support_tickets
  ADD COLUMN IF NOT EXISTS resolved_by ticket_resolver,
  ADD COLUMN IF NOT EXISTS resolved_at timestamptz,
  ADD COLUMN IF NOT EXISTS is_escalated boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS escalated_at timestamptz,
  ADD COLUMN IF NOT EXISTS escalation_reason text,
  ADD COLUMN IF NOT EXISTS pending_rating boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS resolution_message text;

-- Create index for escalated tickets
CREATE INDEX IF NOT EXISTS idx_support_tickets_escalated ON public.support_tickets(is_escalated) WHERE is_escalated = true;
CREATE INDEX IF NOT EXISTS idx_support_tickets_pending_rating ON public.support_tickets(pending_rating) WHERE pending_rating = true;

-- Officer ratings table (persists even after ticket deletion for performance tracking)
CREATE TABLE IF NOT EXISTS public.officer_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid REFERENCES public.support_tickets(id) ON DELETE SET NULL,
  officer_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  stars smallint NOT NULL CHECK (stars >= 1 AND stars <= 5),
  comment text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_officer_ratings_officer ON public.officer_ratings(officer_id);
CREATE INDEX IF NOT EXISTS idx_officer_ratings_member ON public.officer_ratings(member_id);

-- RLS for officer_ratings: only super-admins can view
ALTER TABLE public.officer_ratings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS officer_ratings_super_admin_select ON public.officer_ratings;
CREATE POLICY officer_ratings_super_admin_select ON public.officer_ratings
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() 
      AND role = 'super-admin'
    )
  );

-- Members can insert ratings for their own tickets
DROP POLICY IF EXISTS officer_ratings_member_insert ON public.officer_ratings;
CREATE POLICY officer_ratings_member_insert ON public.officer_ratings
  FOR INSERT TO authenticated
  WITH CHECK (member_id = auth.uid());

-- ─────────────────────────────────────────────────────────────────────────────
-- Officer resolves ticket (waits for member rating)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.officer_resolve_ticket(
  p_ticket_id uuid,
  p_resolution_message text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_role text;
  v_ticket record;
BEGIN
  -- Check user is officer+
  SELECT role INTO v_user_role FROM public.profiles WHERE id = auth.uid();
  IF v_user_role NOT IN ('officer', 'super-admin') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Officer access required');
  END IF;
  
  -- Get ticket details
  SELECT * INTO v_ticket FROM public.support_tickets WHERE id = p_ticket_id;
  
  IF v_ticket IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ticket not found');
  END IF;
  
  IF v_ticket.pending_rating THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ticket already pending rating');
  END IF;
  
  IF v_ticket.is_escalated THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot resolve escalated ticket this way');
  END IF;
  
  -- Mark as resolved by officer, pending member rating
  UPDATE public.support_tickets
  SET resolved_by = 'officer',
      resolved_at = now(),
      pending_rating = true,
      resolution_message = p_resolution_message,
      status = 'resolved',
      updated_at = now()
  WHERE id = p_ticket_id;
  
  -- Notify member that ticket was resolved and needs rating
  PERFORM public.create_user_notification(
    v_ticket.requester_id,
    'support_ticket_resolved',
    'Support Ticket Resolved - Please Rate',
    COALESCE(p_resolution_message, 'Your ticket "' || v_ticket.subject || '" has been resolved. Please rate your experience.'),
    jsonb_build_object('ticket_id', p_ticket_id, 'needs_rating', true)
  );
  
  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.officer_resolve_ticket(uuid, text) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- Member resolves their own ticket (forfeits escalation rights)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.member_resolve_ticket(p_ticket_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ticket record;
BEGIN
  -- Get ticket and verify ownership
  SELECT * INTO v_ticket 
  FROM public.support_tickets 
  WHERE id = p_ticket_id AND requester_id = auth.uid();
  
  IF v_ticket IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ticket not found or access denied');
  END IF;
  
  IF v_ticket.pending_rating THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ticket already pending rating');
  END IF;
  
  IF v_ticket.assignee_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot resolve unassigned ticket');
  END IF;
  
  -- Mark as resolved by member, pending rating (no escalation allowed)
  UPDATE public.support_tickets
  SET resolved_by = 'member',
      resolved_at = now(),
      pending_rating = true,
      status = 'resolved',
      updated_at = now()
  WHERE id = p_ticket_id;
  
  -- Notify officer that member resolved the ticket
  PERFORM public.create_user_notification(
    v_ticket.assignee_id,
    'support_ticket_update',
    'Ticket Marked Resolved by Member',
    'Member resolved: ' || v_ticket.subject,
    jsonb_build_object('ticket_id', p_ticket_id)
  );
  
  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.member_resolve_ticket(uuid) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- Rate officer and close/escalate ticket
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.rate_officer_and_close(
  p_ticket_id uuid,
  p_stars smallint,
  p_comment text DEFAULT NULL,
  p_escalate boolean DEFAULT false,
  p_escalation_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ticket record;
  v_officer_id uuid;
  v_super_admin_id uuid;
BEGIN
  -- Validate stars
  IF p_stars < 1 OR p_stars > 5 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Stars must be between 1 and 5');
  END IF;
  
  -- Get ticket and verify ownership + pending rating state
  SELECT * INTO v_ticket 
  FROM public.support_tickets 
  WHERE id = p_ticket_id 
    AND requester_id = auth.uid()
    AND pending_rating = true;
  
  IF v_ticket IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ticket not found, not yours, or not pending rating');
  END IF;
  
  -- Cannot escalate if member resolved it themselves
  IF p_escalate AND v_ticket.resolved_by = 'member' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot escalate ticket you resolved yourself');
  END IF;
  
  -- Cannot escalate with rating >= 3
  IF p_escalate AND p_stars >= 3 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Escalation only available for ratings under 3 stars');
  END IF;
  
  -- Escalation requires a reason
  IF p_escalate AND (p_escalation_reason IS NULL OR trim(p_escalation_reason) = '') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Escalation reason required');
  END IF;
  
  v_officer_id := v_ticket.assignee_id;
  
  -- Record the rating (if there was an assigned officer)
  IF v_officer_id IS NOT NULL THEN
    INSERT INTO public.officer_ratings (ticket_id, officer_id, member_id, stars, comment)
    VALUES (p_ticket_id, v_officer_id, auth.uid(), p_stars, p_comment);
  END IF;
  
  IF p_escalate THEN
    -- Escalate to super-admin
    UPDATE public.support_tickets
    SET is_escalated = true,
        escalated_at = now(),
        escalation_reason = p_escalation_reason,
        pending_rating = false,
        status = 'open',
        updated_at = now()
    WHERE id = p_ticket_id;
    
    -- Notify all super-admins about escalation
    FOR v_super_admin_id IN
      SELECT id FROM public.profiles WHERE role = 'super-admin'
    LOOP
      PERFORM public.create_user_notification(
        v_super_admin_id,
        'support_ticket_escalated',
        'Escalated Support Ticket',
        'Ticket escalated (' || p_stars || ' star rating): ' || v_ticket.subject,
        jsonb_build_object('ticket_id', p_ticket_id, 'stars', p_stars)
      );
    END LOOP;
    
    RETURN jsonb_build_object('success', true, 'escalated', true);
  ELSE
    -- Close and delete ticket
    DELETE FROM public.support_tickets WHERE id = p_ticket_id;
    RETURN jsonb_build_object('success', true, 'escalated', false);
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rate_officer_and_close(uuid, smallint, text, boolean, text) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- Get escalated tickets (super-admin only)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_escalated_tickets()
RETURNS TABLE (
  id uuid,
  category support_ticket_category,
  subject text,
  status support_ticket_status,
  requester_name text,
  requester_id uuid,
  original_assignee_id uuid,
  original_assignee_name text,
  escalation_reason text,
  escalated_at timestamptz,
  rating_stars smallint,
  rating_comment text,
  message_count bigint,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_role text;
BEGIN
  -- Check user is super-admin
  SELECT role INTO v_user_role FROM public.profiles WHERE id = auth.uid();
  IF v_user_role != 'super-admin' THEN
    RETURN;
  END IF;
  
  RETURN QUERY
  SELECT 
    t.id,
    t.category,
    t.subject,
    t.status,
    COALESCE(req.rsi_handle, req.display_name, req.email) as requester_name,
    t.requester_id,
    t.assignee_id as original_assignee_id,
    COALESCE(asgn.rsi_handle, asgn.display_name, 'Unknown') as original_assignee_name,
    t.escalation_reason,
    t.escalated_at,
    r.stars as rating_stars,
    r.comment as rating_comment,
    COUNT(m.id) as message_count,
    t.created_at
  FROM public.support_tickets t
  JOIN public.profiles req ON t.requester_id = req.id
  LEFT JOIN public.profiles asgn ON t.assignee_id = asgn.id
  LEFT JOIN public.officer_ratings r ON r.ticket_id = t.id
  LEFT JOIN public.ticket_messages m ON t.id = m.ticket_id
  WHERE t.is_escalated = true
  GROUP BY t.id, t.category, t.subject, t.status, t.requester_id, t.assignee_id, 
           t.escalation_reason, t.escalated_at, t.created_at,
           req.rsi_handle, req.display_name, req.email,
           asgn.rsi_handle, asgn.display_name,
           r.stars, r.comment
  ORDER BY t.escalated_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_escalated_tickets() TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- Get officer performance stats (super-admin only)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_officer_performance()
RETURNS TABLE (
  officer_id uuid,
  officer_name text,
  total_ratings bigint,
  avg_rating numeric,
  stars_1 bigint,
  stars_2 bigint,
  stars_3 bigint,
  stars_4 bigint,
  stars_5 bigint,
  escalation_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_role text;
BEGIN
  -- Check user is super-admin
  SELECT role INTO v_user_role FROM public.profiles WHERE id = auth.uid();
  IF v_user_role != 'super-admin' THEN
    RETURN;
  END IF;
  
  RETURN QUERY
  SELECT 
    p.id as officer_id,
    COALESCE(p.rsi_handle, p.display_name, p.email) as officer_name,
    COUNT(r.id) as total_ratings,
    ROUND(AVG(r.stars)::numeric, 2) as avg_rating,
    COUNT(*) FILTER (WHERE r.stars = 1) as stars_1,
    COUNT(*) FILTER (WHERE r.stars = 2) as stars_2,
    COUNT(*) FILTER (WHERE r.stars = 3) as stars_3,
    COUNT(*) FILTER (WHERE r.stars = 4) as stars_4,
    COUNT(*) FILTER (WHERE r.stars = 5) as stars_5,
    (
      SELECT COUNT(*) 
      FROM public.support_tickets t2 
      WHERE t2.assignee_id = p.id AND t2.is_escalated = true
    ) as escalation_count
  FROM public.profiles p
  LEFT JOIN public.officer_ratings r ON r.officer_id = p.id
  WHERE p.role IN ('officer', 'super-admin')
  GROUP BY p.id, p.rsi_handle, p.display_name, p.email
  HAVING COUNT(r.id) > 0 OR EXISTS (
    SELECT 1 FROM public.support_tickets t3 
    WHERE t3.assignee_id = p.id
  )
  ORDER BY avg_rating DESC NULLS LAST, total_ratings DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_officer_performance() TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- Super-admin resolves escalated ticket (final resolution)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.super_admin_resolve_escalation(
  p_ticket_id uuid,
  p_resolution_message text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_role text;
  v_ticket record;
BEGIN
  -- Check user is super-admin
  SELECT role INTO v_user_role FROM public.profiles WHERE id = auth.uid();
  IF v_user_role != 'super-admin' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Super-admin access required');
  END IF;
  
  -- Get ticket details
  SELECT * INTO v_ticket 
  FROM public.support_tickets 
  WHERE id = p_ticket_id AND is_escalated = true;
  
  IF v_ticket IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Escalated ticket not found');
  END IF;
  
  -- Notify member of final resolution
  PERFORM public.create_user_notification(
    v_ticket.requester_id,
    'support_ticket_resolved',
    'Escalated Ticket Resolved',
    COALESCE(p_resolution_message, 'Your escalated ticket "' || v_ticket.subject || '" has been reviewed and resolved by a super-admin.'),
    jsonb_build_object('ticket_subject', v_ticket.subject, 'was_escalated', true)
  );
  
  -- Delete the ticket (rating already recorded)
  DELETE FROM public.support_tickets WHERE id = p_ticket_id;
  
  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.super_admin_resolve_escalation(uuid, text) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- Update get_my_tickets to include pending_rating tickets
-- ─────────────────────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.get_my_tickets();
CREATE OR REPLACE FUNCTION public.get_my_tickets()
RETURNS TABLE (
  id uuid,
  category support_ticket_category,
  subject text,
  status support_ticket_status,
  assignee_name text,
  message_count bigint,
  last_message_at timestamptz,
  created_at timestamptz,
  pending_rating boolean,
  resolved_by ticket_resolver,
  resolution_message text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t.id,
    t.category,
    t.subject,
    t.status,
    COALESCE(p.rsi_handle, p.display_name, 'Staff') as assignee_name,
    COUNT(m.id) as message_count,
    MAX(m.created_at) as last_message_at,
    t.created_at,
    t.pending_rating,
    t.resolved_by,
    t.resolution_message
  FROM public.support_tickets t
  LEFT JOIN public.profiles p ON t.assignee_id = p.id
  LEFT JOIN public.ticket_messages m ON t.id = m.ticket_id
  WHERE t.requester_id = auth.uid()
  AND (t.status != 'resolved' OR t.pending_rating = true)
  AND t.is_escalated = false
  GROUP BY t.id, t.category, t.subject, t.status, t.pending_rating, t.resolved_by, 
           t.resolution_message, p.rsi_handle, p.display_name, t.created_at
  ORDER BY t.pending_rating DESC, t.updated_at DESC;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Update get_ticket_detail to include new fields
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_ticket_detail(p_ticket_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_role text;
  v_ticket jsonb;
  v_messages jsonb;
  v_rating jsonb;
BEGIN
  SELECT role INTO v_user_role FROM public.profiles WHERE id = auth.uid();
  
  -- Get ticket info
  SELECT jsonb_build_object(
    'id', t.id,
    'category', t.category,
    'subject', t.subject,
    'status', t.status,
    'requester_id', t.requester_id,
    'requester_name', COALESCE(req.rsi_handle, req.display_name, req.email),
    'assignee_id', t.assignee_id,
    'assignee_name', COALESCE(asgn.rsi_handle, asgn.display_name, 'Unassigned'),
    'reported_user_id', t.reported_user_id,
    'reported_user_name', COALESCE(rep.rsi_handle, rep.display_name, NULL),
    'created_at', t.created_at,
    'updated_at', t.updated_at,
    'pending_rating', t.pending_rating,
    'resolved_by', t.resolved_by,
    'resolution_message', t.resolution_message,
    'is_escalated', t.is_escalated,
    'escalated_at', t.escalated_at,
    'escalation_reason', t.escalation_reason
  ) INTO v_ticket
  FROM public.support_tickets t
  JOIN public.profiles req ON t.requester_id = req.id
  LEFT JOIN public.profiles asgn ON t.assignee_id = asgn.id
  LEFT JOIN public.profiles rep ON t.reported_user_id = rep.id
  WHERE t.id = p_ticket_id
  AND (t.requester_id = auth.uid() OR v_user_role IN ('officer', 'super-admin'));
  
  IF v_ticket IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ticket not found or access denied');
  END IF;
  
  -- Get messages
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', m.id,
      'content', m.content,
      'is_staff', m.is_staff,
      'author_name', COALESCE(p.rsi_handle, p.display_name, p.email),
      'created_at', m.created_at
    ) ORDER BY m.created_at ASC
  ), '[]'::jsonb) INTO v_messages
  FROM public.ticket_messages m
  JOIN public.profiles p ON m.author_id = p.id
  WHERE m.ticket_id = p_ticket_id;
  
  -- Get rating if exists (only for super-admins viewing escalated tickets)
  IF v_user_role = 'super-admin' THEN
    SELECT jsonb_build_object(
      'stars', r.stars,
      'comment', r.comment,
      'created_at', r.created_at
    ) INTO v_rating
    FROM public.officer_ratings r
    WHERE r.ticket_id = p_ticket_id;
  END IF;
  
  RETURN jsonb_build_object(
    'success', true,
    'ticket', v_ticket,
    'messages', v_messages,
    'rating', v_rating
  );
END;
$$;
