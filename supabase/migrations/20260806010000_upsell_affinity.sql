-- -----------------------------------------------------------------------------
-- 20260806010000_upsell_affinity.sql
-- -----------------------------------------------------------------------------
-- Three fixes to the upsell engine, all reproduced against the live API.
--
-- 1. CATEGORY AFFINITY WAS NEVER CONSULTED.
--    `upsell_category_affinity` has a table, an API, and an admin screen, but
--    `get_upsell_suggestions` never read it. An owner configuring "when a Main
--    is added, suggest a Drink" changed nothing: the margin fallback happily
--    proposed another burger, because every item with a cost_price qualified.
--
--    Now: when the trigger item's category has affinity rules, they define the
--    universe of acceptable suggestions. Curated item-level pairings still win
--    (an explicit pair beats a category rule), then affinity, then
--    co-occurrence, then margin — and the last two are RESTRICTED to the
--    affinity target categories when any rule exists. Without that restriction
--    "suggest a drink" is advice the fallback is free to ignore, which is
--    exactly the reported bug.
--
-- 2. sort_order HAD NO DEFAULT.
--    `upselling_combinations.sort_order` is NOT NULL with no default. The API
--    treats sortOrder as optional, so omitting it sent null:
--      null value in column "sort_order" ... violates not-null constraint
--    which surfaced as a generic "Failed to create pairings". Creating any
--    pairing from the admin UI was impossible.
--
-- 3. p_declined_item_ids HAD NO DEFAULT.
--    The API treats declinedItemIds as optional; omitting it dropped the
--    argument and no function matched the signature, 500-ing the whole
--    suggestions endpoint. Defaults added for both optional arrays.
-- -----------------------------------------------------------------------------

--------------------------------------------------------------------------------
-- 1. sort_order default
--------------------------------------------------------------------------------
ALTER TABLE public.upselling_combinations
  ALTER COLUMN sort_order SET DEFAULT 0;

UPDATE public.upselling_combinations SET sort_order = 0 WHERE sort_order IS NULL;

