import * as menuModel from '../models/menu.model';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../types/database.types';
import { AppError } from '../utils/AppError';

type Db = SupabaseClient<Database>;

/**
 * Restaurant-level menu for the admin console (staff). Unlike getAssembledMenu
 * this is NOT branch-scoped (owners have no branchId) and includes the
 * management-only fields `costPrice`, `categoryId`, and `sortOrder` so the item
 * editor can populate without a second raw fetch.
 */
export async function getManageMenu(db: Db) {
  const [categories, items] = await Promise.all([
    menuModel.getMenuCategories(db),
    menuModel.getMenuItems(db),
  ]);

  return {
    categories: categories.map((c: any) => ({
      id: c.id,
      name: c.name,
      sortOrder: c.sort_order,
      items: items
        .filter((i: any) => i.category_id === c.id)
        .sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
        .map((i: any) => ({
          id: i.id,
          categoryId: i.category_id,
          name: i.name,
          description: i.description,
          price: i.price,
          costPrice: i.cost_price,
          tag: i.tag,
          emoji: i.emoji,
          isSpicy: i.is_spicy,
          isGlutenFree: i.is_gluten_free,
          sortOrder: i.sort_order,
          has3d: (i.models_3d || []).length > 0,
          images: (i.images || []).map((img: any) => ({ url: img.url, isPrimary: img.is_primary })),
          // The console needs these to edit variants/add-ons. The per-item
          // GET /menu/items/:id is diner-only, so without them here the admin
          // has no way to read an item's existing modifiers at all.
          modifierGroups: (i.modifier_groups || [])
            .map((g: any) => ({
              id: g.id,
              name: g.name,
              groupType: g.group_type,
              isRequired: g.is_required,
              maxSelections: g.max_selections ?? 1,
              sortOrder: g.sort_order ?? 0,
              modifiers: (g.modifiers || [])
                .slice()
                .sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
                .map((m: any) => ({
                  id: m.id,
                  name: m.name,
                  priceDelta: m.price_delta,
                  sortOrder: m.sort_order ?? 0,
                })),
            }))
            .sort((a: any, b: any) => a.sortOrder - b.sortOrder),
        })),
    })),
  };
}

export async function getAssembledMenu(db: Db, branchId: string, restaurantId?: string) {
  // Four independent reads. Run sequentially they were four Supabase round
  // trips (~250ms each) on the very first screen the diner sees.
  const [categories, items, branchItems, brand] = await Promise.all([
    menuModel.getMenuCategories(db),
    menuModel.getMenuItems(db),
    menuModel.getBranchMenuItems(db, branchId),
    restaurantId ? menuModel.getRestaurantBrand(db, restaurantId) : Promise.resolve(null),
  ]);

  const branchItemMap = new Map(branchItems.map((bi: any) => [bi.menu_item_id, bi]));

  const itemMap = new Map();
  items.forEach((item: any) => {
    const bi = branchItemMap.get(item.id);
    const available = bi ? bi.available : true;
    const price = (bi && bi.price_override !== null) ? bi.price_override : item.price;
    
    const images = (item.images || []).sort((a: any, b: any) => a.sort_order - b.sort_order);
    const modifierGroups = (item.modifier_groups || []).map((g: any) => ({
       id: g.id,
       name: g.name,
       groupType: g.group_type,
       isRequired: g.is_required,
       maxSelections: g.max_selections,
       sortOrder: g.sort_order,
       modifiers: (g.modifiers || []).sort((a: any, b: any) => a.sort_order - b.sort_order).map((m: any) => ({
         id: m.id,
         name: m.name,
         priceDelta: m.price_delta,
         sortOrder: m.sort_order
       }))
    })).sort((a: any, b: any) => a.sortOrder - b.sortOrder);

    // The diner AR viewer needs the actual asset URLs, not just a boolean —
    // without these it can only render a placeholder model. `has3d` is kept for
    // existing callers (menu badges) and stays in lockstep with `models3d`.
    const model3d = (item.models_3d || [])[0];

    itemMap.set(item.id, {
      id: item.id,
      name: item.name,
      description: item.description,
      price,
      emoji: item.emoji,
      tag: item.tag,
      isSpicy: item.is_spicy,
      isGlutenFree: item.is_gluten_free,
      available,
      has3d: item.models_3d && item.models_3d.length > 0,
      models3d: model3d
        ? {
            glbUrl: model3d.glb_url,
            usdzUrl: model3d.usdz_url ?? null,
            posterUrl: model3d.poster_url ?? null,
          }
        : null,
      images: images.map((img: any) => ({ url: img.url, isPrimary: img.is_primary })),
      modifierGroups,
      categoryId: item.category_id,
      sortOrder: item.sort_order
    });
  });

  const categoryArray = categories.map((c: any) => {
    const catItems = Array.from(itemMap.values())
      .filter((i: any) => i.categoryId === c.id)
      .sort((a: any, b: any) => a.sortOrder - b.sortOrder);

    return {
      id: c.id,
      name: c.name,
      sortOrder: c.sort_order,
      items: catItems.map((i: any) => {
        const { categoryId, sortOrder, ...rest } = i;
        return rest;
      })
    };
  });

  return {
    restaurant: brand ? { name: brand.name, currency: brand.currency } : null,
    categories: categoryArray,
  };
}

