import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import * as RestaurantService from '../services/restaurants.service';

export const getRestaurant = asyncHandler(async (req: Request, res: Response) => {
  const data = await RestaurantService.getRestaurant(req.db!);
  res.json({ ok: true, data });
});

export const updateRestaurant = asyncHandler(async (req: Request, res: Response) => {
  const data = await RestaurantService.updateRestaurant(req.db!, req.auth!.restaurantId, req.body);
  res.json({ ok: true, data });
});

export const listBranches = asyncHandler(async (req: Request, res: Response) => {
  const data = await RestaurantService.listBranches(req.db!);
  res.json({ ok: true, data });
});

export const createBranch = asyncHandler(async (req: Request, res: Response) => {
  const data = await RestaurantService.createBranch(req.db!, req.auth!.restaurantId, req.body);
  res.status(201).json({ ok: true, data });
});

export const updateBranch = asyncHandler(async (req: Request, res: Response) => {
  const data = await RestaurantService.updateBranch(req.db!, req.params.id as string, req.body);
  res.json({ ok: true, data });
});

export const deleteBranch = asyncHandler(async (req: Request, res: Response) => {
  await RestaurantService.deleteBranch(req.db!, req.params.id as string);
  res.json({ ok: true, data: null });
});

export const listTables = asyncHandler(async (req: Request, res: Response) => {
  const data = await RestaurantService.listTables(req.db!, req.params.branchId as string);
  res.json({ ok: true, data });
});

export const createTable = asyncHandler(async (req: Request, res: Response) => {
  const data = await RestaurantService.createTable(req.db!, req.auth!.restaurantId, req.params.branchId as string, req.body);
  res.status(201).json({ ok: true, data });
});

export const updateTable = asyncHandler(async (req: Request, res: Response) => {
  const data = await RestaurantService.updateTable(req.db!, req.params.id as string, req.body);
  res.json({ ok: true, data });
});

export const deleteTable = asyncHandler(async (req: Request, res: Response) => {
  await RestaurantService.deleteTable(req.db!, req.params.id as string);
  res.json({ ok: true, data: null });
});

export const regenerateTableQr = asyncHandler(async (req: Request, res: Response) => {
  const data = await RestaurantService.regenerateTableQr(req.db!, req.params.tableId as string);
  res.json({ ok: true, data: { qrToken: data.qr_token, qrCodeUrl: data.qr_code_url } });
});

export const closeTableSession = asyncHandler(async (req: Request, res: Response) => {
  await RestaurantService.closeTableSession(req.db!, req.params.tableId as string);
  res.json({ ok: true, data: null });
});
