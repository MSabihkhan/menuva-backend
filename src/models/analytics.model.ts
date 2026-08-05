import { SupabaseClient } from '@supabase/supabase-js';
import { Database } from '../types/database.types';
import { AppError } from '../utils/AppError';

export interface SalesAnalytics {
  revenuePerDay: Array<{ date: string; revenue: number }>;
  aov: number;
  covers: number;
  topItems: Array<{ id: string; name: string; quantity: number; revenue: number }>;
  revenueByCategory: Array<{ categoryId: string; name: string; revenue: number }>;
}

export interface MenuPerformance {
  matrix: Array<{ itemId: string; name: string; popularity: number; margin: number | null }>;
  conversionLiftBps: number;
}

export interface KitchenTiming {
  avgDeltas: {
    placedToPreparing: number;
    preparingToReady: number;
    readyToServed: number;
  };
  perItemTimes: Array<{ itemId: string; name: string; avgTimeSec: number }>;
  peakHeatmap: Array<{ dow: number; hour: number; count: number }>;
}

export interface UpsellAnalytics {
  acceptanceRateByTrigger: Record<string, number>;
  upsellRevenue: number;
  sourceEffectiveness: Record<string, number>;
  ignoreRate: number;
}

export const getSales = async (
  db: SupabaseClient<Database>,
  from: string,
  to: string,
  branchId?: string
): Promise<SalesAnalytics> => {
  const { data, error } = await db.rpc('get_daily_sales', {
    p_from: from || undefined,
    p_to: to || undefined,
    p_branch_id: branchId || undefined,
  } as any);
  if (error) throw new AppError(500, 'INTERNAL_ERROR', error.message);
  
  const revenuePerDay = (data || []).map((d: any) => ({ date: d.day, revenue: d.revenue_paisa }));
  const aov = data && data.length > 0 ? (data.reduce((acc: number, d: any) => acc + d.aov_paisa, 0) / data.length) : 0;
  const covers = (data || []).reduce((acc: number, d: any) => acc + d.covers, 0);

  // topItems: from item_performance matview (via RPC), top 10 by revenue
  const { data: perfData } = await db.rpc('get_item_performance');
  const perfRows = (perfData || []) as any[];
  // Resolve real item names
  const itemIds = perfRows.map((r: any) => r.menu_item_id);
  let itemNameMap: Record<string, string> = {};
  if (itemIds.length > 0) {
    const { data: items } = await db.from('menu_items').select('id, name').in('id', itemIds);
    (items || []).forEach((i: any) => { itemNameMap[i.id] = i.name; });
  }
  const topItems = perfRows
    .sort((a: any, b: any) => b.revenue_paisa - a.revenue_paisa)
    .slice(0, 10)
    .map((d: any) => ({
      id: d.menu_item_id,
      name: itemNameMap[d.menu_item_id] || d.menu_item_id,
      quantity: d.units_sold,
      revenue: d.revenue_paisa,
    }));

  // revenueByCategory: group item_performance by category_id, join menu_categories for name
  const catRevenue: Record<string, number> = {};
  const catIds = new Set<string>();
  perfRows.forEach((d: any) => {
    if (d.category_id) {
      catIds.add(d.category_id);
      catRevenue[d.category_id] = (catRevenue[d.category_id] || 0) + (d.revenue_paisa || 0);
    }
  });
  let catNameMap: Record<string, string> = {};
  if (catIds.size > 0) {
    const { data: cats } = await db.from('menu_categories').select('id, name').in('id', [...catIds]);
    (cats || []).forEach((c: any) => { catNameMap[c.id] = c.name; });
  }
  const revenueByCategory = Object.entries(catRevenue).map(([catId, rev]) => ({
    categoryId: catId,
    name: catNameMap[catId] || catId,
    revenue: rev,
  }));

  return { revenuePerDay, aov, covers, topItems, revenueByCategory };
};

