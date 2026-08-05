import { Request, Response } from 'express';
import { cartService } from '../services/cart.service';
import { AppError } from '../utils/AppError';

export const cartController = {
  async getCart(req: Request, res: Response) {
    if (!req.auth || req.auth.kind !== 'diner' || !req.db) {
      throw new AppError(401, 'MISSING_TOKEN', 'Diner authentication required');
    }
    const cart = await cartService.getCart(
      req.db,
      req.auth.sessionId!,
      req.auth.restaurantId,
      req.auth.branchId!,
      req.auth.memberId!
    );
    res.status(200).json({ ok: true, data: cart });
  },

  async addItem(req: Request, res: Response) {
    if (!req.auth || req.auth.kind !== 'diner' || !req.db) {
      throw new AppError(401, 'MISSING_TOKEN', 'Diner authentication required');
    }
    console.log('Controller req.auth:', req.auth);
    const item = await cartService.addItem(
      req.db,
      req.auth.sessionId!,
      req.auth.memberId!,
      req.auth.restaurantId,
      req.auth.branchId!,
      req.body
    );
    res.status(201).json({ ok: true, data: { item } });
  },

  async updateItem(req: Request, res: Response) {
    if (!req.auth || req.auth.kind !== 'diner' || !req.db) {
      throw new AppError(401, 'MISSING_TOKEN', 'Diner authentication required');
    }
    const item = await cartService.updateItem(
      req.db,
      req.params.cartItemId as string,
      req.body
    );
    res.status(200).json({ ok: true, data: { item } });
  },

  async removeItem(req: Request, res: Response) {
    if (!req.auth || req.auth.kind !== 'diner' || !req.db) {
      throw new AppError(401, 'MISSING_TOKEN', 'Diner authentication required');
    }
    await cartService.removeItem(
      req.db,
      req.params.cartItemId as string,
      req.auth.sessionId,
      req.auth.memberId
    );
    res.status(200).json({ ok: true });
  }
};
