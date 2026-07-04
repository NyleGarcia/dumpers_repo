-- Create table for user API keys
CREATE TABLE public.user_api_keys (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
    api_key text NOT NULL UNIQUE DEFAULT 'dr_' || encode(gen_random_bytes(24), 'hex'),
    created_at timestamptz DEFAULT now(),
    last_used_at timestamptz
);

-- Index for fast lookup by API key
CREATE INDEX idx_user_api_keys_key ON public.user_api_keys(api_key);
CREATE INDEX idx_user_api_keys_user ON public.user_api_keys(user_id);

-- RLS
ALTER TABLE public.user_api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own API keys"
    ON public.user_api_keys FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own API keys"
    ON public.user_api_keys FOR INSERT
    TO authenticated
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own API keys"
    ON public.user_api_keys FOR DELETE
    TO authenticated
    USING (user_id = auth.uid());

-- Get or create API key for current user (one key per user)
CREATE OR REPLACE FUNCTION public.get_or_create_api_key()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_key text;
BEGIN
    IF auth.uid() IS NULL THEN
        RETURN NULL;
    END IF;

    SELECT api_key INTO v_key FROM user_api_keys WHERE user_id = auth.uid() LIMIT 1;
    
    IF v_key IS NULL THEN
        INSERT INTO user_api_keys (user_id) VALUES (auth.uid()) RETURNING api_key INTO v_key;
    END IF;

    RETURN v_key;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_or_create_api_key() TO authenticated;

-- Regenerate API key (delete old, create new)
CREATE OR REPLACE FUNCTION public.regenerate_api_key()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_key text;
BEGIN
    IF auth.uid() IS NULL THEN
        RETURN NULL;
    END IF;

    DELETE FROM user_api_keys WHERE user_id = auth.uid();
    INSERT INTO user_api_keys (user_id) VALUES (auth.uid()) RETURNING api_key INTO v_key;

    RETURN v_key;
END;
$$;

GRANT EXECUTE ON FUNCTION public.regenerate_api_key() TO authenticated;
