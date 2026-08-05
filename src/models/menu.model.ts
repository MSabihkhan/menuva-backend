import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../types/database.types';
import { AppError } from '../utils/AppError';

type Db = SupabaseClient<Database>;

export async function getMenuCategories(db: Db) {
  const { data, error } = await db
    .from('menu_categories')
    .select('*')
    .is('deleted_at', null)
    .order('sort_order');
  if (error) throw new AppError(500, 'INTERNAL_ERROR', error.message);
  return data || [];
}

export async function getCategoryById(db: Db, categoryId: string) {
  const { data, error } = await db
    .from('menu_categories')
    .select('*')
    .eq('id', categoryId)
    .is('deleted_at', null)
    .single();
  if (error) {
    if (error.code === 'PGRST116') throw new AppError(404, 'NOT_FOUND', 'Category not found');
    throw new AppError(500, 'INTERNAL_ERROR', error.message);
  }
  return data;
}

export async function createCategory(db: Db, restaurantId: string, category: { name: string; sortOrder?: number }) {
  const { data, error } = await db
    .from('menu_categories')
    .insert({
      restaurant_id: restaurantId,
      name: category.name,
      sort_order: category.sortOrder ?? 0,
    })
    .select()
    .single();
  if (error) throw new AppError(500, 'INTERNAL_ERROR', error.message);
  return data;
}

export async function updateCategory(db: Db, categoryId: string, updates: { name?: string; sortOrder?: number }) {
  const payload: any = {};
  if (updates.name !== undefined) payload.name = updates.name;
  if (updates.sortOrder !== undefined) payload.sort_order = updates.sortOrder;

  const { data, error } = await db
    .from('menu_categories')
    .update(payload)
    .eq('id', categoryId)
    .is('deleted_at', null)
    .select()
    .single();
  if (error) {
    if (error.code === 'PGRST116') throw new AppError(404, 'NOT_FOUND', 'Category not found');
    throw new AppError(500, 'INTERNAL_ERROR', error.message);
  }
  return data;
}

export async function softDeleteCategory(db: Db, categoryId: string) {
  const { data, error } = await db
    .from('menu_categories')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', categoryId)
    .is('deleted_at', null)
    .select()
    .single();
  if (error) {
    if (error.code === 'PGRST116') throw new AppError(404, 'NOT_FOUND', 'Category not found');
    throw new AppError(500, 'INTERNAL_ERROR', error.message);
  }
  return data;
}

export async function getMenuItems(db: Db) {
  const { data, error } = await db
    .from('menu_items')
    .select(`*, modifier_groups(*, modifiers(*)), images(*), videos(*), models_3d(*)`)
    .is('deleted_at', null);
  if (error) throw new AppError(500, 'INTERNAL_ERROR', error.message);
  return data || [];
}

export async function getMenuItemById(db: Db, itemId: string) {
  const { data, error } = await db
    .from('menu_items')
    .select(`*, modifier_groups(*, modifiers(*)), images(*), videos(*), models_3d(*)`)
    .eq('id', itemId)
    .is('deleted_at', null)
    .single();
  if (error) {
    if (error.code === 'PGRST116') throw new AppError(404, 'NOT_FOUND', 'Item not found');
    throw new AppError(500, 'INTERNAL_ERROR', error.message);
  }
  return data;
}

export async function createMenuItem(db: Db, restaurantId: string, item: any) {
  const { data, error } = await db
    .from('menu_items')
    .insert({
      restaurant_id: restaurantId,
      category_id: item.categoryId,
      name: item.name,
      description: item.description,
      price: item.price,
      cost_price: item.costPrice,
      tag: item.tag,
      emoji: item.emoji,
      is_spicy: item.isSpicy,
      is_gluten_free: item.isGlutenFree,
      sort_order: item.sortOrder ?? 0,
    })
    .select()
    .single();
  if (error) throw new AppError(500, 'INTERNAL_ERROR', error.message);
  return data;
}

export async function updateMenuItem(db: Db, itemId: string, updates: any) {
  const payload: any = {};
  if (updates.categoryId !== undefined) payload.category_id = updates.categoryId;
  if (updates.name !== undefined) payload.name = updates.name;
  if (updates.description !== undefined) payload.description = updates.description;
  if (updates.costPrice !== undefined) payload.cost_price = updates.costPrice;
  if (updates.tag !== undefined) payload.tag = updates.tag;
  if (updates.emoji !== undefined) payload.emoji = updates.emoji;
  if (updates.isSpicy !== undefined) payload.is_spicy = updates.isSpicy;
  if (updates.isGlutenFree !== undefined) payload.is_gluten_free = updates.isGlutenFree;
  if (updates.sortOrder !== undefined) payload.sort_order = updates.sortOrder;

  const { data, error } = await db
    .from('menu_items')
    .update(payload)
    .eq('id', itemId)
    .is('deleted_at', null)
    .select()
    .single();
  if (error) {
    if (error.code === 'PGRST116') throw new AppError(404, 'NOT_FOUND', 'Item not found');
    throw new AppError(500, 'INTERNAL_ERROR', error.message);
  }
  return data;
}

export async function softDeleteMenuItem(db: Db, itemId: string) {
  const { data, error } = await db
    .from('menu_items')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', itemId)
    .is('deleted_at', null)
    .select()
    .single();
  if (error) {
    if (error.code === 'PGRST116') throw new AppError(404, 'NOT_FOUND', 'Item not found');
    throw new AppError(500, 'INTERNAL_ERROR', error.message);
  }
  return data;
}

