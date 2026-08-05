import { SupabaseClient } from '@supabase/supabase-js';
import { Database } from '../types/database.types';
import * as analyticsModel from '../models/analytics.model';

export const getSales = async (
  db: SupabaseClient<Database>,
  from: string,
  to: string,
  branchId?: string
) => {
  return analyticsModel.getSales(db, from, to, branchId);
};

export const getMenuPerformance = async (db: SupabaseClient<Database>) => {
  return analyticsModel.getMenuPerformance(db);
};

export const getKitchenTiming = async (db: SupabaseClient<Database>) => {
  return analyticsModel.getKitchenTiming(db);
};

export const getUpsell = async (db: SupabaseClient<Database>) => {
  return analyticsModel.getUpsell(db);
};
