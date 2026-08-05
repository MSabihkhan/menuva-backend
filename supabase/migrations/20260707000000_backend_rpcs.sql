-- PART A: Missing RPCs for Orders and Upsell

-- 1. log_upsell_event
CREATE OR REPLACE FUNCTION public.log_upsell_event(
  p_session_id uuid,
  p_event_type text,
  p_payload jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_session RECORD;
BEGIN
  -- Fire-and-forget: swallow all errors to never fail the caller
  BEGIN
    SELECT * INTO v_session FROM table_sessions WHERE id = p_session_id;
    IF FOUND THEN
      -- Write to the partitioned events table, NOT audit_log
      INSERT INTO events (
        tenant_id, branch_id, session_id, actor_type, event_type, payload, occurred_at
      ) VALUES (
        v_session.restaurant_id, v_session.branch_id, p_session_id, 'diner', p_event_type, p_payload, now()
      );
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- Ignore
  END;
END;
$$;

-- 2. get_upsell_suggestions
CREATE OR REPLACE FUNCTION public.get_upsell_suggestions(
  p_session_id uuid,
  p_trigger text,
  p_trigger_item_id uuid,
  p_cart_item_ids uuid[],
  p_declined_item_ids uuid[],
  p_impressions_this_round int
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_session RECORD;
  v_rules RECORD;
  v_suggestions jsonb := '[]'::jsonb;
  v_remaining_impressions int := 0;
  v_max_impressions int;
BEGIN
  -- validate session
  SELECT * INTO v_session FROM table_sessions WHERE id = p_session_id AND closed_at IS NULL AND expires_at > now();
  IF NOT FOUND THEN 
    RETURN jsonb_build_object('suggestions', '[]'::jsonb, 'remaining_impressions', 0); 
  END IF;

  SELECT * INTO v_rules FROM upsell_rules WHERE restaurant_id = v_session.restaurant_id;
  IF NOT FOUND OR NOT v_rules.is_enabled THEN 
    RETURN jsonb_build_object('suggestions', '[]'::jsonb, 'remaining_impressions', 0); 
  END IF;

  -- Calculate limit based on caps
  v_max_impressions := v_rules.max_impressions_per_round - p_impressions_this_round;
  IF v_max_impressions <= 0 THEN
    RETURN jsonb_build_object('suggestions', '[]'::jsonb, 'remaining_impressions', 0);
  END IF;

  -- Safely build suggestions without crashing if tables are empty
  WITH available_items AS (
    SELECT m.id, m.name, COALESCE(bm.price_override, m.price) as active_price, m.cost_price
    FROM menu_items m
    JOIN branch_menu_items bm ON bm.menu_item_id = m.id AND bm.branch_id = v_session.branch_id
    WHERE m.restaurant_id = v_session.restaurant_id
      AND bm.available = true AND m.is_active = true AND m.deleted_at IS NULL
      AND (p_cart_item_ids IS NULL OR m.id != ALL(p_cart_item_ids))
      AND (p_declined_item_ids IS NULL OR m.id != ALL(p_declined_item_ids))
      AND (p_trigger_item_id IS NULL OR m.id != p_trigger_item_id)
  ),
  source_a AS (
    SELECT a.id, a.name, a.active_price as price, 'curated' as source, 'Recommended with your item' as reason, uc.sort_order as priority
    FROM available_items a
    JOIN upselling_combinations uc ON uc.target_item_id = a.id
    WHERE uc.source_item_id = p_trigger_item_id
  ),
  source_b AS (
    SELECT a.id, a.name, a.active_price as price, 'co_occurrence' as source, 'Often ordered together' as reason, (100000 - ips.lift_bps) as priority
    FROM available_items a
    JOIN item_pair_scores ips ON ips.target_item_id = a.id
    WHERE ips.source_item_id = p_trigger_item_id
      AND ips.lift_bps >= v_rules.minimum_lift_bps
      AND ips.support_bps >= v_rules.minimum_support_bps
  ),
  source_c AS (
    SELECT a.id, a.name, a.active_price as price, 'margin' as source, 'Popular choice' as reason, (1000000 - (a.active_price - a.cost_price)) as priority
    FROM available_items a
    WHERE a.cost_price IS NOT NULL AND a.active_price > a.cost_price
  ),
  blended AS (
    SELECT * FROM source_a
    UNION ALL
    SELECT * FROM source_b WHERE NOT EXISTS (SELECT 1 FROM source_a WHERE source_a.id = source_b.id)
    UNION ALL
    SELECT * FROM source_c WHERE NOT EXISTS (SELECT 1 FROM source_a WHERE source_a.id = source_c.id) 
                             AND NOT EXISTS (SELECT 1 FROM source_b WHERE source_b.id = source_c.id)
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


-- 3. place_order
CREATE OR REPLACE FUNCTION public.place_order(
  p_session_id uuid,
  p_idempotency_key text,
  p_kitchen_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_session RECORD;
  v_existing_order RECORD;
  v_order_id uuid;
  v_round int;
  v_merged boolean := false;
  v_latest_order RECORD;
  v_subtotal int := 0;
  v_tax int := 0;
  v_service_charge int := 0;
  v_total int := 0;
  v_cart_item RECORD;
  v_order RECORD;
  v_line_items jsonb;
BEGIN
  -- 1. Session validation
  SELECT s.*, r.tax_rate_bps, r.service_charge_bps 
  INTO v_session
  FROM table_sessions s
  JOIN restaurants r ON r.id = s.restaurant_id
  WHERE s.id = p_session_id AND s.closed_at IS NULL AND s.expires_at > now();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'SESSION_EXPIRED' USING ERRCODE = 'P0001';
  END IF;

  -- 2. Idempotency Check
  SELECT * INTO v_existing_order FROM orders 
  WHERE restaurant_id = v_session.restaurant_id AND idempotency_key = p_idempotency_key;

  IF FOUND THEN
    SELECT COALESCE(jsonb_agg(row_to_json(oli)), '[]'::jsonb) INTO v_line_items 
    FROM order_line_items oli WHERE oli.order_id = v_existing_order.id;
    
    RETURN jsonb_build_object(
      'order', row_to_json(v_existing_order) || jsonb_build_object('lineItems', v_line_items),
      'merged', true,
      'totals', jsonb_build_object('subtotal', v_existing_order.subtotal, 'tax', v_existing_order.tax, 'total', v_existing_order.total)
    );
  END IF;

  -- 3. Check for cart items
  IF NOT EXISTS (SELECT 1 FROM cart_items WHERE session_id = p_session_id) THEN
    RAISE EXCEPTION 'CONFLICT' USING ERRCODE = 'P0002';
  END IF;

  -- 4. Round-Merge
  SELECT * INTO v_latest_order FROM orders 
  WHERE session_id = p_session_id 
  ORDER BY round DESC LIMIT 1;

  IF FOUND AND EXTRACT(EPOCH FROM (now() - v_latest_order.placed_at)) <= 300 THEN
    v_order_id := v_latest_order.id;
    v_round := v_latest_order.round;
    v_merged := true;
  ELSE
    v_round := COALESCE((SELECT max(round) FROM orders WHERE session_id = p_session_id), 0) + 1;
    v_merged := false;
    
    INSERT INTO orders (
      restaurant_id, branch_id, session_id,
      round, status, idempotency_key, kitchen_notes, placed_at,
      subtotal, tax, service_charge, total
    ) VALUES (
      v_session.restaurant_id, v_session.branch_id, p_session_id,
      v_round, 'placed', p_idempotency_key, p_kitchen_notes, now(),
      0, 0, 0, 0
    ) RETURNING id INTO v_order_id;
  END IF;

  -- 5. Snapshot items
  FOR v_cart_item IN 
    SELECT c.*, 
           m.name as item_name, 
           COALESCE(bm.price_override, m.price) as base_price,
           sm.name as member_name
    FROM cart_items c
    JOIN menu_items m ON m.id = c.menu_item_id
    JOIN branch_menu_items bm ON bm.menu_item_id = m.id AND bm.branch_id = v_session.branch_id
    JOIN session_members sm ON sm.id = c.member_id
    WHERE c.session_id = p_session_id
  LOOP
    DECLARE
       v_mod_total int := 0;
    BEGIN
       -- Assuming modifiers_json is a JSON array of objects with priceDelta
       SELECT COALESCE(sum((m_obj->>'priceDelta')::int), 0) INTO v_mod_total
       FROM jsonb_array_elements(v_cart_item.modifiers_json) as m_obj
       WHERE jsonb_typeof(v_cart_item.modifiers_json) = 'array';
       
       INSERT INTO order_line_items (
         order_id, menu_item_id, name_snapshot, unit_price_snapshot, quantity,
         modifiers_snapshot, by_member_id, by_member_name, notes
       ) VALUES (
         v_order_id, v_cart_item.menu_item_id, v_cart_item.item_name, v_cart_item.base_price + v_mod_total, v_cart_item.quantity,
         v_cart_item.modifiers_json, v_cart_item.member_id, v_cart_item.member_name, v_cart_item.notes
       );
    EXCEPTION WHEN OTHERS THEN
       -- Fallback if JSON parse fails
       INSERT INTO order_line_items (
         order_id, menu_item_id, name_snapshot, unit_price_snapshot, quantity,
         modifiers_snapshot, by_member_id, by_member_name, notes
       ) VALUES (
         v_order_id, v_cart_item.menu_item_id, v_cart_item.item_name, v_cart_item.base_price, v_cart_item.quantity,
         v_cart_item.modifiers_json, v_cart_item.member_id, v_cart_item.member_name, v_cart_item.notes
       );
    END;
  END LOOP;

  -- 6. Recalculate Totals
  SELECT COALESCE(sum(unit_price_snapshot * quantity), 0) INTO v_subtotal
  FROM order_line_items WHERE order_id = v_order_id;

  v_tax := round(v_subtotal * v_session.tax_rate_bps / 10000.0);
  v_service_charge := round(v_subtotal * v_session.service_charge_bps / 10000.0);
  v_total := v_subtotal + v_tax + v_service_charge;
  
  UPDATE orders SET 
    subtotal = v_subtotal, tax = v_tax, service_charge = v_service_charge, total = v_total
  WHERE id = v_order_id
  RETURNING * INTO v_order;

  -- 7. Clear carts and set lock
  DELETE FROM cart_items WHERE session_id = p_session_id;
  
  IF v_session.is_locked = false THEN
    UPDATE table_sessions SET is_locked = true WHERE id = p_session_id;
  END IF;

  SELECT COALESCE(jsonb_agg(row_to_json(oli)), '[]'::jsonb) INTO v_line_items 
  FROM order_line_items oli WHERE oli.order_id = v_order_id;

  RETURN jsonb_build_object(
    'order', row_to_json(v_order) || jsonb_build_object('lineItems', v_line_items),
    'merged', v_merged,
    'totals', jsonb_build_object('subtotal', v_subtotal, 'tax', v_tax, 'total', v_total)
  );
END;
$$;
