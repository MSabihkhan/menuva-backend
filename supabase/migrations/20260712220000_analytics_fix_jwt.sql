-- -----------------------------------------------------------------------------
-- 20260712220000_analytics_fix_jwt.sql
-- -----------------------------------------------------------------------------
-- Fixes the analytics RPCs to use auth.jwt() instead of custom GUCs 
-- (app.current_user_role), which were never being set by the backend API.
-- Uses jsonb_extract_path_text to avoid markdown copy-paste rendering issues with ->> operators.

CREATE OR REPLACE FUNCTION public.get_daily_sales(p_from date DEFAULT NULL::date, p_to date DEFAULT NULL::date, p_branch_id uuid DEFAULT NULL::uuid)
 RETURNS SETOF daily_sales_by_branch
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_restaurant_id uuid := jsonb_extract_path_text(auth.jwt(), 'app_metadata', 'restaurant_id')::uuid;
  v_role text := jsonb_extract_path_text(auth.jwt(), 'app_metadata', 'role');
  v_branch_id uuid := jsonb_extract_path_text(auth.jwt(), 'app_metadata', 'branch_id')::uuid;
begin
  if v_role = 'branch_manager' and (p_branch_id is null or p_branch_id != v_branch_id) then
    raise exception 'INSUFFICIENT_ROLE' using errcode = '42501';
  end if;

  return query select * from public.daily_sales_by_branch 
    where restaurant_id = v_restaurant_id 
      and (p_branch_id is null or branch_id = p_branch_id)
      and (p_from is null or day >= p_from)
      and (p_to is null or day <= p_to);
end;
$function$;

CREATE OR REPLACE FUNCTION public.get_item_performance()
 RETURNS SETOF item_performance
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF jsonb_extract_path_text(auth.jwt(), 'app_metadata', 'role') != 'owner' THEN
    RAISE EXCEPTION 'INSUFFICIENT_ROLE' USING errcode = '42501';
  END IF;
  RETURN QUERY SELECT * FROM public.item_performance
    WHERE restaurant_id = jsonb_extract_path_text(auth.jwt(), 'app_metadata', 'restaurant_id')::uuid;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_kitchen_item_timings()
 RETURNS SETOF kitchen_item_timings
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF jsonb_extract_path_text(auth.jwt(), 'app_metadata', 'role') NOT IN ('owner', 'branch_manager') THEN
    RAISE EXCEPTION 'INSUFFICIENT_ROLE' USING errcode = '42501';
  END IF;
  RETURN QUERY SELECT * FROM public.kitchen_item_timings
    WHERE restaurant_id = jsonb_extract_path_text(auth.jwt(), 'app_metadata', 'restaurant_id')::uuid;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_kitchen_timings()
 RETURNS SETOF kitchen_timings
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF jsonb_extract_path_text(auth.jwt(), 'app_metadata', 'role') = 'branch_manager' THEN
    RETURN QUERY SELECT * FROM public.kitchen_timings
      WHERE restaurant_id = jsonb_extract_path_text(auth.jwt(), 'app_metadata', 'restaurant_id')::uuid
        AND branch_id = jsonb_extract_path_text(auth.jwt(), 'app_metadata', 'branch_id')::uuid;
  ELSIF jsonb_extract_path_text(auth.jwt(), 'app_metadata', 'role') = 'owner' THEN
    RETURN QUERY SELECT * FROM public.kitchen_timings
      WHERE restaurant_id = jsonb_extract_path_text(auth.jwt(), 'app_metadata', 'restaurant_id')::uuid;
  ELSE
    RAISE EXCEPTION 'INSUFFICIENT_ROLE' USING errcode = '42501';
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_order_heatmap()
 RETURNS SETOF order_heatmap
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF jsonb_extract_path_text(auth.jwt(), 'app_metadata', 'role') NOT IN ('owner', 'branch_manager') THEN
    RAISE EXCEPTION 'INSUFFICIENT_ROLE' USING errcode = '42501';
  END IF;
  RETURN QUERY SELECT * FROM public.order_heatmap
    WHERE restaurant_id = jsonb_extract_path_text(auth.jwt(), 'app_metadata', 'restaurant_id')::uuid;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_upsell_performance()
 RETURNS SETOF upsell_performance
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if jsonb_extract_path_text(auth.jwt(), 'app_metadata', 'role') != 'owner' then
    raise exception 'INSUFFICIENT_ROLE' using errcode = '42501';
  end if;
  return query select * from public.upsell_performance where restaurant_id = jsonb_extract_path_text(auth.jwt(), 'app_metadata', 'restaurant_id')::uuid;
end;
$function$;