export async function getMenuItem(db: Db, itemId: string) {
  const item = await menuModel.getMenuItemById(db, itemId);
  return item;
}

export async function createMenuItem(db: Db, restaurantId: string, item: any) {
  const category = await menuModel.getCategoryById(db, item.categoryId);
  if (!category) throw new AppError(404, 'NOT_FOUND', 'Category not found');
  
  const created = await menuModel.createMenuItem(db, restaurantId, item);
  
  // also audit log
  const { error } = await db.from('audit_log').insert({
    restaurant_id: restaurantId,
    actor_type: 'staff',
    actor_id: restaurantId, // assuming auth context in controller can pass real user
    action: 'item_added',
    entity_type: 'menu_items',
    entity_id: created.id,
  });
  if (error) console.error('Failed to write audit_log for item_added');
  
  return created;
}

export async function updateMenuItem(db: Db, itemId: string, updates: any) {
  if (updates.categoryId) {
     await menuModel.getCategoryById(db, updates.categoryId);
  }
  return menuModel.updateMenuItem(db, itemId, updates);
}

export async function queuePriceChange(db: Db, restaurantId: string, userId: string, itemId: string, newPrice: number) {
  await menuModel.queuePriceChange(db, restaurantId, userId, itemId, newPrice);
}

export async function deleteMenuItem(db: Db, itemId: string) {
  return menuModel.softDeleteMenuItem(db, itemId);
}

export async function createCategory(db: Db, restaurantId: string, category: { name: string; sortOrder?: number }) {
  return menuModel.createCategory(db, restaurantId, category);
}

export async function updateCategory(db: Db, categoryId: string, updates: { name?: string; sortOrder?: number }) {
  return menuModel.updateCategory(db, categoryId, updates);
}

export async function deleteCategory(db: Db, categoryId: string) {
  // Enforce delete block if active items reference it
  const items = await menuModel.getMenuItems(db);
  const references = items.filter((i: any) => i.category_id === categoryId);
  if (references.length > 0) {
    throw new AppError(409, 'CONFLICT', 'Cannot delete category with active items');
  }
  return menuModel.softDeleteCategory(db, categoryId);
}

export async function replaceModifierGroups(db: Db, restaurantId: string, itemId: string, groups: any[]) {
  return menuModel.replaceModifierGroups(db, restaurantId, itemId, groups);
}

export async function updateAvailability(db: Db, branchId: string, itemId: string, available: boolean) {
  return menuModel.updateBranchMenuItemAvailability(db, branchId, itemId, available);
}

export async function updatePriceOverride(db: Db, branchId: string, itemId: string, priceOverride: number | null) {
  return menuModel.updateBranchMenuItemPriceOverride(db, branchId, itemId, priceOverride);
}