export const getMenuPerformance = async (
  db: SupabaseClient<Database>
): Promise<MenuPerformance> => {
  const { data, error } = await db.rpc('get_item_performance');
  if (error) throw new AppError(500, 'INTERNAL_ERROR', error.message);

  // Resolve real item names
  const rows = (data || []) as any[];
  const itemIds = rows.map((d: any) => d.menu_item_id);
  let nameMap: Record<string, string> = {};
  if (itemIds.length > 0) {
    const { data: items } = await db.from('menu_items').select('id, name').in('id', itemIds);
    (items || []).forEach((i: any) => { nameMap[i.id] = i.name; });
  }
  
  const matrix = rows.map((d: any) => ({
    itemId: d.menu_item_id,
    name: nameMap[d.menu_item_id] || d.menu_item_id,
    popularity: d.popularity_rank,
    margin: d.margin_paisa
  }));

  // conversionLiftBps from model_3d_conversion matview
  const { data: convData } = await db.from('model_3d_conversion').select('conversion_bps');
  let conversionLiftBps = 0;
  if (convData && convData.length > 0) {
    conversionLiftBps = Math.round(
      convData.reduce((acc: number, d: any) => acc + (d.conversion_bps || 0), 0) / convData.length
    );
  }

  return { matrix, conversionLiftBps };
};

export const getKitchenTiming = async (
  db: SupabaseClient<Database>
): Promise<KitchenTiming> => {
  const { data, error } = await db.rpc('get_kitchen_timings');
  if (error) throw new AppError(500, 'INTERNAL_ERROR', error.message);
  
  const d = data && data[0] ? data[0] : null;

  // perItemTimes from kitchen_item_timings RPC
  const { data: itemTimings } = await db.rpc('get_kitchen_item_timings' as any);
  const itemRows = (itemTimings || []) as any[];
  // Resolve names
  const itemIds = itemRows.map((r: any) => r.menu_item_id);
  let nameMap: Record<string, string> = {};
  if (itemIds.length > 0) {
    const { data: items } = await db.from('menu_items').select('id, name').in('id', itemIds);
    (items || []).forEach((i: any) => { nameMap[i.id] = i.name; });
  }
  const perItemTimes = itemRows.map((r: any) => ({
    itemId: r.menu_item_id,
    name: nameMap[r.menu_item_id] || r.menu_item_id,
    avgTimeSec: r.avg_time_sec,
  }));

  // peakHeatmap from order_heatmap RPC
  const { data: heatmapData } = await db.rpc('get_order_heatmap' as any);
  const peakHeatmap = ((heatmapData || []) as any[]).map((h: any) => ({
    dow: h.dow,
    hour: h.hour,
    count: h.order_count,
  }));

  return {
    avgDeltas: {
      placedToPreparing: d?.avg_prep_seconds || 0,
      preparingToReady: d?.avg_ready_seconds || 0,
      readyToServed: d?.avg_serve_seconds || 0
    },
    perItemTimes,
    peakHeatmap
  };
};

export const getUpsell = async (
  db: SupabaseClient<Database>
): Promise<UpsellAnalytics> => {
  const { data, error } = await db.rpc('get_upsell_performance');
  if (error) throw new AppError(500, 'INTERNAL_ERROR', error.message);
  
  const acceptanceRateByTrigger: Record<string, number> = {};
  const sourceEffectiveness: Record<string, number> = {};
  let upsellRevenue = 0;
  let totalIgnoreRateBps = 0;
  let sourceCount = 0;
  
  (data || []).forEach((d: any) => {
    const src = d.source_type || 'unknown';
    sourceEffectiveness[src] = d.acceptance_rate_bps;
    acceptanceRateByTrigger[src] = d.acceptance_rate_bps;
    upsellRevenue += d.upsell_revenue_paisa;
    totalIgnoreRateBps += d.ignore_rate_bps || 0;
    sourceCount++;
  });

  const ignoreRate = sourceCount > 0 ? Math.round(totalIgnoreRateBps / sourceCount) : 0;

  return { acceptanceRateByTrigger, upsellRevenue, sourceEffectiveness, ignoreRate };
};
