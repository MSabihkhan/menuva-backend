import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../types/database.types';
import * as OfferModel from '../models/offers.model';

type Db = SupabaseClient<Database>;
type OfferRow = Database['public']['Tables']['offers']['Row'];
type OfferInsert = Database['public']['Tables']['offers']['Insert'];
type OfferUpdate = Database['public']['Tables']['offers']['Update'];

type CardDiscountRow = Database['public']['Tables']['card_discounts']['Row'];
type CardDiscountInsert = Database['public']['Tables']['card_discounts']['Insert'];
type CardDiscountUpdate = Database['public']['Tables']['card_discounts']['Update'];

// --- Mapping Helpers ---
function mapOfferRow(row: OfferRow) {
  return {
    id: row.id,
    restaurantId: row.restaurant_id,
    name: row.name,
    discountType: row.discount_type,
    discountValue: row.discount_value,
    validFrom: row.valid_from,
    validUntil: row.valid_until,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapCardDiscountRow(row: CardDiscountRow) {
  return {
    id: row.id,
    restaurantId: row.restaurant_id,
    bankName: row.bank_name,
    cardType: row.card_type,
    discountBps: row.discount_bps,
    validFrom: row.valid_from,
    validUntil: row.valid_until,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

// --- Offers ---

export async function getOffers(db: Db) {
  const rows = await OfferModel.listOffers(db);
  return rows.map(mapOfferRow);
}

export async function createOffer(
  db: Db,
  restaurantId: string,
  payload: {
    name: string;
    discountType: 'percentage' | 'fixed';
    discountValue: number;
    validFrom?: string;
    validUntil?: string;
    isActive?: boolean;
  }
) {
  const offer: OfferInsert = {
    restaurant_id: restaurantId,
    name: payload.name,
    discount_type: payload.discountType,
    discount_value: payload.discountValue,
    valid_from: payload.validFrom,
    valid_until: payload.validUntil,
    is_active: payload.isActive
  };
  const row = await OfferModel.createOffer(db, offer);
  return mapOfferRow(row);
}

export async function updateOffer(
  db: Db,
  id: string,
  payload: {
    name?: string;
    discountType?: 'percentage' | 'fixed';
    discountValue?: number;
    validFrom?: string | null;
    validUntil?: string | null;
    isActive?: boolean;
  }
) {
  const offerUpdate: OfferUpdate = {};
  if (payload.name !== undefined) offerUpdate.name = payload.name;
  if (payload.discountType !== undefined) offerUpdate.discount_type = payload.discountType;
  if (payload.discountValue !== undefined) offerUpdate.discount_value = payload.discountValue;
  if (payload.validFrom !== undefined) offerUpdate.valid_from = payload.validFrom;
  if (payload.validUntil !== undefined) offerUpdate.valid_until = payload.validUntil;
  if (payload.isActive !== undefined) offerUpdate.is_active = payload.isActive;

  const row = await OfferModel.updateOffer(db, id, offerUpdate);
  return mapOfferRow(row);
}

export async function deleteOffer(db: Db, id: string) {
  await OfferModel.deleteOffer(db, id);
}

// --- Card Discounts ---

export async function getCardDiscounts(db: Db) {
  const rows = await OfferModel.listCardDiscounts(db);
  return rows.map(mapCardDiscountRow);
}

export async function createCardDiscount(
  db: Db,
  restaurantId: string,
  payload: {
    bankName: string;
    cardType?: string | null;
    discountBps: number;
    validFrom?: string;
    validUntil?: string;
    isActive?: boolean;
  }
) {
  const discount: CardDiscountInsert = {
    restaurant_id: restaurantId,
    bank_name: payload.bankName,
    card_type: payload.cardType,
    discount_bps: payload.discountBps,
    valid_from: payload.validFrom,
    valid_until: payload.validUntil,
    is_active: payload.isActive
  };
  const row = await OfferModel.createCardDiscount(db, discount);
  return mapCardDiscountRow(row);
}

export async function updateCardDiscount(
  db: Db,
  id: string,
  payload: {
    bankName?: string;
    cardType?: string | null;
    discountBps?: number;
    validFrom?: string | null;
    validUntil?: string | null;
    isActive?: boolean;
  }
) {
  const discountUpdate: CardDiscountUpdate = {};
  if (payload.bankName !== undefined) discountUpdate.bank_name = payload.bankName;
  if (payload.cardType !== undefined) discountUpdate.card_type = payload.cardType;
  if (payload.discountBps !== undefined) discountUpdate.discount_bps = payload.discountBps;
  if (payload.validFrom !== undefined) discountUpdate.valid_from = payload.validFrom;
  if (payload.validUntil !== undefined) discountUpdate.valid_until = payload.validUntil;
  if (payload.isActive !== undefined) discountUpdate.is_active = payload.isActive;

  const row = await OfferModel.updateCardDiscount(db, id, discountUpdate);
  return mapCardDiscountRow(row);
}

export async function deleteCardDiscount(db: Db, id: string) {
  await OfferModel.deleteCardDiscount(db, id);
}
