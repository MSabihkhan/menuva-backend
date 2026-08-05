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
      subtotal, tax, total
    ) VALUES (
      v_session.restaurant_id, v_session.branch_id, p_session_id,
      v_round, 'placed', p_idempotency_key, p_kitchen_notes, now(),
      0, 0, 0
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
         order_id, restaurant_id, menu_item_id, name_snapshot, unit_price_snapshot, quantity,
         modifiers_snapshot, by_member_id, by_member_name
       ) VALUES (
         v_order_id, v_session.restaurant_id, v_cart_item.menu_item_id, v_cart_item.item_name, v_cart_item.base_price + v_mod_total, v_cart_item.quantity,
         v_cart_item.modifiers_json, v_cart_item.member_id, v_cart_item.member_name
       );
    EXCEPTION WHEN OTHERS THEN
       -- Fallback if JSON parse fails
       INSERT INTO order_line_items (
         order_id, restaurant_id, menu_item_id, name_snapshot, unit_price_snapshot, quantity,
         modifiers_snapshot, by_member_id, by_member_name
       ) VALUES (
         v_order_id, v_session.restaurant_id, v_cart_item.menu_item_id, v_cart_item.item_name, v_cart_item.base_price, v_cart_item.quantity,
         v_cart_item.modifiers_json, v_cart_item.member_id, v_cart_item.member_name
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
    subtotal = v_subtotal, tax = v_tax, total = v_total
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