--------------------------------------------------------------------------------
-- 2. get_upsell_suggestions — affinity-aware, optional args defaulted
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_upsell_suggestions(
  p_session_id uuid,
  p_trigger text,
  p_trigger_item_id uuid DEFAULT NULL,
  p_cart_item_ids uuid[] DEFAULT '{}',
  p_declined_item_ids uuid[] DEFAULT '{}',
  p_impressions_this_round int DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_session RECORD;
  v_rules RECORD;
  v_suggestions jsonb := '[]'::jsonb;
  v_max_impressions int;
  v_source_category_id uuid;
  v_has_affinity boolean := false;
BEGIN
  SELECT * INTO v_session FROM table_sessions
  WHERE id = p_session_id AND closed_at IS NULL AND expires_at > now();
  IF NOT FOUND THEN
    RETURN jsonb_build_object('suggestions', '[]'::jsonb, 'remaining_impressions', 0);
  END IF;

  SELECT * INTO v_rules FROM upsell_rules WHERE restaurant_id = v_session.restaurant_id;
  IF NOT FOUND OR NOT v_rules.is_enabled THEN
    RETURN jsonb_build_object('suggestions', '[]'::jsonb, 'remaining_impressions', 0);
  END IF;

  v_max_impressions := v_rules.max_impressions_per_round - p_impressions_this_round;
  IF v_max_impressions <= 0 THEN
    RETURN jsonb_build_object('suggestions', '[]'::jsonb, 'remaining_impressions', 0);
  END IF;

  -- Which category triggered this, and does the owner have a rule for it?
  SELECT category_id INTO v_source_category_id
  FROM menu_items WHERE id = p_trigger_item_id;

  SELECT EXISTS (
    SELECT 1 FROM upsell_category_affinity
    WHERE restaurant_id = v_session.restaurant_id
      AND source_category_id = v_source_category_id
  ) INTO v_has_affinity;

  WITH available_items AS (
    -- LEFT JOIN + `bm.available IS NOT FALSE`: no branch row means available.
    SELECT m.id, m.name, m.category_id, COALESCE(bm.price_override, m.price) AS active_price, m.cost_price
    FROM menu_items m
    LEFT JOIN branch_menu_items bm ON bm.menu_item_id = m.id AND bm.branch_id = v_session.branch_id
    WHERE m.restaurant_id = v_session.restaurant_id
      AND bm.available IS NOT FALSE AND m.is_active = true AND m.deleted_at IS NULL
      AND (p_cart_item_ids IS NULL OR m.id != ALL(p_cart_item_ids))
      AND (p_declined_item_ids IS NULL OR m.id != ALL(p_declined_item_ids))
      AND (p_trigger_item_id IS NULL OR m.id != p_trigger_item_id)
  ),
  -- The categories the owner said to cross-sell into, best priority first.
  affinity_targets AS (
    SELECT target_category_id, min(priority) AS priority
    FROM upsell_category_affinity
    WHERE restaurant_id = v_session.restaurant_id
      AND source_category_id = v_source_category_id
    GROUP BY target_category_id
  ),
  -- Items the fallbacks are allowed to reach for. When affinity is configured
  -- it is a hard filter, not a hint — otherwise "suggest a drink" loses to
  -- "popular choice: another burger".
  eligible_items AS (
    SELECT a.* FROM available_items a
    WHERE NOT v_has_affinity
       OR a.category_id IN (SELECT target_category_id FROM affinity_targets)
  ),
  -- 1. Curated pairings: an explicit item-to-item rule outranks everything.
  source_a AS (
    SELECT a.id, a.name, a.active_price AS price, 'curated' AS source,
           'Recommended with your item' AS reason, uc.sort_order AS priority
    FROM available_items a
    JOIN upselling_combinations uc ON uc.target_item_id = a.id
    WHERE uc.source_item_id = p_trigger_item_id
  ),
  -- 2. Category affinity: the owner's cross-sell rule.
  source_b AS (
    SELECT e.id, e.name, e.active_price AS price, 'affinity' AS source,
           'Goes well with this' AS reason, (1000 + t.priority) AS priority
    FROM eligible_items e
    JOIN affinity_targets t ON t.target_category_id = e.category_id
  ),
  -- 3. Data-driven co-occurrence. item_pair_scores stores each unordered pair
  --    once as (item_a, item_b), so match the trigger against EITHER side.
  source_c AS (
    SELECT e.id, e.name, e.active_price AS price, 'co_occurrence' AS source,
           'Often ordered together' AS reason, (100000 - ips.lift_bps) AS priority
    FROM eligible_items e
    JOIN item_pair_scores ips
      ON (ips.item_a = p_trigger_item_id AND ips.item_b = e.id)
      OR (ips.item_b = p_trigger_item_id AND ips.item_a = e.id)
    WHERE ips.lift_bps >= v_rules.minimum_lift_bps
      AND ips.support_bps >= v_rules.minimum_support_bps
  ),
  -- 4. Margin fallback (popular / high-margin choices).
  source_d AS (
    SELECT e.id, e.name, e.active_price AS price, 'margin' AS source,
           'Popular choice' AS reason, (1000000 - (e.active_price - e.cost_price)) AS priority
    FROM eligible_items e
    WHERE e.cost_price IS NOT NULL AND e.active_price > e.cost_price
  ),
  blended AS (
    SELECT * FROM source_a
    UNION ALL
    SELECT * FROM source_b WHERE NOT EXISTS (SELECT 1 FROM source_a WHERE source_a.id = source_b.id)
    UNION ALL
    SELECT * FROM source_c WHERE NOT EXISTS (SELECT 1 FROM source_a WHERE source_a.id = source_c.id)
                             AND NOT EXISTS (SELECT 1 FROM source_b WHERE source_b.id = source_c.id)
    UNION ALL
    SELECT * FROM source_d WHERE NOT EXISTS (SELECT 1 FROM source_a WHERE source_a.id = source_d.id)
                             AND NOT EXISTS (SELECT 1 FROM source_b WHERE source_b.id = source_d.id)
                             AND NOT EXISTS (SELECT 1 FROM source_c WHERE source_c.id = source_d.id)
  )
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'menuItemId', id,
      'name', name,
      'price', price,
      'source', source,
      'reason', reason
    )
  ), '[]'::jsonb) INTO v_suggestions
  FROM (
    SELECT * FROM blended ORDER BY priority ASC LIMIT v_max_impressions
  ) top_n;

  RETURN jsonb_build_object(
    'suggestions', v_suggestions,
    'remaining_impressions', v_max_impressions
  );
END;
$$;
