import { Request, Response } from 'express';
import * as ordersService from '../services/orders.service';

export async function placeOrder(req: Request, res: Response): Promise<void> {
  const db = req.db!;
  const sessionId = req.auth!.sessionId as string;
  const { idempotencyKey, kitchenNotes } = req.body as { idempotencyKey: string; kitchenNotes?: string };

  const result = await ordersService.placeOrder(db, sessionId, idempotencyKey, kitchenNotes);
  res.status(result.merged ? 200 : 201).json({ ok: true, data: result });
}

export async function getOrders(req: Request, res: Response): Promise<void> {
  const db = req.db!;
  // This route is diner-only (`requireDiner`), so sessionId is always present.
  const sessionId = req.auth!.sessionId as string;
  const orders = await ordersService.getOrders(db, sessionId);
  res.status(200).json({ ok: true, data: orders });
}

export async function getOrderById(req: Request, res: Response): Promise<void> {
  const db = req.db!;
  const orderId = req.params.orderId as string;
  // Diners are scoped to their own session; staff (kitchen/owner/etc.) can
  // look up any order in their restaurant, so sessionId is left undefined.
  const sessionId = req.auth!.kind === 'diner' ? (req.auth!.sessionId as string) : undefined;
  const order = await ordersService.getOrderById(db, orderId, sessionId);
  res.status(200).json({ ok: true, data: order });
}
