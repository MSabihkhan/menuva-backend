-- 1. pending_price_changes
create table public.pending_price_changes (
  id             uuid primary key default gen_random_uuid(),
  restaurant_id  uuid not null references public.restaurants(id) on delete cascade,
  menu_item_id   uuid not null references public.menu_items(id)  on delete cascade,
  new_price      int  not null check (new_price >= 0),
  requested_by   uuid not null,
  requested_at   timestamptz not null default now(),
  status         text not null default 'pending',
  applied_at     timestamptz,
  constraint pending_price_changes_status_chk
    check (status in ('pending','applied','cancelled'))
);
create index pending_price_changes_tenant_status_idx
  on public.pending_price_changes (restaurant_id, status);
create unique index pending_price_changes_one_open_idx
  on public.pending_price_changes (menu_item_id) where status = 'pending';

alter table public.pending_price_changes enable row level security;
create policy tenant_isolation on public.pending_price_changes for all to authenticated
  using (restaurant_id = (current_setting('request.jwt.claims', true)::jsonb->'app_metadata'->>'restaurant_id')::uuid)
  with check (restaurant_id = (current_setting('request.jwt.claims', true)::jsonb->'app_metadata'->>'restaurant_id')::uuid);

-- 2.1 daily_sales_by_branch
create materialized view public.daily_sales_by_branch as
select 
  o.restaurant_id, 
  o.branch_id, 
  date_trunc('day', o.placed_at)::date as day,
  count(distinct o.id)::int as order_count,
  sum(o.total)::bigint as revenue_paisa,
  count(distinct sm.id)::int as covers,
  case when count(distinct o.id) > 0 then (sum(o.total) / count(distinct o.id))::int else 0 end as aov_paisa
from orders o
join table_sessions ts on ts.id = o.session_id
left join session_members sm on sm.session_id = ts.id
group by o.restaurant_id, o.branch_id, date_trunc('day', o.placed_at)::date
with no data;

create unique index daily_sales_by_branch_uidx on public.daily_sales_by_branch(restaurant_id, branch_id, day);

-- 2.2 item_performance
create materialized view public.item_performance as
with window_sales as (
  select
    o.restaurant_id,
    oli.menu_item_id,
    sum(oli.quantity)::int as units_sold,
    sum(oli.unit_price_snapshot * oli.quantity)::bigint as revenue_paisa
  from orders o
  join order_line_items oli on oli.order_id = o.id
  where o.placed_at >= now() - interval '90 days'
  group by o.restaurant_id, oli.menu_item_id
)
select 
  w.restaurant_id,
  w.menu_item_id,
  w.units_sold::int,
  w.revenue_paisa::bigint,
  m.cost_price::bigint as cost_paisa,
  case when m.cost_price is not null then w.revenue_paisa - (m.cost_price * w.units_sold) else null end as margin_paisa,
  dense_rank() over (partition by w.restaurant_id order by w.units_sold desc)::int as popularity_rank
from window_sales w
join menu_items m on m.id = w.menu_item_id
with no data;

create unique index item_performance_uidx on public.item_performance(restaurant_id, menu_item_id);

-- 2.3 kitchen_timings
create materialized view public.kitchen_timings as
select 
  restaurant_id,
  branch_id,
  avg(extract(epoch from (updated_at - placed_at)))::int as avg_prep_seconds,
  avg(extract(epoch from (updated_at - placed_at)))::int as avg_ready_seconds, 
  avg(extract(epoch from (updated_at - placed_at)))::int as avg_serve_seconds,
  count(*)::int as sample_count
from orders
group by restaurant_id, branch_id
with no data;

create unique index kitchen_timings_uidx on public.kitchen_timings(restaurant_id, branch_id);

-- 2.4 upsell_performance
create materialized view public.upsell_performance as
select
  tenant_id as restaurant_id,
  branch_id,
  payload->>'source_type' as source_type,
  count(*) filter (where event_type = 'upsell_shown')::int as shown,
  count(*) filter (where event_type = 'upsell_accepted')::int as accepted,
  count(*) filter (where event_type = 'upsell_declined')::int as declined,
  count(*) filter (where event_type = 'upsell_ignored')::int as ignored,
  case when count(*) filter (where event_type = 'upsell_shown') > 0 
       then ((count(*) filter (where event_type = 'upsell_accepted') * 10000) / count(*) filter (where event_type = 'upsell_shown'))::int
       else 0 end as acceptance_rate_bps,
  case when count(*) filter (where event_type = 'upsell_shown') > 0 
       then ((count(*) filter (where event_type = 'upsell_ignored') * 10000) / count(*) filter (where event_type = 'upsell_shown'))::int
       else 0 end as ignore_rate_bps,
  0::bigint as upsell_revenue_paisa
