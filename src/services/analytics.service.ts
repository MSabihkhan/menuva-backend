import { SupabaseClient } from '@supabase/supabase-js';
import { Database } from '../types/database.types';
import * as analyticsModel from '../models/analytics.model';
import { logger } from '../utils/logger';

/**
 * Every analytics figure comes from a materialized view, and nothing was
 * refreshing them — no pg_cron job, no caller of run_end_of_day(). The result
 * was a dashboard that stayed empty no matter how many orders were completed,
 * because the views still held whatever a migration or test last left behind.
 *
 * So a read refreshes them, throttled in the database: `refresh_analytics_if_stale`
 * is a no-op unless the data is older than the window, and concurrent callers
 * skip rather than queue. Never fatal — stale numbers beat a broken page.
 */
const REFRESH_WINDOW_SECONDS = 60;

async function ensureFresh(db: SupabaseClient<Database>) {
  const { error } = await db.rpc('refresh_analytics_if_stale', {
    p_max_age_seconds: REFRESH_WINDOW_SECONDS,
  });
  if (error) {
    logger.warn({ err: error }, 'Analytics refresh failed; serving possibly stale figures');
  }
}

export const getSales = async (
  db: SupabaseClient<Database>,
  from: string,
  to: string,
  branchId?: string
) => {
  await ensureFresh(db);
  return analyticsModel.getSales(db, from, to, branchId);
};

export const getMenuPerformance = async (db: SupabaseClient<Database>) => {
  await ensureFresh(db);
  return analyticsModel.getMenuPerformance(db);
};

export const getKitchenTiming = async (db: SupabaseClient<Database>) => {
  await ensureFresh(db);
  return analyticsModel.getKitchenTiming(db);
};

export const getUpsell = async (db: SupabaseClient<Database>) => {
  await ensureFresh(db);
  return analyticsModel.getUpsell(db);
};
