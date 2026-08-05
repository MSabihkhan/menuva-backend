-- -----------------------------------------------------------------------------
-- 20260712200000_analytics_completions.sql
-- -----------------------------------------------------------------------------
-- Idempotently (re)creates the analytics materialized views missing from
-- migrations, along with their unique indexes and wrapper functions.
-- It also fixes the `model_3d_conversion` view to compute real conversion stats,
-- captures the correct live state of `run_end_of_day`, and adds a helper function
-- for test setups to populate the matviews.

--------------------------------------------------------------------------------
-- 1. item_performance (with category_id)
--------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.get_item_performance();
DROP MATERIALIZED VIEW IF EXISTS public.item_performance;

CREATE MATERIALIZED VIEW public.item_performance AS
WITH window_sales AS (
    SELECT o.restaurant_id,
        oli.menu_item_id,
        sum(oli.quantity)::integer AS units_sold,
        sum(oli.unit_price_snapshot * oli.quantity) AS revenue_paisa
    FROM orders o
    JOIN order_line_items oli ON oli.order_id = o.id
    WHERE o.placed_at >= (now() - '90 days'::interval)
    GROUP BY o.restaurant_id, oli.menu_item_id
)
SELECT w.restaurant_id,
    w.menu_item_id,
    m.category_id,
    w.units_sold,
    w.revenue_paisa,
    m.cost_price::bigint AS cost_paisa,
    CASE
        WHEN m.cost_price IS NOT NULL THEN w.revenue_paisa - m.cost_price * w.units_sold
        ELSE NULL::bigint
    END AS margin_paisa,
    dense_rank() OVER (PARTITION BY w.restaurant_id ORDER BY w.units_sold DESC)::integer AS popularity_rank
FROM window_sales w
JOIN menu_items m ON m.id = w.menu_item_id;

CREATE UNIQUE INDEX IF NOT EXISTS item_performance_uidx ON public.item_performance USING btree (restaurant_id, menu_item_id);

CREATE OR REPLACE FUNCTION public.get_item_performance()
RETURNS SETOF item_performance
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
    IF nullif(current_setting('app.current_user_role', true), '') != 'owner' THEN
        RAISE EXCEPTION 'INSUFFICIENT_ROLE' USING errcode = '42501';
    END IF;
    RETURN QUERY SELECT * FROM public.item_performance
    WHERE restaurant_id = nullif(current_setting('app.current_restaurant_id', true), '')::uuid;
END;
$function$;

--------------------------------------------------------------------------------
-- 2. kitchen_item_timings
--------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.get_kitchen_item_timings();
DROP MATERIALIZED VIEW IF EXISTS public.kitchen_item_timings;

CREATE MATERIALIZED VIEW public.kitchen_item_timings AS
SELECT o.restaurant_id,
    o.branch_id,
    oli.menu_item_id,
    avg(EXTRACT(epoch FROM o.updated_at - o.placed_at))::integer AS avg_time_sec,
    count(*)::integer AS sample_count
FROM orders o
JOIN order_line_items oli ON oli.order_id = o.id
WHERE o.placed_at >= (now() - '90 days'::interval)
GROUP BY o.restaurant_id, o.branch_id, oli.menu_item_id;

CREATE UNIQUE INDEX IF NOT EXISTS kitchen_item_timings_uidx ON public.kitchen_item_timings USING btree (restaurant_id, branch_id, menu_item_id);

CREATE OR REPLACE FUNCTION public.get_kitchen_item_timings()
RETURNS SETOF kitchen_item_timings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
    IF nullif(current_setting('app.current_user_role', true), '') NOT IN ('owner', 'branch_manager') THEN
        RAISE EXCEPTION 'INSUFFICIENT_ROLE' USING errcode = '42501';
    END IF;
    RETURN QUERY SELECT * FROM public.kitchen_item_timings
    WHERE restaurant_id = nullif(current_setting('app.current_restaurant_id', true), '')::uuid;
END;
$function$;

--------------------------------------------------------------------------------
-- 3. order_heatmap
--------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.get_order_heatmap();
DROP MATERIALIZED VIEW IF EXISTS public.order_heatmap;

CREATE MATERIALIZED VIEW public.order_heatmap AS
SELECT restaurant_id,
    branch_id,
    EXTRACT(dow FROM placed_at)::integer AS dow,
    EXTRACT(hour FROM placed_at)::integer AS hour,
    count(*)::integer AS order_count
FROM orders
WHERE placed_at >= (now() - '90 days'::interval)
GROUP BY restaurant_id, branch_id, (EXTRACT(dow FROM placed_at)::integer), (EXTRACT(hour FROM placed_at)::integer);

CREATE UNIQUE INDEX IF NOT EXISTS order_heatmap_uidx ON public.order_heatmap USING btree (restaurant_id, branch_id, dow, hour);

