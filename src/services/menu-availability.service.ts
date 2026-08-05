import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../types/database.types';
import { updateBranchMenuItem } from '../models/menu-availability.model';

export const setAvailability = async (
  db: SupabaseClient<Database>,
  branchId: string,
  itemId: string,
  available: boolean
) => {
  return await updateBranchMenuItem(db, branchId, itemId, { available });
};

export const setPriceOverride = async (
  db: SupabaseClient<Database>,
  branchId: string,
  itemId: string,
  priceOverride: number | null
) => {
  return await updateBranchMenuItem(db, branchId, itemId, { price_override: priceOverride });
};