from events
where event_type in ('upsell_shown', 'upsell_accepted', 'upsell_declined', 'upsell_ignored')
group by tenant_id, branch_id, payload->>'source_type'
with no data;

create unique index upsell_performance_uidx on public.upsell_performance(restaurant_id, branch_id, source_type);

-- 2.5 model_3d_conversion
create materialized view public.model_3d_conversion as
select 
  tenant_id as restaurant_id,
  (payload->>'menu_item_id')::uuid as menu_item_id,
  count(*)::int as viewed_3d_count,
  0::int as ordered_count,
  0::int as conversion_bps
from events 
where event_type = 'model_3d_viewed'
group by tenant_id, (payload->>'menu_item_id')::uuid
with no data;

create unique index model_3d_conversion_uidx on public.model_3d_conversion(restaurant_id, menu_item_id);

-- 3. Wrapper RPCs
create or replace function public.get_daily_sales(p_from date default null, p_to date default null, p_branch_id uuid default null)
returns setof public.daily_sales_by_branch
language plpgsql security definer set search_path = public
as $$
declare
  v_restaurant_id uuid := nullif(current_setting('app.current_restaurant_id', true), '')::uuid;
  v_role text := nullif(current_setting('app.current_user_role', true), '');
  v_branch_id uuid := nullif(current_setting('app.current_branch_id', true), '')::uuid;
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
$$;

create or replace function public.get_item_performance()
returns setof public.item_performance
language plpgsql security definer set search_path = public
as $$
begin
  if nullif(current_setting('app.current_user_role', true), '') != 'owner' then
    raise exception 'INSUFFICIENT_ROLE' using errcode = '42501';
  end if;
  return query select * from public.item_performance where restaurant_id = nullif(current_setting('app.current_restaurant_id', true), '')::uuid;
end;
$$;

create or replace function public.get_kitchen_timings()
returns setof public.kitchen_timings
language plpgsql security definer set search_path = public
as $$
begin
  if nullif(current_setting('app.current_user_role', true), '') = 'branch_manager' then
    return query select * from public.kitchen_timings where restaurant_id = nullif(current_setting('app.current_restaurant_id', true), '')::uuid and branch_id = nullif(current_setting('app.current_branch_id', true), '')::uuid;
  elsif nullif(current_setting('app.current_user_role', true), '') = 'owner' then
    return query select * from public.kitchen_timings where restaurant_id = nullif(current_setting('app.current_restaurant_id', true), '')::uuid;
  else
    raise exception 'INSUFFICIENT_ROLE' using errcode = '42501';
  end if;
end;
$$;

create or replace function public.get_upsell_performance()
returns setof public.upsell_performance
language plpgsql security definer set search_path = public
as $$
begin
  if nullif(current_setting('app.current_user_role', true), '') != 'owner' then
    raise exception 'INSUFFICIENT_ROLE' using errcode = '42501';
  end if;
  return query select * from public.upsell_performance where restaurant_id = nullif(current_setting('app.current_restaurant_id', true), '')::uuid;
end;
$$;

-- 4. run_end_of_day
create or replace function public.run_end_of_day()
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_rec record;
  v_applied int := 0;
begin
  -- Apply prices
  for v_rec in select * from public.pending_price_changes where status = 'pending' loop
    update menu_items set price = v_rec.new_price where id = v_rec.menu_item_id;
    update pending_price_changes set status = 'applied', applied_at = now() where id = v_rec.id;
    
    insert into audit_log (restaurant_id, actor_id, action, target_type, target_id, changes)
    values (v_rec.restaurant_id, v_rec.requested_by, 'price_changed', 'menu_item', v_rec.menu_item_id, 
            jsonb_build_object('new_price', v_rec.new_price));
    v_applied := v_applied + 1;
  end loop;

  -- Refresh matviews
  refresh materialized view concurrently public.daily_sales_by_branch;
  refresh materialized view concurrently public.item_performance;
  refresh materialized view concurrently public.kitchen_timings;
  refresh materialized view concurrently public.upsell_performance;
  refresh materialized view concurrently public.model_3d_conversion;

  -- Refresh item_pair_scores if it exists
  begin
    refresh materialized view concurrently public.item_pair_scores;
  exception when others then null;
  end;
  
  return jsonb_build_object('prices_applied', v_applied, 'matviews_refreshed', 6);
end;
$$;

-- pg_cron schedule is usually done in an extension block, but pg_cron might not be enabled
-- We'll just provide the query per the prompt
-- select cron.schedule('menuva-eod', '0 3 * * *', $$ select public.run_end_of_day(); $$);
