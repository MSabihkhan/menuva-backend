import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { setAvailability, setPriceOverride } from '../services/menu-availability.service';
import { AppError } from '../utils/AppError';

export const updateAvailability = asyncHandler(async (req: Request, res: Response) => {
  const { branchId, itemId } = req.params;
  const { available } = req.body;
  const db = req.db;

  if (!db) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Database client not available');
  }

  const branchMenuItem = await setAvailability(db, branchId as string, itemId as string, available);

  res.status(200).json({
    ok: true,
    data: { branchMenuItem },
  });
});

export const updatePriceOverride = asyncHandler(async (req: Request, res: Response) => {
  const { branchId, itemId } = req.params;
  const { priceOverride } = req.body;
  const db = req.db;

  if (!db) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Database client not available');
  }

  const branchMenuItem = await setPriceOverride(db, branchId as string, itemId as string, priceOverride);

  res.status(200).json({
    ok: true,
    data: { branchMenuItem },
  });
});
