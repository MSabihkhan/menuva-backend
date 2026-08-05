import { Router, RequestHandler } from 'express';
import { authenticate } from '../middleware/authenticate';
import { requireDiner } from '../middleware/authorize';
import { validate } from '../middleware/validate';
import { asyncHandler } from '../utils/asyncHandler';
import * as ordersController from '../controllers/orders.controller';
import * as ordersSchema from '../schemas/orders.schema';
import { globalRateLimiter, dinerLimiter } from '../middleware/security';
import { AppError } from '../utils/AppError';
import type { Role } from '../types/auth.types';

const router = Router();

const requireDinerOrStaffRoles = (...roles: Role[]): RequestHandler => {
  return (req, _res, next) => {
    const a = req.auth;
    if (!a) {
      throw new AppError(401, 'MISSING_TOKEN', 'Authentication required');
    }
    if (a.kind === 'diner') {
      return next();
    }
    if (a.kind === 'staff' && a.role && roles.includes(a.role)) {
      return next();
    }
    throw new AppError(403, 'INSUFFICIENT_ROLE', 'Access denied');
  };
};

router.post('/orders/place',
  dinerLimiter,
  authenticate,
  requireDiner,
  validate(ordersSchema.placeOrderSchema, 'body'),
  asyncHandler(ordersController.placeOrder)
);

// BLOCKED-ON-RPC (per prompt instruction)
router.post('/branches/:branchId/orders',
  dinerLimiter,
  authenticate,
  requireDiner,
  validate(ordersSchema.branchOrdersParamsSchema, 'params'),
  validate(ordersSchema.placeOrderSchema, 'body'),
  asyncHandler(ordersController.placeOrder)
);

router.get('/orders',
  globalRateLimiter,
  authenticate,
  requireDiner,
  asyncHandler(ordersController.getOrders)
);

router.get('/orders/:orderId',
  globalRateLimiter,
  authenticate,
  requireDinerOrStaffRoles('owner', 'branch_manager', 'manager', 'kitchen'),
  validate(ordersSchema.getOrderParamsSchema, 'params'),
  asyncHandler(ordersController.getOrderById)
);

export default router;
