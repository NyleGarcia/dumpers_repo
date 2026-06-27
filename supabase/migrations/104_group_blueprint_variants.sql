-- Per-user preference: collapse FPS weapon/armor variant families on Blueprints grid (off by default).

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS group_blueprint_variants boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.profiles.group_blueprint_variants IS
  'When true, FPS weapon and armor blueprint variants collapse into expandable family cards on the Blueprints page.';
