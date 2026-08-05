import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../types/database.types';
import { AppError } from '../utils/AppError';

type BranchMenuItemRow = Database['public']['Tables']['branch_menu_items']['Row'];
type BranchMenuItemUpdate = Database['public']['Tables']['branch_menu_items']['Update'];

export const updateBranchMenuItem = async (
  db: SupabaseClient<Database>,
  branchId: string,
  itemId: string,
  updates: BranchMenuItemUpdate
): Promise<BranchMenuItemRow> => {
  const { data, error } = await db
    .from('branch_menu_items')
    .update(updates)
    .eq('branch_id', branchId)
    .eq('menu_item_id', itemId)
    .select()
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      throw new AppError(404, 'NOT_FOUND', 'Branch menu item not found');
    }
    throw new AppError(500, 'INTERNAL_ERROR', error.message);
  }

  if (!data) {
    throw new AppError(404, 'NOT_FOUND', 'Branch menu item not found');
  }

  return data;
};
