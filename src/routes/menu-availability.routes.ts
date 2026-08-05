import { Router } from 'express';
import { updateAvailability, updatePriceOverride } from '../controllers/menu-availability.controller';
import { authenticate } from '../middleware/authenticate';
import { requireStaff, requireBranchScope, requireRole } from '../middleware/authorize';
import { validate } from '../middleware/validate';
import { writeLimiter } from '../middleware/security';
import { 
  updateAvailabilitySchema, 
  updatePriceOverrideSchema,
  branchMenuItemParamsSchema
} from '../schemas/menu-availability.schema';

export const menuAvailabilityRoutes = Router({ mergeParams: true });

// PATCH /api/branches/:branchId/menu/:itemId/availability
menuAvailabilityRoutes.patch(
  '/:branchId/menu/:itemId/availability',
  writeLimiter,
  authenticate,
  requireStaff,
  requireRole('owner', 'branch_manager', 'kitchen'),
  requireBranchScope,
  validate(branchMenuItemParamsSchema, 'params'),
  validate(updateAvailabilitySchema, 'body'),
  updateAvailability
);

// PATCH /api/branches/:branchId/menu/:itemId/price-override
menuAvailabilityRoutes.patch(
  '/:branchId/menu/:itemId/price-override',
  writeLimiter,
  authenticate,
  requireStaff,
  requireRole('owner', 'branch_manager'),
  requireBranchScope,
  validate(branchMenuItemParamsSchema, 'params'),
  validate(updatePriceOverrideSchema, 'body'),
  updatePriceOverride
);

export default menuAvailabilityRoutes;
