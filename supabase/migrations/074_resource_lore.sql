-- 074 resource lore descriptions
-- Add description column to store lore/flavor text from star-citizen.wiki

ALTER TABLE public.blueprint_resources
ADD COLUMN IF NOT EXISTS description text DEFAULT NULL;

COMMENT ON COLUMN public.blueprint_resources.description IS 
  'Lore/flavor text for the resource, sourced from star-citizen.wiki API';
