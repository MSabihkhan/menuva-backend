import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../types/database.types';
import * as mediaModel from '../models/media.model';

type Db = SupabaseClient<Database>;

export async function uploadImage(
  db: Db,
  restaurantId: string,
  menuItemId: string,
  file: Buffer,
  filename: string,
  contentType: string,
  altText: string | null,
  isPrimary: boolean,
) {
  const path = `${restaurantId}/${menuItemId}/${Date.now()}-${filename}`;
  const url = await mediaModel.uploadToStorage(db, 'menu-media', path, file, contentType);
  const existing = await mediaModel.listImages(db, menuItemId);
  const sortOrder = existing.length;
  const image = await mediaModel.createImage(db, restaurantId, menuItemId, url, altText, isPrimary || existing.length === 0, sortOrder);
  return image;
}

export async function uploadVideo(
  db: Db,
  restaurantId: string,
  menuItemId: string,
  file: Buffer,
  filename: string,
  contentType: string,
  durationSec: number | null,
) {
  const path = `${restaurantId}/${menuItemId}/${Date.now()}-${filename}`;
  const url = await mediaModel.uploadToStorage(db, 'menu-media', path, file, contentType);
  const video = await mediaModel.createVideo(db, restaurantId, menuItemId, url, durationSec, 0);
  return video;
}

export async function upload3dModel(
  db: Db,
  restaurantId: string,
  menuItemId: string,
  glbFile: Buffer,
  glbFilename: string,
  usdzFile: Buffer | null,
  usdzFilename: string | null,
  posterFile: Buffer | null,
  posterFilename: string | null,
) {
  const glbPath = `${restaurantId}/${menuItemId}/${Date.now()}-${glbFilename}`;
  const glbUrl = await mediaModel.uploadToStorage(db, '3d-models', glbPath, glbFile, 'model/gltf-binary');

  let usdzUrl: string | null = null;
  if (usdzFile && usdzFilename) {
    const usdzPath = `${restaurantId}/${menuItemId}/${Date.now()}-${usdzFilename}`;
    usdzUrl = await mediaModel.uploadToStorage(db, '3d-models', usdzPath, usdzFile, 'application/octet-stream');
  }

  let posterUrl: string | null = null;
  if (posterFile && posterFilename) {
    const posterPath = `${restaurantId}/${menuItemId}/${Date.now()}-${posterFilename}`;
    posterUrl = await mediaModel.uploadToStorage(db, 'menu-media', posterPath, posterFile, 'image/png');
  }

  const model = await mediaModel.create3dModel(db, restaurantId, menuItemId, glbUrl, usdzUrl, posterUrl);
  return model;
}

export async function deleteImage(db: Db, imageId: string) {
  return mediaModel.deleteImage(db, imageId);
}

export async function deleteVideo(db: Db, videoId: string) {
  return mediaModel.deleteVideo(db, videoId);
}

export async function delete3dModel(db: Db, modelId: string) {
  return mediaModel.delete3dModel(db, modelId);
}

export async function listImages(db: Db, menuItemId: string) {
  return mediaModel.listImages(db, menuItemId);
}