CREATE OR REPLACE FUNCTION public.get_order_heatmap()
RETURNS SETOF order_heatmap
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
    IF nullif(current_setting('app.current_user_role', true), '') NOT IN ('owner', 'branch_manager') THEN
        RAISE EXCEPTION 'INSUFFICIENT_ROLE' USING errcode = '42501';
    END IF;
    RETURN QUERY SELECT * FROM public.order_heatmap
    WHERE restaurant_id = nullif(current_setting('app.current_restaurant_id', true), '')::uuid;
END;
$function$;

--------------------------------------------------------------------------------
-- 4. model_3d_conversion (Corrected to compute real stats)
--------------------------------------------------------------------------------
DROP MATERIALIZED VIEW IF EXISTS public.model_3d_conversion;

CREATE MATERIALIZED VIEW public.model_3d_conversion AS
WITH views AS (
    SELECT tenant_id AS restaurant_id,
        (payload ->> 'menu_item_id'::text)::uuid AS menu_item_id,
        count(*)::integer AS viewed_3d_count
    FROM events
    WHERE event_type = 'model_3d_viewed'::text
    GROUP BY tenant_id, ((payload ->> 'menu_item_id'::text)::uuid)
),
orders_cnt AS (
    SELECT o.restaurant_id, oli.menu_item_id, sum(oli.quantity)::integer as ordered_count
    FROM orders o
    JOIN order_line_items oli ON oli.order_id = o.id
    WHERE o.placed_at >= (now() - '90 days'::interval)
    GROUP BY o.restaurant_id, oli.menu_item_id
)
SELECT v.restaurant_id,
       v.menu_item_id,
       v.viewed_3d_count,
       COALESCE(o.ordered_count, 0)::integer AS ordered_count,
       (COALESCE(o.ordered_count, 0) * 10000 / NULLIF(v.viewed_3d_count, 0))::integer AS conversion_bps
FROM views v
LEFT JOIN orders_cnt o ON o.restaurant_id = v.restaurant_id AND o.menu_item_id = v.menu_item_id;

CREATE UNIQUE INDEX IF NOT EXISTS model_3d_conversion_uidx ON public.model_3d_conversion USING btree (restaurant_id, menu_item_id);

--------------------------------------------------------------------------------
-- 5. Corrected run_end_of_day
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.run_end_of_day()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_applied int := 0;
    v_row record;
BEGIN
    FOR v_row IN
        SELECT pc.id, pc.menu_item_id, pc.new_price, pc.requested_by, mi.price as old_price
        FROM pending_price_changes pc
        JOIN menu_items mi ON mi.id = pc.menu_item_id
        WHERE pc.status = 'pending'
        FOR UPDATE OF pc
    LOOP
        UPDATE menu_items SET price = v_row.new_price, updated_at = now()
            WHERE id = v_row.menu_item_id;
        UPDATE pending_price_changes
            SET status = 'applied', applied_at = now()
            WHERE id = v_row.id;
            
        INSERT INTO audit_log (restaurant_id, actor_id, actor_type, action,
                                entity_type, entity_id, old_value, new_value, occurred_at)
        SELECT mi.restaurant_id, v_row.requested_by, 'system', 'price_changed',
                'menu_item', v_row.menu_item_id,
                jsonb_build_object('price', v_row.old_price),
                jsonb_build_object('price', v_row.new_price),
                now()
        FROM menu_items mi WHERE mi.id = v_row.menu_item_id;
        v_applied := v_applied + 1;
    END LOOP;

    REFRESH MATERIALIZED VIEW CONCURRENTLY item_pair_scores;
    REFRESH MATERIALIZED VIEW CONCURRENTLY daily_sales_by_branch;
    REFRESH MATERIALIZED VIEW CONCURRENTLY item_performance;
    REFRESH MATERIALIZED VIEW CONCURRENTLY kitchen_timings;
    REFRESH MATERIALIZED VIEW CONCURRENTLY kitchen_item_timings;
    REFRESH MATERIALIZED VIEW CONCURRENTLY order_heatmap;
    REFRESH MATERIALIZED VIEW CONCURRENTLY upsell_performance;
    REFRESH MATERIALIZED VIEW CONCURRENTLY model_3d_conversion;

    PERFORM create_events_partition(
        extract(year  from now() + interval '1 month')::int,
        extract(month from now() + interval '1 month')::int
    );

    RETURN jsonb_build_object(
        'prices_applied', v_applied,
        'matviews_refreshed', 8,
        'ran_at', now()
    );
END;
$function$;

--------------------------------------------------------------------------------
-- 6. Helper for tests (Task 4)
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.refresh_all_analytics()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
    -- Standard non-concurrent refreshes because matviews might be empty
    REFRESH MATERIALIZED VIEW public.item_pair_scores;
    REFRESH MATERIALIZED VIEW public.daily_sales_by_branch;
    REFRESH MATERIALIZED VIEW public.item_performance;
    REFRESH MATERIALIZED VIEW public.kitchen_timings;
    REFRESH MATERIALIZED VIEW public.upsell_performance;
    REFRESH MATERIALIZED VIEW public.model_3d_conversion;
    REFRESH MATERIALIZED VIEW public.kitchen_item_timings;
    REFRESH MATERIALIZED VIEW public.order_heatmap;
END;
$$;
