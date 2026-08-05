import { Router } from 'express';
import { authenticate } from '../middleware/authenticate';
import { requireRole, requireDiner, requireBranchScope } from '../middleware/authorize';
import { validate } from '../middleware/validate';
import { asyncHandler } from '../utils/asyncHandler';
import * as menuController from '../controllers/menu.controller';
import * as menuSchema from '../schemas/menu.schema';
import { globalRateLimiter, writeLimiter } from '../middleware/security';

const router = Router();

router.get('/menu',
  globalRateLimiter,
  authenticate,
  requireDiner,
  asyncHandler(menuController.getMenu)
);

// Restaurant-level menu for the admin console (staff, not branch-scoped).
router.get('/menu/manage',
  globalRateLimiter,
  authenticate,
  requireRole('owner', 'editor', 'branch_manager', 'manager'),
  asyncHandler(menuController.getManageMenu)
);

router.get('/menu/items/:itemId',
  globalRateLimiter,
  authenticate,
  requireDiner,
  validate(menuSchema.menuItemParamsSchema, 'params'),
  asyncHandler(menuController.getMenuItem)
);

router.post('/menu/items',
  writeLimiter,
  authenticate,
  requireRole('owner', 'editor'),
  validate(menuSchema.createMenuItemSchema, 'body'),
  asyncHandler(menuController.createMenuItem)
);

router.patch('/menu/items/:itemId',
  writeLimiter,
  authenticate,
  requireRole('owner', 'editor'),
  validate(menuSchema.menuItemParamsSchema, 'params'),
  validate(menuSchema.updateMenuItemSchema, 'body'),
  asyncHandler(menuController.updateMenuItem)
);

router.patch('/menu/items/:itemId/price',
  writeLimiter,
  authenticate,
  requireRole('owner', 'editor'),
  validate(menuSchema.menuItemParamsSchema, 'params'),
  validate(menuSchema.updateMenuItemPriceSchema, 'body'),
  asyncHandler(menuController.updateMenuItemPrice)
);

router.delete('/menu/items/:itemId',
  writeLimiter,
  authenticate,
  requireRole('owner', 'editor'),
  validate(menuSchema.menuItemParamsSchema, 'params'),
  asyncHandler(menuController.deleteMenuItem)
);

router.post('/menu/categories',
  writeLimiter,
  authenticate,
  requireRole('owner', 'editor'),
  validate(menuSchema.createMenuCategorySchema, 'body'),
  asyncHandler(menuController.createCategory)
);

router.patch('/menu/categories/:categoryId',
  writeLimiter,
  authenticate,
  requireRole('owner', 'editor'),
  validate(menuSchema.menuCategoryParamsSchema, 'params'),
  validate(menuSchema.updateMenuCategorySchema, 'body'),
  asyncHandler(menuController.updateCategory)
);

router.delete('/menu/categories/:categoryId',
  writeLimiter,
  authenticate,
  requireRole('owner', 'editor'),
  validate(menuSchema.menuCategoryParamsSchema, 'params'),
  asyncHandler(menuController.deleteCategory)
);

router.patch('/menu/items/:itemId/modifier-groups',
  writeLimiter,
  authenticate,
  requireRole('owner', 'editor'),
  validate(menuSchema.menuItemParamsSchema, 'params'),
  validate(menuSchema.updateModifierGroupsSchema, 'body'),
  asyncHandler(menuController.updateModifierGroups)
);

router.patch('/branches/:branchId/menu/:itemId/availability',
  writeLimiter,
  authenticate,
  requireRole('owner', 'branch_manager', 'kitchen'),
  requireBranchScope,
  validate(menuSchema.branchMenuItemParamsSchema, 'params'),
  validate(menuSchema.updateAvailabilitySchema, 'body'),
  asyncHandler(menuController.updateAvailability)
);

router.patch('/branches/:branchId/menu/:itemId/price-override',
  writeLimiter,
  authenticate,
  requireRole('owner', 'branch_manager'),
  requireBranchScope,
  validate(menuSchema.branchMenuItemParamsSchema, 'params'),
  validate(menuSchema.updatePriceOverrideSchema, 'body'),
  asyncHandler(menuController.updatePriceOverride)
);

export default router;
