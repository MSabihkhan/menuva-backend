import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../types/database.types';
import { AppError } from '../utils/AppError';

type Db = SupabaseClient<Database>;

// --- Images ---

export async function listImages(db: Db, menuItemId: string) {
  const { data, error } = await db
    .from('images')
    .select('id, url, alt_text, is_primary, sort_order')
    .eq('menu_item_id', menuItemId)
    .order('sort_order');
  if (error) throw new AppError(500, 'INTERNAL_ERROR', error.message);
  return data;
}

export async function createImage(
  db: Db,
  restaurantId: string,
  menuItemId: string,
  url: string,
  altText: string | null,
  isPrimary: boolean,
  sortOrder: number,
) {
  const { data, error } = await db
    .from('images')
    .insert({
      restaurant_id: restaurantId,
      menu_item_id: menuItemId,
      url,
      alt_text: altText,
      is_primary: isPrimary,
      sort_order: sortOrder,
    })
    .select('id, url, alt_text, is_primary, sort_order')
    .single();
  if (error) throw new AppError(500, 'INTERNAL_ERROR', error.message);
  return data;
}

export async function deleteImage(db: Db, imageId: string) {
  const { error } = await db.from('images').delete().eq('id', imageId);
  if (error) throw new AppError(500, 'INTERNAL_ERROR', error.message);
}

export async function setPrimaryImage(db: Db, menuItemId: string, imageId: string) {
  // Unset all other primaries for this item
  await db.from('images').update({ is_primary: false }).eq('menu_item_id', menuItemId);
  const { error } = await db.from('images').update({ is_primary: true }).eq('id', imageId);
  if (error) throw new AppError(500, 'INTERNAL_ERROR', error.message);
}

// --- Videos ---

export async function createVideo(
  db: Db,
  restaurantId: string,
  menuItemId: string,
  url: string,
  durationSec: number | null,
  sortOrder: number,
) {
  const { data, error } = await db
    .from('videos')
    .insert({
      restaurant_id: restaurantId,
      menu_item_id: menuItemId,
      url,
      duration_sec: durationSec,
      sort_order: sortOrder,
    })
    .select('id, url, duration_sec, sort_order')
    .single();
  if (error) throw new AppError(500, 'INTERNAL_ERROR', error.message);
  return data;
}

export async function deleteVideo(db: Db, videoId: string) {
  const { error } = await db.from('videos').delete().eq('id', videoId);
  if (error) throw new AppError(500, 'INTERNAL_ERROR', error.message);
}

// --- 3D Models ---

export async function create3dModel(
  db: Db,
  restaurantId: string,
  menuItemId: string,
  glbUrl: string,
  usdzUrl: string | null,
  posterUrl: string | null,
) {
  const { data, error } = await db
    .from('models_3d')
    .insert({
      restaurant_id: restaurantId,
      menu_item_id: menuItemId,
      glb_url: glbUrl,
      usdz_url: usdzUrl,
      poster_url: posterUrl,
    })
    .select('id, glb_url, usdz_url, poster_url')
    .single();
  if (error) throw new AppError(500, 'INTERNAL_ERROR', error.message);
  return data;
}

export async function delete3dModel(db: Db, modelId: string) {
  const { error } = await db.from('models_3d').delete().eq('id', modelId);
  if (error) throw new AppError(500, 'INTERNAL_ERROR', error.message);
}

// --- Storage upload helpers ---

export async function uploadToStorage(
  db: Db,
  bucket: 'menu-media' | '3d-models',
  path: string,
  file: Buffer,
  contentType: string,
) {
  const { data, error } = await db.storage
    .from(bucket)
    .upload(path, file, { contentType, upsert: true });
  if (error) throw new AppError(500, 'INTERNAL_ERROR', 'Upload failed: ' + error.message);
  const { data: urlData } = db.storage.from(bucket).getPublicUrl(data.path);
  return urlData.publicUrl;
}

export async function deleteFromStorage(
  db: Db,
  bucket: 'menu-media' | '3d-models',
  paths: string[],
) {
  const { error } = await db.storage.from(bucket).remove(paths);
  if (error) throw new AppError(500, 'INTERNAL_ERROR', 'Delete failed: ' + error.message);
}