export async function queuePriceChange(db: Db, restaurantId: string, userId: string, itemId: string, newPrice: number) {
  // Remove any existing pending change for this item
  await db.from('pending_price_changes')
    .delete()
    .eq('menu_item_id', itemId)
    .eq('status', 'pending');

  // Insert the new pending change
  const payload = {
    restaurant_id: restaurantId,
    menu_item_id: itemId,
    new_price: newPrice,
    requested_by: userId,
    status: 'pending'
  };
  console.log('Inserting pending_price_changes payload:', payload);
  const { error } = await db.from('pending_price_changes').insert(payload);

  if (error) {
    console.error('Insert error for pending_price_changes:', error);
    throw new AppError(500, 'INTERNAL_ERROR', error.message);
  }

  // Still record the queue action in audit_log
  await db.from('audit_log').insert({
    restaurant_id: restaurantId,
    actor_type: 'staff',
    actor_id: userId,
    action: 'price_change_queued',
    entity_type: 'menu_items',
    entity_id: itemId,
    new_value: { price: newPrice },
  });
}

export async function getBranchMenuItems(db: Db, branchId: string) {
  const { data, error } = await db
    .from('branch_menu_items')
    .select('*')
    .eq('branch_id', branchId);
  if (error) throw new AppError(500, 'INTERNAL_ERROR', error.message);
  return data || [];
}

/**
 * Restaurant branding for the diner header (name + currency). Read through the
 * caller's token-scoped client so RLS keeps it tenant-safe. Best-effort: a
 * missing row must not break the menu, so this never throws.
 */
export async function getRestaurantBrand(db: Db, restaurantId: string) {
  const { data } = await db
    .from('restaurants')
    .select('name, currency')
    .eq('id', restaurantId)
    .single();
  return data ?? null;
}

/**
 * Per-branch settings are stored in `branch_menu_items`, but a row is only
 * created by seeding and onboarding — never by `POST /menu/items`. So for any
 * dish the owner added through the admin console there is nothing to UPDATE,
 * and the 86 toggle / price override returned 404 "Branch menu item not found".
 *
 * The row is an override record, so creating it on first write is the correct
 * semantic: absent means "branch uses the defaults". Both writers below upsert.
 */
async function upsertBranchMenuItem(
  db: Db,
  branchId: string,
  itemId: string,
  patch: { available?: boolean; price_override?: number | null },
) {
  const { data: updated, error: updateError } = await db
    .from('branch_menu_items')
    .update(patch)
    .eq('branch_id', branchId)
    .eq('menu_item_id', itemId)
    .select()
    .maybeSingle();

  if (updateError) throw new AppError(500, 'INTERNAL_ERROR', updateError.message);
  if (updated) return updated;

  // No override row yet — mint one, inheriting the item's tenant.
  const { data: item, error: itemError } = await db
    .from('menu_items')
    .select('restaurant_id')
    .eq('id', itemId)
    .is('deleted_at', null)
    .maybeSingle();

  if (itemError) throw new AppError(500, 'INTERNAL_ERROR', itemError.message);
  if (!item) throw new AppError(404, 'NOT_FOUND', 'Menu item not found');

  const { data: inserted, error: insertError } = await db
    .from('branch_menu_items')
    .insert({
      branch_id: branchId,
      menu_item_id: itemId,
      restaurant_id: item.restaurant_id,
      // Default to available so setting only a price override doesn't
      // accidentally hide the dish.
      available: patch.available ?? true,
      price_override: patch.price_override ?? null,
    })
    .select()
    .single();

  if (insertError) throw new AppError(500, 'INTERNAL_ERROR', insertError.message);
  return inserted;
}

export async function updateBranchMenuItemAvailability(db: Db, branchId: string, itemId: string, available: boolean) {
  return upsertBranchMenuItem(db, branchId, itemId, { available });
}

export async function updateBranchMenuItemPriceOverride(db: Db, branchId: string, itemId: string, priceOverride: number | null) {
  return upsertBranchMenuItem(db, branchId, itemId, { price_override: priceOverride });
}

export async function replaceModifierGroups(db: Db, restaurantId: string, itemId: string, groups: any[]) {
  const { error: delError } = await db
    .from('modifier_groups')
    .delete()
    .eq('menu_item_id', itemId);
  if (delError) throw new AppError(500, 'INTERNAL_ERROR', delError.message);

  if (groups.length === 0) return [];

  const groupsToInsert = groups.map(g => ({
    restaurant_id: restaurantId,
    menu_item_id: itemId,
    name: g.name,
    group_type: g.groupType,
    is_required: g.isRequired,
    max_selections: g.maxSelections,
    sort_order: g.sortOrder ?? 0,
  }));

  const { data: insertedGroups, error: grpError } = await db
    .from('modifier_groups')
    .insert(groupsToInsert)
    .select();
  if (grpError) throw new AppError(500, 'INTERNAL_ERROR', grpError.message);

  const modifiersToInsert: any[] = [];
  groups.forEach((g, idx) => {
    const groupId = insertedGroups![idx].id;
    // Column is `group_id`, NOT `modifier_group_id` — the wrong name made every
    // save of an item's modifiers fail with a 500 ("Could not find the
    // 'modifier_group_id' column of 'modifiers' in the schema cache"), so no
    // owner could attach variants or add-ons to a dish at all.
    (g.modifiers ?? []).forEach((m: any) => {
      modifiersToInsert.push({
        restaurant_id: restaurantId,
        group_id: groupId,
        name: m.name,
        price_delta: m.priceDelta,
        sort_order: m.sortOrder ?? 0,
      });
    });
  });

  if (modifiersToInsert.length > 0) {
    const { error: modError } = await db.from('modifiers').insert(modifiersToInsert);
    if (modError) throw new AppError(500, 'INTERNAL_ERROR', modError.message);
  }

  return getMenuItemById(db, itemId).then(res => res.modifier_groups);
}
