import { Request, Response } from 'express';
import * as CardDiscountsService from '../services/card-discounts.service';

export async function list(req: Request, res: Response) {
  const db = req.db!;
  const discounts = await CardDiscountsService.listCardDiscounts(db);
  res.json({ ok: true, data: { cardDiscounts: discounts } });
}

export async function create(req: Request, res: Response) {
  const db = req.db!;
  const auth = req.auth!;
  const data = req.body;
  const discount = await CardDiscountsService.createCardDiscount(db, auth.restaurantId, {
    bank_name: data.bankName,
    card_type: data.cardType,
    discount_bps: data.discountBps,
    valid_from: data.validFrom,
    valid_until: data.validUntil,
    is_active: data.isActive,
  });
  res.status(201).json({ ok: true, data: { cardDiscount: discount } });
}

export async function update(req: Request, res: Response) {
  const db = req.db!;
  const id = req.params.id as string;
  const data = req.body;
  
  const payload: any = {};
  if (data.bankName !== undefined) payload.bank_name = data.bankName;
  if (data.cardType !== undefined) payload.card_type = data.cardType;
  if (data.discountBps !== undefined) payload.discount_bps = data.discountBps;
  if (data.validFrom !== undefined) payload.valid_from = data.validFrom;
  if (data.validUntil !== undefined) payload.valid_until = data.validUntil;
  if (data.isActive !== undefined) payload.is_active = data.isActive;

  const discount = await CardDiscountsService.updateCardDiscount(db, id, payload);
  res.json({ ok: true, data: { cardDiscount: discount } });
}

export async function remove(req: Request, res: Response) {
  const db = req.db!;
  const id = req.params.id as string;
  await CardDiscountsService.deleteCardDiscount(db, id);
  res.json({ ok: true, data: {} });
}
