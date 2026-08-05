import { Request, Response } from 'express';
import * as kitchenService from '../services/kitchen.service';

export async function getBoard(req: Request, res: Response) {
  const db = req.db!;
  const auth = req.auth!;
  const query = req.query as { status?: string; branchId?: string };

  const data = await kitchenService.getBoard(db, auth, query);
  
  res.status(200).json({ ok: true, data });
}

export async function advanceOrder(req: Request, res: Response) {
  const db = req.db!;
  const auth = req.auth!;
  const { orderId } = req.params as { orderId: string };
  const body = req.body as { to?: string };

  const data = await kitchenService.advanceOrderStatus(db, auth, orderId, body.to);

  res.status(200).json({ ok: true, data });
}
