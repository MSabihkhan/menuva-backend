import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../types/database.types';
import * as CardDiscountsModel from '../models/card-discounts.model';

type Db = SupabaseClient<Database>;
type CardDiscountInsert = Database['public']['Tables']['card_discounts']['Insert'];
type CardDiscountUpdate = Database['public']['Tables']['card_discounts']['Update'];

export async function listCardDiscounts(db: Db) {
  return CardDiscountsModel.listCardDiscounts(db);
}

export async function getCardDiscount(db: Db, id: string) {
  return CardDiscountsModel.getCardDiscount(db, id);
}

export async function createCardDiscount(db: Db, restaurantId: string, data: Omit<CardDiscountInsert, 'restaurant_id'>) {
  return CardDiscountsModel.createCardDiscount(db, {
    ...data,
    restaurant_id: restaurantId,
  });
}

export async function updateCardDiscount(db: Db, id: string, data: CardDiscountUpdate) {
  // RLS will enforce that the caller can only update their own tenant's rows
  return CardDiscountsModel.updateCardDiscount(db, id, data);
}

export async function deleteCardDiscount(db: Db, id: string) {
  // RLS will enforce that the caller can only delete their own tenant's rows
  return CardDiscountsModel.deleteCardDiscount(db, id);
}
