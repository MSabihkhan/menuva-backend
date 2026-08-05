import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import * as OffersService from '../services/offers.service';

// --- Offers ---

export const getOffers = asyncHandler(async (req: Request, res: Response) => {
  const data = await OffersService.getOffers(req.db!);
  res.json({ ok: true, data });
});

export const createOffer = asyncHandler(async (req: Request, res: Response) => {
  const restaurantId = req.auth!.restaurantId;
  const data = await OffersService.createOffer(req.db!, restaurantId, req.body);
  res.status(201).json({ ok: true, data });
});

export const updateOffer = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const data = await OffersService.updateOffer(req.db!, id, req.body);
  res.json({ ok: true, data });
});

export const deleteOffer = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  await OffersService.deleteOffer(req.db!, id);
  res.json({ ok: true });
});

// --- Card Discounts ---

export const getCardDiscounts = asyncHandler(async (req: Request, res: Response) => {
  const data = await OffersService.getCardDiscounts(req.db!);
  res.json({ ok: true, data });
});

export const createCardDiscount = asyncHandler(async (req: Request, res: Response) => {
  const restaurantId = req.auth!.restaurantId;
  const data = await OffersService.createCardDiscount(req.db!, restaurantId, req.body);
  res.status(201).json({ ok: true, data });
});

export const updateCardDiscount = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const data = await OffersService.updateCardDiscount(req.db!, id, req.body);
  res.json({ ok: true, data });
});

export const deleteCardDiscount = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  await OffersService.deleteCardDiscount(req.db!, id);
  res.json({ ok: true });
});
