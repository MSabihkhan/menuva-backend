import { Router } from 'express';
import {
  ownerSignup,
  staffLogin,
  staffRefresh,
  staffLogout,
  dinerJoin,
  staffInvite,
  tableMembers,
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
  tableMembersParamsSchema,
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

// Public on purpose: the diner scanning the code has no session yet, so there
// is no token to authenticate with. Scoped to one table by its QR token and
// returns display names + initials only.
router.get(
  '/auth/diner/table/:qrToken/members',
  authLimiter,
  validate(tableMembersParamsSchema, 'params'),
  asyncHandler(tableMembers)
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
