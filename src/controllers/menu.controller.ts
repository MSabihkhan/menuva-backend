import { Request, Response } from 'express';
import * as menuService from '../services/menu.service';
import { supabaseAdmin } from '../config/supabase';
import { AppError } from '../utils/AppError';

export async function getMenu(req: Request, res: Response) {
  const branchId = req.auth?.branchId;
  if (!branchId) throw new AppError(401, 'INVALID_TOKEN', 'Branch ID missing in token');
  
  const menu = await menuService.getAssembledMenu(req.db!, branchId, req.auth?.restaurantId);
  res.status(200).json({ ok: true, data: menu });
}

export async function getManageMenu(_req: Request, res: Response) {
  const menu = await menuService.getManageMenu(_req.db!);
  res.status(200).json({ ok: true, data: menu });
}
export async function getMenuItem(req: Request, res: Response) {
  const itemId = req.params.itemId as string;
  const item = await menuService.getMenuItem(req.db!, itemId);
  res.status(200).json({ ok: true, data: item });
}

export async function createMenuItem(req: Request, res: Response) {
  const item = await menuService.createMenuItem(req.db!, req.auth!.restaurantId, req.body);
  res.status(201).json({ ok: true, data: { item } });
}

export async function updateMenuItem(req: Request, res: Response) {
  const itemId = req.params.itemId as string;
  const item = await menuService.updateMenuItem(req.db!, itemId, req.body);
  res.status(200).json({ ok: true, data: { item } });
}
export async function updateMenuItemPrice(req: Request, res: Response) {
  const itemId = req.params.itemId as string;
  const { price } = req.body;
  await menuService.queuePriceChange(supabaseAdmin, req.auth!.restaurantId, req.auth!.userId, itemId, price);
  res.status(202).json({ ok: true, data: { queued: true, effectiveFrom: new Date().toISOString() } });
}

export async function deleteMenuItem(req: Request, res: Response) {
  const itemId = req.params.itemId as string;
  await menuService.deleteMenuItem(req.db!, itemId);
  res.status(200).json({ ok: true, data: {} });
}

export async function createCategory(req: Request, res: Response) {
  const category = await menuService.createCategory(req.db!, req.auth!.restaurantId, req.body);
  res.status(201).json({ ok: true, data: { category } });
}

export async function updateCategory(req: Request, res: Response) {
  const categoryId = req.params.categoryId as string;
  const category = await menuService.updateCategory(req.db!, categoryId, req.body);
  res.status(200).json({ ok: true, data: { category } });
}

export async function deleteCategory(req: Request, res: Response) {
  const categoryId = req.params.categoryId as string;
  await menuService.deleteCategory(req.db!, categoryId);
  res.status(200).json({ ok: true, data: {} });
}

export async function updateModifierGroups(req: Request, res: Response) {
  const itemId = req.params.itemId as string;
  const { groups } = req.body;
  const updatedGroups = await menuService.replaceModifierGroups(req.db!, req.auth!.restaurantId, itemId, groups);
  res.status(200).json({ ok: true, data: { groups: updatedGroups } });
}

export async function updateAvailability(req: Request, res: Response) {
  const branchId = req.params.branchId as string;
  const itemId = req.params.itemId as string;
  const { available } = req.body;
  const branchMenuItem = await menuService.updateAvailability(req.db!, branchId, itemId, available);
  res.status(200).json({ ok: true, data: { branchMenuItem } });
}

export async function updatePriceOverride(req: Request, res: Response) {
  const branchId = req.params.branchId as string;
  const itemId = req.params.itemId as string;
  const { priceOverride } = req.body;
  const branchMenuItem = await menuService.updatePriceOverride(req.db!, branchId, itemId, priceOverride);
  res.status(200).json({ ok: true, data: { branchMenuItem } });
}
