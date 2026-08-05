import { Router } from 'express';
import * as kitchenController from '../controllers/kitchen.controller';
import { authenticate } from '../middleware/authenticate';
import { requireRole } from '../middleware/authorize';
import { validate } from '../middleware/validate';
import { getKitchenBoardSchema, advanceOrderSchema, advanceOrderParamsSchema } from '../schemas/kitchen.schema';
import { asyncHandler } from '../utils/asyncHandler';
import { writeLimiter } from '../middleware/security';

const router = Router();

// GET /api/kitchen/board
router.get(
  '/kitchen/board',
  authenticate,
  requireRole('owner', 'branch_manager', 'manager', 'kitchen'),
  validate(getKitchenBoardSchema, 'query'),
  asyncHandler(kitchenController.getBoard)
);

// POST /api/orders/:orderId/advance
router.post(
  '/orders/:orderId/advance',
  writeLimiter,
  authenticate,
  requireRole('owner', 'branch_manager', 'manager', 'kitchen'),
  validate(advanceOrderParamsSchema, 'params'),
  validate(advanceOrderSchema, 'body'),
  asyncHandler(kitchenController.advanceOrder)
);

export default router;
