import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../types/database.types';
import * as upsellModel from '../models/upsell.model';

type Db = SupabaseClient<Database>;
type RulesUpdate = Database['public']['Tables']['upsell_rules']['Update'];

export async function getRules(db: Db) {
  return await upsellModel.getRules(db);
}

export async function updateRules(db: Db, patch: RulesUpdate) {
  return await upsellModel.updateRules(db, patch);
}

export async function listPairings(db: Db) {
  return await upsellModel.listPairings(db);
}

export async function createPairings(
  db: Db,
  restaurantId: string,
  sourceItemId: string,
  targetItemIds: string[],
  sortOrder?: number
) {
  // `sort_order` is NOT NULL. Passing the optional argument straight through
  // sent an explicit null and every pairing insert failed with a not-null
  // violation, surfaced as a generic "Failed to create pairings".
  const inserts = targetItemIds.map((targetItemId, index) => ({
    restaurant_id: restaurantId,
    source_item_id: sourceItemId,
    target_item_id: targetItemId,
    sort_order: sortOrder ?? index
  }));
  return await upsellModel.createPairings(db, inserts);
}

export async function deletePairing(db: Db, id: string) {
  return await upsellModel.deletePairing(db, id);
}

export async function listAffinity(db: Db) {
  return await upsellModel.listAffinity(db);
}

export async function createAffinity(
  db: Db,
  restaurantId: string,
  sourceCategoryId: string,
  targetCategoryId: string,
  priority?: number
) {
  return await upsellModel.createAffinity(db, {
    restaurant_id: restaurantId,
    source_category_id: sourceCategoryId,
    target_category_id: targetCategoryId,
    priority
  });
}

export async function deleteAffinity(db: Db, id: string) {
  return await upsellModel.deleteAffinity(db, id);
}

export async function getSuggestions(
  db: Db,
  sessionId: string,
  trigger: string,
  triggerItemId: string | undefined,
  cartItemIds: string[],
  declinedItemIds: string[],
  impressionsThisRound: number
) {
  // Every argument is sent explicitly. Omitting an optional one (the client
  // may leave `declinedItemIds` out entirely) dropped it from the RPC call, no
  // function matched the resulting signature, and the whole suggestions
  // endpoint 500'd — so no diner saw any upsell at all.
  const { data, error } = await db.rpc('get_upsell_suggestions', {
    p_session_id: sessionId,
    p_trigger: trigger,
    p_trigger_item_id: triggerItemId ?? null,
    p_cart_item_ids: cartItemIds ?? [],
    p_declined_item_ids: declinedItemIds ?? [],
    p_impressions_this_round: impressionsThisRound ?? 0,
  } as any);
  if (error) throw error;
  return data;
}

export async function logEvent(db: Db, sessionId: string, eventType: string, payload: any) {
  const { error } = await db.rpc('log_upsell_event', {
    p_session_id: sessionId,
    p_event_type: eventType,
    p_payload: payload,
  });
  if (error) throw error;
}
