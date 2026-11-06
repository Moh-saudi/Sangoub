CREATE TABLE IF NOT EXISTS public.app_content (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  content jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(content)='object'),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.app_content ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.app_content FROM anon, authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.app_content TO service_role;
