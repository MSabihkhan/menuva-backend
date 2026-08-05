import { Request, Response } from 'express';
import * as mediaService from '../services/media.service';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../utils/AppError';

export const uploadImage = asyncHandler(async (req: Request, res: Response) => {
  const file = req.file;
  if (!file) throw new AppError(400, 'VALIDATION_ERROR', 'No file provided');

  const menuItemId = req.params.menuItemId as string;
  const { altText, isPrimary } = req.body;
  const restaurantId = req.auth!.restaurantId;

  const image = await mediaService.uploadImage(
    req.db!, restaurantId, menuItemId,
    file.buffer, file.originalname, file.mimetype,
    altText || null, isPrimary === 'true',
  );
  res.status(201).json({ ok: true, data: image });
});

export const uploadVideo = asyncHandler(async (req: Request, res: Response) => {
  const file = req.file;
  if (!file) throw new AppError(400, 'VALIDATION_ERROR', 'No file provided');

  const menuItemId = req.params.menuItemId as string;
  const { durationSec } = req.body;
  const restaurantId = req.auth!.restaurantId;

  const video = await mediaService.uploadVideo(
    req.db!, restaurantId, menuItemId,
    file.buffer, file.originalname, file.mimetype,
    durationSec ? parseInt(durationSec as string) : null,
  );
  res.status(201).json({ ok: true, data: video });
});

export const upload3dModel = asyncHandler(async (req: Request, res: Response) => {
  // Expects fields: glb (required), usdz (optional), poster (optional)
  const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
  if (!files?.glb?.[0]) throw new AppError(400, 'VALIDATION_ERROR', 'GLB file required');

  const menuItemId = req.params.menuItemId as string;
  const restaurantId = req.auth!.restaurantId;

  const model = await mediaService.upload3dModel(
    req.db!, restaurantId, menuItemId,
    files.glb[0].buffer, files.glb[0].originalname,
    files.usdz?.[0]?.buffer || null, files.usdz?.[0]?.originalname || null,
    files.poster?.[0]?.buffer || null, files.poster?.[0]?.originalname || null,
  );
  res.status(201).json({ ok: true, data: model });
});

export const deleteImage = asyncHandler(async (req: Request, res: Response) => {
  await mediaService.deleteImage(req.db!, req.params.imageId as string);
  res.json({ ok: true, data: null });
});

export const deleteVideo = asyncHandler(async (req: Request, res: Response) => {
  await mediaService.deleteVideo(req.db!, req.params.videoId as string);
  res.json({ ok: true, data: null });
});

export const delete3dModel = asyncHandler(async (req: Request, res: Response) => {
  await mediaService.delete3dModel(req.db!, req.params.modelId as string);
  res.json({ ok: true, data: null });
});

export const getImages = asyncHandler(async (req: Request, res: Response) => {
  const images = await mediaService.listImages(req.db!, req.params.menuItemId as string);
  res.json({ ok: true, data: images });
});
