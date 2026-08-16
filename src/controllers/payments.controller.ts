import { Request, Response } from 'express';
import { paymentsService } from '../services/payments.service';

export const paymentsController = {
  async getBill(req: Request, res: Response) {
    const auth = req.auth!;
    // memberId lets the bill flag which share belongs to the device asking, so
    // the split screen can pre-select the right payer instead of guessing.
    const bill = await paymentsService.getBill(req.db!, auth.sessionId!, auth.restaurantId, auth.memberId);
    res.status(200).json({ ok: true, data: bill });
  },

  async getSplit(req: Request, res: Response) {
    const auth = req.auth!;
    const split = await paymentsService.getSplit(req.db!, auth.sessionId!, auth.restaurantId, req.body.choices);
    res.status(200).json({ ok: true, data: split });
  },

  async payBill(req: Request, res: Response) {
    const auth = req.auth!;
    const payment = await paymentsService.payBill(req.db!, auth.sessionId!, auth.restaurantId, req.body);
    res.status(201).json({ ok: true, data: { payment } });
  }
};
