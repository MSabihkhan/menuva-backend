import { Router } from 'express';
import {
  ownerSignup,
  staffLogin,
  staffRefresh,
  staffLogout,
  dinerJoin,
  staffInvite,
} from '../controllers/auth.controller';
import { authLimiter, writeLimiter } from '../middleware/security';
import { authenticate } from '../middleware/authenticate';
import { requireRole } from '../middleware/authorize';
import { validate } from '../middleware/validate';
import {
  ownerSignupSchema,
  staffLoginSchema,
  dinerJoinSchema,
  staffInviteSchema,
} from '../schemas/auth.schema';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

router.post(
  '/auth/owner/signup',
  authLimiter,
  validate(ownerSignupSchema),
  asyncHandler(ownerSignup)
);

router.post(
  '/auth/staff/login',
  authLimiter,
  validate(staffLoginSchema),
  asyncHandler(staffLogin)
);

router.post(
  '/auth/staff/refresh',
  authLimiter,
  asyncHandler(staffRefresh)
);

router.post(
  '/auth/staff/logout',
  authenticate,
  asyncHandler(staffLogout)
);

router.post(
  '/auth/diner/join',
  authLimiter,
  validate(dinerJoinSchema),
  asyncHandler(dinerJoin)
);

router.post(
  '/auth/staff/invite',
  writeLimiter,
  authenticate,
  requireRole('owner'),
  validate(staffInviteSchema),
  asyncHandler(staffInvite)
);

export default router;
