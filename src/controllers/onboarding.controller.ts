import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import * as onboardingService from '../services/onboarding.service';
import { AppError } from '../utils/AppError';

export const bootstrap = asyncHandler(async (req: Request, res: Response) => {
  const auth = req.auth;
  if (!auth || auth.kind !== 'staff' || auth.role !== 'owner') {
    throw new AppError(403, 'INSUFFICIENT_ROLE', 'Owner access required');
  }

  const result = await onboardingService.bootstrap(
    req.db!,
    auth.restaurantId,
    auth.userId, // The owner's user ID
    req.body
  );

  res.status(201).json({ ok: true, data: result });
});
