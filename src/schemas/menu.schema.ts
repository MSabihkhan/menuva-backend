import { z } from 'zod';
import { MODIFIER_GROUP_TYPES } from '../config/constants';

export const menuItemParamsSchema = z.object({
  itemId: z.string().uuid(),
}).strict();

export const menuCategoryParamsSchema = z.object({
  categoryId: z.string().uuid(),
}).strict();

export const branchMenuItemParamsSchema = z.object({
  branchId: z.string().uuid(),
  itemId: z.string().uuid(),
}).strict();

export const createMenuItemSchema = z.object({
  categoryId: z.string().uuid(),
  name: z.string().min(1),
  description: z.string().optional(),
  price: z.number().int().nonnegative(),
  costPrice: z.number().int().nonnegative().optional(),
  tag: z.string().optional(),
  emoji: z.string().optional(),
  isSpicy: z.boolean().optional(),
  isGlutenFree: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
}).strict();

export const updateMenuItemSchema = createMenuItemSchema
  .omit({ price: true, categoryId: true })
  .extend({
    categoryId: z.string().uuid().optional(),
  })
  .partial()
  .strict();

export const updateMenuItemPriceSchema = z.object({
  price: z.number().int().nonnegative(),
}).strict();

export const createMenuCategorySchema = z.object({
  name: z.string().min(1),
  sortOrder: z.number().int().optional(),
}).strict();

export const updateMenuCategorySchema = createMenuCategorySchema.partial().strict();

export const modifierSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1),
  priceDelta: z.number().int(),
  sortOrder: z.number().int().optional(),
}).strict();

export const modifierGroupSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1),
  groupType: z.enum(MODIFIER_GROUP_TYPES),
  isRequired: z.boolean(),
  maxSelections: z.number().int().nonnegative(),
  sortOrder: z.number().int().optional(),
  modifiers: z.array(modifierSchema),
}).strict();

export const updateModifierGroupsSchema = z.object({
  groups: z.array(modifierGroupSchema),
}).strict();

export const updateAvailabilitySchema = z.object({
  available: z.boolean(),
}).strict();

export const updatePriceOverrideSchema = z.object({
  priceOverride: z.number().int().nonnegative().nullable(),
}).strict();
