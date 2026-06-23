# Migration 081 — RSI org schema (DB only)

Copy to `supabase/migrations/081_rsi_org_schema.sql` when implementing.

```sql
-- SC org affiliation + org webhook schema (no site code / no send-discord org fan-out yet)

CREATE TABLE IF NOT EXISTS public.rsi_orgs (
  org_sid text PRIMARY KEY,
  org_name text,
  logo_url text,
  member_count int,
  ranks_scraped_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.rsi_org_ranks (
  org_sid text NOT NULL REFERENCES public.rsi_orgs(org_sid) ON DELETE CASCADE,
  rank_id int NOT NULL,
  rank_name text NOT NULL,
  rank_stars int,
  can_manage_webhooks boolean NOT NULL DEFAULT false,
  scraped_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (org_sid, rank_id)
);

CREATE TABLE IF NOT EXISTS public.user_rsi_org_affiliations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  org_sid text NOT NULL REFERENCES public.rsi_orgs(org_sid) ON DELETE CASCADE,
  rank_title text,
  rank_stars int,
  is_main_org boolean NOT NULL DEFAULT false,
  scraped_at timestamptz NOT NULL DEFAULT now(),
  scrape_source text NOT NULL DEFAULT 'citizen_page',
  UNIQUE (user_id, org_sid)
);

CREATE INDEX IF NOT EXISTS user_rsi_org_affiliations_user_idx
  ON public.user_rsi_org_affiliations (user_id);

CREATE INDEX IF NOT EXISTS user_rsi_org_affiliations_org_idx
  ON public.user_rsi_org_affiliations (org_sid);

CREATE TABLE IF NOT EXISTS public.discord_org_webhooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_sid text NOT NULL REFERENCES public.rsi_orgs(org_sid) ON DELETE CASCADE,
  webhook_url text NOT NULL,
  webhook_name text NOT NULL,
  subscribed_events text[] NOT NULL DEFAULT '{}'::text[],
  registered_by_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  verification_method text NOT NULL CHECK (verification_method IN ('roster_auto', 'staff_approved')),
  verified_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  active boolean NOT NULL DEFAULT true,
  last_success_at timestamptz,
  failure_count int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS discord_org_webhooks_url_unique
  ON public.discord_org_webhooks (webhook_url)
  WHERE revoked_at IS NULL;

CREATE TABLE IF NOT EXISTS public.org_webhook_registration_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_sid text NOT NULL,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  webhook_url text NOT NULL,
  webhook_name text NOT NULL,
  scraped_rank_title text,
  scraped_rank_stars int,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied')),
  reviewed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  review_notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.rsi_orgs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rsi_org_ranks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_rsi_org_affiliations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discord_org_webhooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_webhook_registration_requests ENABLE ROW LEVEL SECURITY;

-- Service role / future RPCs only; no member policies until Phase 2 site code

COMMENT ON TABLE public.user_rsi_org_affiliations IS 'RSI scrape: many orgs per user. Populated by future refresh-rsi-affiliations.';
COMMENT ON TABLE public.discord_org_webhooks IS 'Org Discord channels. Registration requires verified leadership (Phase 2).';
```
