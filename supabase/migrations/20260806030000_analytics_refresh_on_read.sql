-- -----------------------------------------------------------------------------
-- 20260806030000_analytics_refresh_on_read.sql
-- -----------------------------------------------------------------------------
-- The dashboard and analytics screens showed nothing even when completed orders
-- existed. Neither reads live tables: both go through materialized views
-- (daily_sales_by_branch, item_performance, ...) which are only ever refreshed
-- inside run_end_of_day(), and nothing schedules that. There is no pg_cron job
-- and no backend caller, so in practice the views were last refreshed by
-- whoever ran a migration or a test — every order placed since was invisible.
--
-- Verified on the live database: 8 orders present, item_performance holding 7
-- stale rows, and the newest restaurant's order absent from both views.
--
-- Fix: let a read refresh the views, throttled so a busy dashboard cannot spin
-- them continuously. `refresh_analytics_if_stale` refreshes at most once per
-- p_max_age_seconds and is a no-op otherwise, so N concurrent dashboard loads
-- cost one refresh.
--
-- This is deliberately a pilot-scale solution: REFRESH MATERIALIZED VIEW
-- rescans the source tables, which is cheap at this size but will not stay
-- cheap. The long-term answer is a scheduled refresh (pg_cron) with the read
-- path never refreshing; leaving this note so that swap is an obvious one.
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.analytics_refresh_state (
  id                boolean PRIMARY KEY DEFAULT true,
  last_refreshed_at timestamptz NOT NULL DEFAULT to_timestamp(0),
  CONSTRAINT analytics_refresh_state_single_row CHECK (id)
);

INSERT INTO public.analytics_refresh_state (id) VALUES (true)
ON CONFLICT (id) DO NOTHING;

-- Not tenant-scoped: it holds one timestamp and no business data. Locked down
-- anyway so it is never readable through PostgREST by a diner or staff token.
ALTER TABLE public.analytics_refresh_state ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.refresh_analytics_if_stale(p_max_age_seconds int DEFAULT 60)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_last timestamptz;
  v_refreshed boolean := false;
BEGIN
  SELECT last_refreshed_at INTO v_last FROM analytics_refresh_state WHERE id;

  IF v_last IS NULL OR v_last < now() - make_interval(secs => p_max_age_seconds) THEN
    -- Claim the refresh before doing it. FOR UPDATE SKIP LOCKED means a second
    -- caller arriving mid-refresh returns immediately with stale data instead
    -- of queueing behind a full rescan.
    PERFORM 1 FROM analytics_refresh_state WHERE id FOR UPDATE SKIP LOCKED;
    IF FOUND THEN
      -- Non-concurrent on purpose: CONCURRENTLY errors on a view that has
      -- never been populated, which is exactly the state a fresh database is
      -- in. These are small enough that the brief lock is not a problem.
      REFRESH MATERIALIZED VIEW public.daily_sales_by_branch;
      REFRESH MATERIALIZED VIEW public.item_performance;
      REFRESH MATERIALIZED VIEW public.kitchen_timings;
      REFRESH MATERIALIZED VIEW public.kitchen_item_timings;
      REFRESH MATERIALIZED VIEW public.order_heatmap;
      REFRESH MATERIALIZED VIEW public.upsell_performance;
      REFRESH MATERIALIZED VIEW public.model_3d_conversion;

      BEGIN
        REFRESH MATERIALIZED VIEW public.item_pair_scores;
      EXCEPTION WHEN others THEN
        NULL; -- optional view; never fail a dashboard load over it
      END;

      UPDATE analytics_refresh_state SET last_refreshed_at = now() WHERE id;
      v_refreshed := true;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'refreshed', v_refreshed,
    'lastRefreshedAt', (SELECT last_refreshed_at FROM analytics_refresh_state WHERE id)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.refresh_analytics_if_stale(int) TO authenticated;
