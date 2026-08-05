import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../types/database.types';
import { AppError } from '../utils/AppError';

export async function getTenants(db: SupabaseClient<Database>) {
  const { data, error } = await db
    .from('restaurants')
    .select(`
      id,
      name,
      join_date:created_at,
      subscriptions(id, status, plan_id, plans(name))
    `)
    .is('deleted_at', null);

  if (error) {
    throw new AppError(500, 'INTERNAL_ERROR', error.message);
  }
  return data;
}

export async function getTenantById(db: SupabaseClient<Database>, id: string) {
  const { data, error } = await db
    .from('restaurants')
    .select(`
      id, name, created_at,
      subscriptions(id, status, period_start, period_end, plans(name, price)),
      branches(id, name)
    `)
    .eq('id', id)
    .single();

  if (error) {
    throw new AppError(404, 'NOT_FOUND', 'Tenant not found');
  }
  return data;
}

export async function getPlans(db: SupabaseClient<Database>) {
  const { data, error } = await db.from('plans').select('*').order('price', { ascending: true });
  if (error) {
    throw new AppError(500, 'INTERNAL_ERROR', error.message);
  }
  return data;
}

export async function createPlan(
  db: SupabaseClient<Database>,
  payload: { name: string; price: number; features?: any; is_active?: boolean }
) {
  const { data, error } = await db
    .from('plans')
    .insert(payload)
    .select()
    .single();

  if (error) {
    throw new AppError(500, 'INTERNAL_ERROR', error.message);
  }
  return data;
}

export async function updatePlan(
  db: SupabaseClient<Database>,
  id: string,
  payload: { name?: string; price?: number; features?: any; is_active?: boolean }
) {
  const { data, error } = await db
    .from('plans')
    .update(payload)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    throw new AppError(500, 'INTERNAL_ERROR', error.message);
  }
  return data;
}

export async function getSubscriptions(db: SupabaseClient<Database>) {
  const { data, error } = await db
    .from('subscriptions')
    .select('*, plans(name), restaurants(name)')
    .order('created_at', { ascending: false });

  if (error) {
    throw new AppError(500, 'INTERNAL_ERROR', error.message);
  }
  return data;
}

export async function updateSubscription(
  db: SupabaseClient<Database>,
  id: string,
  payload: { status: string }
) {
  const { data, error } = await db
    .from('subscriptions')
    .update(payload)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    throw new AppError(500, 'INTERNAL_ERROR', error.message);
  }
  return data;
}

export async function getBilling(db: SupabaseClient<Database>) {
  const { data, error } = await db
    .from('saas_billing')
    .select('*, restaurants(name)')
    .order('billed_at', { ascending: false });

  if (error) {
    throw new AppError(500, 'INTERNAL_ERROR', error.message);
  }
  return data;
}

export async function getCosts(db: SupabaseClient<Database>) {
  const { data, error } = await db
    .from('ops_cost_tracking')
    .select('*')
    .order('period_start', { ascending: false });

  if (error) {
    throw new AppError(500, 'INTERNAL_ERROR', error.message);
  }
  return data;
}

export async function createCost(
  db: SupabaseClient<Database>,
  payload: {
    cost_type: string;
    amount: number;
    period_start: string;
    period_end: string;
    restaurant_id?: string;
  }
) {
  // Omit undefined values to prevent typescript errors on insertion
  const cleanPayload: any = { ...payload };
  if (cleanPayload.restaurant_id === undefined) delete cleanPayload.restaurant_id;

  const { data, error } = await db
    .from('ops_cost_tracking')
    .insert(cleanPayload)
    .select()
    .single();

  if (error) {
    throw new AppError(500, 'INTERNAL_ERROR', error.message);
  }
  return data;
}

export async function getAnalytics(db: SupabaseClient<Database>) {
  // totalGmv: sum from daily_sales_by_branch matview (all tenants, service-role)
  const { data: salesData, error: salesErr } = await db
    .from('daily_sales_by_branch')
    .select('revenue_paisa, restaurant_id');
  if (salesErr) throw new AppError(500, 'INTERNAL_ERROR', salesErr.message);

  const totalGmv = (salesData || []).reduce((acc: number, d: any) => acc + (d.revenue_paisa || 0), 0);

  // Unique restaurant IDs with revenue in last 30 days
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const { data: recentSales, error: recentErr } = await db
    .from('daily_sales_by_branch')
    .select('restaurant_id')
    .gte('day', thirtyDaysAgo);
  if (recentErr) throw new AppError(500, 'INTERNAL_ERROR', recentErr.message);

  const activeRestaurantIds = [...new Set((recentSales || []).map((r: any) => r.restaurant_id))];
  const activeClients = activeRestaurantIds.length;

  // churnAlerts: restaurants with no orders in last 14 days but had orders before
  const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const { data: recentActive, error: recentActiveErr } = await db
    .from('daily_sales_by_branch')
    .select('restaurant_id')
    .gte('day', fourteenDaysAgo);
  if (recentActiveErr) throw new AppError(500, 'INTERNAL_ERROR', recentActiveErr.message);

  const recentActiveIds = new Set((recentActive || []).map((r: any) => r.restaurant_id));
  // All restaurants that ever had orders
  const allOrderedIds = [...new Set((salesData || []).map((r: any) => r.restaurant_id))];
  const churnedIds = allOrderedIds.filter(id => !recentActiveIds.has(id));

  // Get names + last order day for churned restaurants
  const churnAlerts: Array<{ restaurantId: string; name: string; lastOrderDay: string }> = [];
  for (const rid of churnedIds) {
    const { data: rData } = await db.from('restaurants').select('name').eq('id', rid).single();
    const { data: lastDay } = await db
      .from('daily_sales_by_branch')
      .select('day')
      .eq('restaurant_id', rid)
      .order('day', { ascending: false })
      .limit(1)
      .single();
    churnAlerts.push({
      restaurantId: rid,
      name: rData?.name || rid,
      lastOrderDay: lastDay?.day || 'unknown',
    });
  }

  return { totalGmv, activeClients, churnAlerts };
}

