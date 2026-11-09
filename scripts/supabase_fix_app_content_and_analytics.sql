-- ==============================================================================
-- SanGoub Fix: Permissions for App Content (Slider/Banners) & Site Analytics
-- Run this once in Supabase Dashboard -> SQL Editor
-- ==============================================================================

-- 1. APP CONTENT (Slider, Banners, Home layout, Category overrides)
-- Allow authenticated users to read and write app content
GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_content TO authenticated;
GRANT SELECT ON public.app_content TO anon;

ALTER TABLE public.app_content ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated all app_content" ON public.app_content;
CREATE POLICY "Allow authenticated all app_content" ON public.app_content
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Public read app_content" ON public.app_content;
CREATE POLICY "Public read app_content" ON public.app_content
  FOR SELECT TO anon, authenticated
  USING (true);

-- Ensure initial row exists
INSERT INTO public.app_content (id, content)
VALUES (true, '{}'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- SECURITY DEFINER RPC to ensure saving slider/content always succeeds
CREATE OR REPLACE FUNCTION public.save_sangoub_app_content(p_content jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  INSERT INTO public.app_content (id, content, updated_at)
  VALUES (true, p_content, now())
  ON CONFLICT (id) DO UPDATE SET
    content = EXCLUDED.content,
    updated_at = now();
  RETURN p_content;
END;
$$;
GRANT EXECUTE ON FUNCTION public.save_sangoub_app_content(jsonb) TO authenticated, anon;


-- 2. SITE VISITOR STATS (Analytics Dashboard)
-- Allow read access on aggregated statistics tables
GRANT SELECT ON public.site_visitor_totals TO anon, authenticated;
GRANT SELECT ON public.site_visitor_days TO anon, authenticated;

DROP POLICY IF EXISTS "Allow select visitor totals" ON public.site_visitor_totals;
CREATE POLICY "Allow select visitor totals" ON public.site_visitor_totals
  FOR SELECT TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Allow select visitor days" ON public.site_visitor_days;
CREATE POLICY "Allow select visitor days" ON public.site_visitor_days
  FOR SELECT TO anon, authenticated
  USING (true);

INSERT INTO public.site_visitor_totals (id, visitors, started_at, analytics_started_at)
VALUES (true, 0, now(), now())
ON CONFLICT (id) DO NOTHING;

GRANT EXECUTE ON FUNCTION public.record_sangoub_site_visit(text, date, text, text) TO anon, authenticated;
