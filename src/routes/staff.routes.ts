import { Router } from 'express';
import * as staffController from '../controllers/staff.controller';
import { authenticate } from '../middleware/authenticate';
import { requireRole } from '../middleware/authorize';
import { validate } from '../middleware/validate';
import { updateStaffSchema } from '../schemas/staff.schema';
import { asyncHandler } from '../utils/asyncHandler';
import { writeLimiter } from '../middleware/security';

const router = Router();

// GET /api/staff
router.get(
  '/staff',
  authenticate,
  requireRole('owner', 'branch_manager'),
  asyncHandler(staffController.list)
);

// PATCH /api/staff/:employeeId
router.patch(
  '/staff/:employeeId',
  writeLimiter,
  authenticate,
  requireRole('owner'),
  validate(updateStaffSchema),
  asyncHandler(staffController.update)
);

// DELETE /api/staff/:employeeId
router.delete(
  '/staff/:employeeId',
  writeLimiter,
  authenticate,
  requireRole('owner'),
  asyncHandler(staffController.remove)
);

export default router;
