import { Request, Response } from 'express';
import * as reviewsService from '../services/reviews.service';

export async function createReview(req: Request, res: Response) {
  const auth = req.auth!;
  
  const { rating, comment } = req.body;

  const review = await reviewsService.submitReview(
    req.db!,
    auth.restaurantId,
    auth.branchId!,
    auth.sessionId!,
    rating,
    comment
  );

  res.status(201).json({ ok: true, data: { review } });
}

export async function listReviews(req: Request, res: Response) {
  const auth = req.auth!;
  
  const { rating, dateFrom, dateTo, branchId } = req.query as any;

  const reviews = await reviewsService.getReviews(
    req.db!,
    auth.role!,
    auth.branchId,
    { rating, dateFrom, dateTo, branchId }
  );

  res.status(200).json({ ok: true, data: { reviews } });
}
