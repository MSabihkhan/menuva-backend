import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../types/database.types';
import { AppError } from '../utils/AppError';

type Db = SupabaseClient<Database>;

export async function getSessionCartItems(db: Db, sessionId: string) {
  const { data, error } = await db
    .from('cart_items')
    .select(`
      id,
      menu_item_id,
      quantity,
      modifiers_json,
      member_id,
      session_members!inner (
        name,
        initials
      )
    `)
    .eq('session_id', sessionId);
    
  if (error) throw new AppError(500, 'INTERNAL_ERROR', 'Failed to fetch cart items', error);
  return data;
}

export async function getSessionMembers(db: Db, sessionId: string) {
  const { data, error } = await db
    .from('session_members')
    .select('id, name, initials')
    .eq('session_id', sessionId);

  if (error) throw new AppError(500, 'INTERNAL_ERROR', 'Failed to fetch session members', error);
  return data ?? [];
}

/**
 * Menu rows for the cart, with this branch's override applied.
 *
 * A `branch_menu_items` row is NOT guaranteed to exist: only seeding and
 * onboarding create them, so anything an owner adds through the admin console
 * has none. The assembled menu (`menu.service.getAssembledMenu`) already treats
 * a missing row as "available at base price", and the cart MUST agree — an
 * inner join here made every owner-created dish visible on the menu but
 * un-addable ("Item not available on this branch"), and silently dropped it
 * from cart totals. So: fetch the items, fetch the branch's overrides
 * separately, and synthesise the default when there is no row.
 */
export async function getMenuItemsForCart(db: Db, menuItemIds: string[], branchId: string) {
  if (menuItemIds.length === 0) return [];

  const { data, error } = await db
    .from('menu_items')
    .select('id, name, price')
    .in('id', menuItemIds);

  if (error) {
    console.error('getMenuItemsForCart error:', error);
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to fetch menu items', error);
  }

  const items = data ?? [];
  if (items.length === 0) return [];

  const { data: overrides, error: overrideError } = await db
    .from('branch_menu_items')
    .select('menu_item_id, price_override, available')
    .eq('branch_id', branchId)
    .in('menu_item_id', items.map((i) => i.id));

  if (overrideError) {
    console.error('getMenuItemsForCart branch override error:', overrideError);
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to fetch branch menu items', overrideError);
  }

  const byItemId = new Map((overrides ?? []).map((o) => [o.menu_item_id, o]));

  // Keep the `branch_menu_items: [...]` shape the cart service already reads.
  return items.map((item) => {
    const override = byItemId.get(item.id);
    return {
      ...item,
      branch_menu_items: [
        {
          price_override: override?.price_override ?? null,
          available: override ? override.available : true,
        },
      ],
    };
  });
}

export async function getModifiersForCart(db: Db, modifierIds: string[]) {
  if (modifierIds.length === 0) return [];
  const { data, error } = await db
    .from('modifiers')
    .select('id, name, price_delta')
    .in('id', modifierIds);
    
  if (error) throw new AppError(500, 'INTERNAL_ERROR', 'Failed to fetch modifiers', error);
  return data;
}

export async function getRestaurantRates(db: Db, restaurantId: string) {
  const { data, error } = await db
    .from('restaurants')
    .select('tax_rate_bps, service_charge_bps')
    .eq('id', restaurantId)
    .single();
    
  if (error) throw new AppError(500, 'INTERNAL_ERROR', 'Failed to fetch restaurant rates', error);
  return data;
}

export async function getModifierGroupsForItem(db: Db, menuItemId: string) {
  const { data, error } = await db
    .from('modifier_groups')
    .select(`
      id,
      is_required,
      max_selections,
      modifiers ( id )
    `)
    .eq('menu_item_id', menuItemId);
    
  if (error) throw new AppError(500, 'INTERNAL_ERROR', 'Failed to fetch modifier groups', error);
  return data;
}

/**
 * An existing line for the same diner, same dish, same modifier selection.
 *
 * Ordering the same dish twice must grow one line to quantity 2, not stack two
 * identical lines — which is what happened when the same burger arrived once
 * from the menu and once from an accepted upsell. Modifiers are compared as a
 * normalised set: {cheese, bacon} and {bacon, cheese} are the same order, while
 * a different selection is a genuinely different line and stays separate.
 */
export async function findMatchingCartItem(
  db: Db,
  sessionId: string,
  memberId: string,
  menuItemId: string,
  modifiers: Array<{ groupId: string; modifierId: string }>,
) {
  const { data, error } = await db
    .from('cart_items')
    .select('id, quantity, modifiers_json')
    .eq('session_id', sessionId)
    .eq('member_id', memberId)
    .eq('menu_item_id', menuItemId);

  if (error) throw new AppError(500, 'INTERNAL_ERROR', 'Failed to look up cart item', error);

  const wanted = normaliseModifiers(modifiers);
  return (data ?? []).find(
    row => normaliseModifiers(row.modifiers_json as typeof modifiers) === wanted,
  ) ?? null;
}

function normaliseModifiers(mods: Array<{ groupId: string; modifierId: string }> | null): string {
  if (!Array.isArray(mods) || mods.length === 0) return '';
  return mods
    .map(m => m.modifierId)
    .sort()
    .join(',');
}

export async function insertCartItem(db: Db, insertData: Database['public']['Tables']['cart_items']['Insert']) {
  const { data, error } = await db
    .from('cart_items')
    .insert(insertData)
    .select()
    .single();
    
  if (error) {
    if (error.code === '23503') { // Foreign key violation
       throw new AppError(404, 'NOT_FOUND', 'Related entity not found');
    }
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to add item to cart', error);
  }
  return data;
}

export async function getCartItem(db: Db, cartItemId: string) {
  const { data, error } = await db
    .from('cart_items')
    .select('*')
    .eq('id', cartItemId)
    .single();
    
  if (error) {
    if (error.code === 'PGRST116') return null;
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to fetch cart item', error);
  }
  return data;
}

export async function updateCartItem(db: Db, cartItemId: string, updateData: Database['public']['Tables']['cart_items']['Update']) {
  const { data, error } = await db
    .from('cart_items')
    .update(updateData)
    .eq('id', cartItemId)
    .select()
    .single();
    
  if (error) {
    if (error.code === 'PGRST116') return null;
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to update cart item', error);
  }
  return data;
}

export async function deleteCartItem(db: Db, cartItemId: string) {
  const { data, error } = await db
    .from('cart_items')
    .delete()
    .eq('id', cartItemId)
    .select();
    
  if (error) throw new AppError(500, 'INTERNAL_ERROR', 'Failed to delete cart item', error);
  return data && data.length > 0;
}
