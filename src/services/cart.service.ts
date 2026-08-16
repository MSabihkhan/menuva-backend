import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../types/database.types';
import * as cartModel from '../models/cart.model';
import { AppError } from '../utils/AppError';
import { applyBps } from '../utils/money';
import { broadcastToSession } from '../utils/realtime';
import { logEvent } from '../models/event.model';

type Db = SupabaseClient<Database>;

export const cartService = {
  async getCart(db: Db, sessionId: string, restaurantId: string, branchId: string, currentMemberId?: string) {
    // Independent queries, so they run together. Sequentially these cost one
    // Supabase round trip each (~250ms), which is most of what made opening
    // the cart feel slow.
    const [items, members, rates] = await Promise.all([
      cartModel.getSessionCartItems(db, sessionId),
      cartModel.getSessionMembers(db, sessionId),
      cartModel.getRestaurantRates(db, restaurantId),
    ]);

    const membersMap = new Map<string, any>();
    for (const m of members) {
      membersMap.set(m.id, {
        memberId: m.id,
        name: m.name,
        initials: m.initials,
        isCurrentUser: currentMemberId === m.id,
        items: []
      });
    }

    if (items.length === 0) {
      return {
        members: Array.from(membersMap.values()),
        summary: { subtotal: 0, tax: 0, serviceCharge: 0, total: 0 }
      };
    }

    const menuItemIds = [...new Set(items.map(i => i.menu_item_id))];
    const modifierIds = items.flatMap(i => {
      const mods = i.modifiers_json as Array<{groupId: string, modifierId: string}> | null;
      return mods ? mods.map(m => m.modifierId) : [];
    });

    const [menuItems, modifiers] = await Promise.all([
      cartModel.getMenuItemsForCart(db, menuItemIds, branchId),
      cartModel.getModifiersForCart(db, [...new Set(modifierIds)]),
    ]);

    let subtotal = 0;

    for (const item of items) {
      const menuData = menuItems.find(m => m.id === item.menu_item_id);
      if (!menuData) {
        // Dropping a line here removes it from the cart AND the subtotal with no
        // signal, i.e. silent under-charging. It should now only be reachable if
        // the menu row was hard-deleted out from under a live cart.
        console.warn(`[cart] cart_item ${item.id} references missing menu_item ${item.menu_item_id} — line skipped`);
        continue;
      }

      // @ts-ignore
      const branchData = menuData.branch_menu_items?.[0];
      const basePrice = branchData?.price_override ?? menuData.price;
      
      let unitPrice = basePrice;
      const itemModifiers = [];
      
      const mods = item.modifiers_json as Array<{groupId: string, modifierId: string}> | null;
      if (mods) {
        for (const m of mods) {
          const modData = modifiers.find(mod => mod.id === m.modifierId);
          if (modData) {
            unitPrice += modData.price_delta;
            itemModifiers.push(modData);
          }
        }
      }

      const lineTotal = unitPrice * item.quantity;
      subtotal += lineTotal;

      const memberId = item.member_id;
      if (!membersMap.has(memberId)) {
        membersMap.set(memberId, {
          memberId,
          name: 'Unknown',
          initials: '??',
          isCurrentUser: currentMemberId === memberId,
          items: []
        });
      }

      membersMap.get(memberId).items.push({
        id: item.id,
        menuItemId: item.menu_item_id,
        name: menuData.name,
        quantity: item.quantity,
        modifiers: itemModifiers,
        unitPrice,
        lineTotal
      });
    }

    const tax = applyBps(subtotal, rates.tax_rate_bps);
    const serviceCharge = rates.service_charge_bps ? applyBps(subtotal, rates.service_charge_bps) : 0;
    const total = subtotal + tax + serviceCharge;

    return {
      members: Array.from(membersMap.values()),
      summary: {
        subtotal,
        tax,
        serviceCharge,
        total
      }
    };
  },

  async addItem(db: Db, sessionId: string, memberId: string, restaurantId: string, branchId: string, data: any) {
    // Three independent lookups — availability, modifier validation, and the
    // existing-line check — fired together rather than one after another.
    //
    // Merging matters here: adding the same burger from the menu and again from
    // an upsell used to produce two "1x" lines rather than one "2x", because
    // every add was an unconditional INSERT.
    const [menuItems, , existing] = await Promise.all([
      cartModel.getMenuItemsForCart(db, [data.menuItemId], branchId),
      this.validateModifiers(db, data.menuItemId, data.modifiers || []),
      cartModel.findMatchingCartItem(db, sessionId, memberId, data.menuItemId, data.modifiers || []),
    ]);

    // @ts-ignore
    if (!menuItems.length || !menuItems[0].branch_menu_items?.[0]?.available) {
      throw new AppError(404, 'NOT_FOUND', 'Item not available on this branch');
    }

    const inserted = existing
      ? await cartModel.updateCartItem(db, existing.id, {
          quantity: existing.quantity + data.quantity,
        })
      : await cartModel.insertCartItem(db, {
          session_id: sessionId,
          member_id: memberId,
          restaurant_id: restaurantId,
          menu_item_id: data.menuItemId,
          quantity: data.quantity,
          modifiers_json: data.modifiers || [],
        });

    if (!inserted) throw new AppError(500, 'INTERNAL_ERROR', 'Failed to add item to cart');

    await broadcastToSession(sessionId, 'cart_updated', {
      memberId,
      action: existing ? 'update' : 'add',
      cartItemId: inserted.id,
    });

    // Fire-and-forget event logging
    logEvent({
      tenantId: restaurantId,
      branchId,
      sessionId,
      actorType: 'diner',
      eventType: 'item_added_to_cart',
      itemId: data.menuItemId,
      payload: { cartItemId: inserted.id, quantity: data.quantity },
    });

    return inserted;
  },
  
  async updateItem(db: Db, cartItemId: string, data: any) {
    const updateData: any = {};
    if (data.quantity !== undefined) updateData.quantity = data.quantity;
    if (data.modifiers !== undefined) {
      const existing = await cartModel.getCartItem(db, cartItemId);
      if (!existing) throw new AppError(404, 'NOT_FOUND', 'Item not found');
      
      await this.validateModifiers(db, existing.menu_item_id, data.modifiers);
      updateData.modifiers_json = data.modifiers;
    }
    
    const updated = await cartModel.updateCartItem(db, cartItemId, updateData);
    if (!updated) throw new AppError(404, 'NOT_FOUND', 'Item not found');

    if (updated.session_id) {
      await broadcastToSession(updated.session_id, 'cart_updated', {
        memberId: updated.member_id,
        action: 'update',
        cartItemId,
      });
    }

    // Fire-and-forget event logging
    logEvent({
      tenantId: updated.restaurant_id || '',
      sessionId: updated.session_id || undefined,
      actorType: 'diner',
      eventType: 'cart_item_updated',
      itemId: updated.menu_item_id || undefined,
      payload: { cartItemId, quantity: data.quantity },
    });

    return updated;
  },

  async removeItem(db: Db, cartItemId: string, sessionId?: string, memberId?: string) {
    const deleted = await cartModel.deleteCartItem(db, cartItemId);
    if (!deleted) throw new AppError(404, 'NOT_FOUND', 'Item not found');

    if (sessionId) {
      await broadcastToSession(sessionId, 'cart_updated', {
        memberId: memberId || null,
        action: 'remove',
        cartItemId,
      });

      // Fire-and-forget event logging
      logEvent({
        tenantId: '',
        sessionId,
        actorType: 'diner',
        eventType: 'item_removed_from_cart',
        payload: { cartItemId },
      });
    }
  },
  
  async validateModifiers(db: Db, menuItemId: string, selectedModifiers: Array<{groupId: string, modifierId: string}>) {
    const groups = await cartModel.getModifierGroupsForItem(db, menuItemId);
    
    for (const group of groups) {
      const selectedForGroup = selectedModifiers.filter(m => m.groupId === group.id);
      if (group.is_required && selectedForGroup.length === 0) {
         throw new AppError(409, 'CONFLICT', `Modifier group ${group.id} is required`);
      }
      if (group.max_selections && selectedForGroup.length > group.max_selections) {
         throw new AppError(409, 'CONFLICT', `Modifier group ${group.id} exceeds max selections`);
      }
      
      for (const sel of selectedForGroup) {
         // @ts-ignore
         const validModIds = group.modifiers.map(m => m.id);
         if (!validModIds.includes(sel.modifierId)) {
           throw new AppError(409, 'CONFLICT', `Modifier ${sel.modifierId} invalid for group ${group.id}`);
         }
      }
    }
  }
};
