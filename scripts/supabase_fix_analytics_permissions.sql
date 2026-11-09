-- ==============================================================================
-- SanGoub Analytics Tables Permission Fix
-- Grants read access on aggregated visitor tables to authenticated & anon roles.
-- Keeps raw visitor IP/hash table (site_visitors) secure.
-- ==============================================================================

-- 1. Grant SELECT on aggregated tables
GRANT SELECT ON public.site_visitor_totals TO anon, authenticated;
GRANT SELECT ON public.site_visitor_days TO anon, authenticated;

-- 2. Drop any restrictive RLS policies on aggregated tables
DROP POLICY IF EXISTS "Allow select visitor totals" ON public.site_visitor_totals;
DROP POLICY IF EXISTS "Allow select visitor days" ON public.site_visitor_days;

-- 3. Create permissive SELECT policies for dashboard view
CREATE POLICY "Allow select visitor totals" ON public.site_visitor_totals
  FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY "Allow select visitor days" ON public.site_visitor_days
  FOR SELECT TO anon, authenticated
  USING (true);

-- 4. Ensure initial totals row exists so queries never return empty
INSERT INTO public.site_visitor_totals (id, visitors, started_at, analytics_started_at)
VALUES (true, 0, now(), now())
ON CONFLICT (id) DO NOTHING;

-- 5. Grant execute on the visit recording RPC function
GRANT EXECUTE ON FUNCTION public.record_sangoub_site_visit(text, date, text, text) TO anon, authenticated;
