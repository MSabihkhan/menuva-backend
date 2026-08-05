import { Router } from 'express';
import * as RestaurantController from '../controllers/restaurants.controller';
import * as RestaurantSchema from '../schemas/restaurants.schema';
import { authenticate } from '../middleware/authenticate';
import { requireRole, requireStaff, requireBranchScope } from '../middleware/authorize';
import { validate } from '../middleware/validate';
import { globalRateLimiter, writeLimiter } from '../middleware/security';

const router = Router();

// /api/restaurant
router.get(
  '/restaurant',
  globalRateLimiter,
  authenticate,
  requireStaff,
  RestaurantController.getRestaurant
);

router.patch(
  '/restaurant',
  writeLimiter,
  authenticate,
  requireRole('owner'),
  validate(RestaurantSchema.patchRestaurantSchema, 'body'),
  RestaurantController.updateRestaurant
);

// /api/branches
router.get(
  '/branches',
  globalRateLimiter,
  authenticate,
  requireStaff,
  RestaurantController.listBranches
);

router.post(
  '/branches',
  writeLimiter,
  authenticate,
  requireRole('owner'),
  validate(RestaurantSchema.postBranchSchema, 'body'),
  RestaurantController.createBranch
);

router.patch(
  '/branches/:id',
  writeLimiter,
  authenticate,
  requireRole('owner'),
  validate(RestaurantSchema.branchParamsSchema, 'params'),
  validate(RestaurantSchema.patchBranchSchema, 'body'),
  RestaurantController.updateBranch
);

router.delete(
  '/branches/:id',
  writeLimiter,
  authenticate,
  requireRole('owner'),
  validate(RestaurantSchema.branchParamsSchema, 'params'),
  RestaurantController.deleteBranch
);

// /api/branches/:branchId/tables
router.get(
  '/branches/:branchId/tables',
  globalRateLimiter,
  authenticate,
  requireStaff,
  requireBranchScope,
  validate(RestaurantSchema.branchTablesParamsSchema, 'params'),
  RestaurantController.listTables
);

router.post(
  '/branches/:branchId/tables',
  writeLimiter,
  authenticate,
  requireRole('owner', 'branch_manager'),
  requireBranchScope,
  validate(RestaurantSchema.branchTablesParamsSchema, 'params'),
  validate(RestaurantSchema.postTableSchema, 'body'),
  RestaurantController.createTable
);

router.patch(
  '/branches/:branchId/tables/:id',
  writeLimiter,
  authenticate,
  requireRole('owner', 'branch_manager'),
  requireBranchScope,
  validate(RestaurantSchema.tableParamsSchema, 'params'),
  validate(RestaurantSchema.patchTableSchema, 'body'),
  RestaurantController.updateTable
);

router.delete(
  '/branches/:branchId/tables/:id',
  writeLimiter,
  authenticate,
  requireRole('owner', 'branch_manager'),
  requireBranchScope,
  validate(RestaurantSchema.tableParamsSchema, 'params'),
  RestaurantController.deleteTable
);

// /api/branches/:branchId/tables/:tableId/regenerate-qr
router.post(
  '/branches/:branchId/tables/:tableId/regenerate-qr',
  writeLimiter,
  authenticate,
  requireRole('owner', 'branch_manager'),
  requireBranchScope,
  validate(RestaurantSchema.regenerateQrParamsSchema, 'params'),
  RestaurantController.regenerateTableQr
);

// /api/tables/:tableId/close-session
router.post(
  '/tables/:tableId/close-session',
  writeLimiter,
  authenticate,
  requireRole('owner', 'branch_manager', 'manager'),
  validate(RestaurantSchema.closeSessionParamsSchema, 'params'),
  RestaurantController.closeTableSession
);

// /api/audit-log
import * as auditController from '../controllers/audit.controller';
import { auditLogQuerySchema } from '../schemas/audit.schema';

router.get(
  '/audit-log',
  globalRateLimiter,
  authenticate,
  requireRole('owner'),
  validate(auditLogQuerySchema, 'query'),
  auditController.list
);

// /api/notifications
import * as notificationController from '../controllers/notification.controller';
import { notificationQuerySchema } from '../schemas/notification.schema';

router.get(
  '/notifications',
  globalRateLimiter,
  authenticate,
  requireRole('owner', 'branch_manager'),
  validate(notificationQuerySchema, 'query'),
  notificationController.list
);

export default router;
