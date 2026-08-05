import { SupabaseClient } from '@supabase/supabase-js';
import { Database } from '../types/database.types';
import * as RestaurantModel from '../models/restaurants.model';
import crypto from 'crypto';
import { env } from '../config/env';

function generateQrToken(): string {
  return crypto.randomBytes(16).toString('hex');
}

function generateQrUrl(token: string): string {
  // Typical structure for a QR code URL
  return `${env.PUBLIC_APP_URL.replace(/\/$/, '')}/t/${token}`;
}

export async function getRestaurant(db: SupabaseClient<Database>) {
  return await RestaurantModel.getRestaurant(db);
}

export async function updateRestaurant(db: SupabaseClient<Database>, restaurantId: string, updates: any) {
  const dbUpdates: Database['public']['Tables']['restaurants']['Update'] = {};
  if (updates.name !== undefined) dbUpdates.name = updates.name;
  if (updates.slug !== undefined) dbUpdates.slug = updates.slug;
  if (updates.taxRateBps !== undefined) dbUpdates.tax_rate_bps = updates.taxRateBps;
  if (updates.serviceChargeBps !== undefined) dbUpdates.service_charge_bps = updates.serviceChargeBps;

  return await RestaurantModel.updateRestaurant(db, restaurantId, dbUpdates);
}

export async function listBranches(db: SupabaseClient<Database>) {
  return await RestaurantModel.listBranches(db);
}

export async function createBranch(db: SupabaseClient<Database>, restaurantId: string, data: any) {
  const branchData: Database['public']['Tables']['branches']['Insert'] = {
    restaurant_id: restaurantId,
    name: data.name,
    slug: data.slug,
    address: data.address,
    opens_at: data.opensAt,
    closes_at: data.closesAt,
    timezone: data.timezone || 'UTC'
  };
  return await RestaurantModel.createBranch(db, branchData);
}

export async function updateBranch(db: SupabaseClient<Database>, branchId: string, updates: any) {
  const dbUpdates: Database['public']['Tables']['branches']['Update'] = {};
  if (updates.name !== undefined) dbUpdates.name = updates.name;
  if (updates.slug !== undefined) dbUpdates.slug = updates.slug;
  if (updates.address !== undefined) dbUpdates.address = updates.address;
  if (updates.opensAt !== undefined) dbUpdates.opens_at = updates.opensAt;
  if (updates.closesAt !== undefined) dbUpdates.closes_at = updates.closesAt;
  if (updates.timezone !== undefined) dbUpdates.timezone = updates.timezone;
  if (updates.isActive !== undefined) dbUpdates.is_active = updates.isActive;

  return await RestaurantModel.updateBranch(db, branchId, dbUpdates);
}

export async function deleteBranch(db: SupabaseClient<Database>, branchId: string) {
  await RestaurantModel.deleteBranch(db, branchId);
}

export async function listTables(db: SupabaseClient<Database>, branchId: string) {
  return await RestaurantModel.listTables(db, branchId);
}

export async function createTable(db: SupabaseClient<Database>, restaurantId: string, branchId: string, data: any) {
  const qrToken = generateQrToken();
  const qrCodeUrl = generateQrUrl(qrToken);

  const tableData: Database['public']['Tables']['tables']['Insert'] = {
    restaurant_id: restaurantId,
    branch_id: branchId,
    code: data.code,
    label: data.label,
    capacity: data.capacity,
    qr_token: qrToken,
    qr_code_url: qrCodeUrl
  };

  return await RestaurantModel.createTable(db, tableData);
}

export async function updateTable(db: SupabaseClient<Database>, tableId: string, updates: any) {
  const dbUpdates: Database['public']['Tables']['tables']['Update'] = {};
  if (updates.code !== undefined) dbUpdates.code = updates.code;
  if (updates.label !== undefined) dbUpdates.label = updates.label;
  if (updates.capacity !== undefined) dbUpdates.capacity = updates.capacity;

  return await RestaurantModel.updateTable(db, tableId, dbUpdates);
}

export async function deleteTable(db: SupabaseClient<Database>, tableId: string) {
  await RestaurantModel.deleteTable(db, tableId);
}

export async function regenerateTableQr(db: SupabaseClient<Database>, tableId: string) {
  const qrToken = generateQrToken();
  const qrCodeUrl = generateQrUrl(qrToken);

  return await RestaurantModel.regenerateTableQr(db, tableId, qrToken, qrCodeUrl);
}

export async function closeTableSession(db: SupabaseClient<Database>, tableId: string) {
  await RestaurantModel.closeSession(db, tableId);
}
