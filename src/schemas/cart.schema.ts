import { z } from 'zod';

export const modifierSelectionSchema = z.object({
  groupId: z.string().uuid(),
  modifierId: z.string().uuid(),
}).strict();

export const addToCartSchema = z.object({
  menuItemId: z.string().uuid(),
  quantity: z.number().int().positive(),
  modifiers: z.array(modifierSelectionSchema).optional(),
  notes: z.string().optional(),
}).strict();

export const updateCartItemSchema = z.object({
  quantity: z.number().int().positive().optional(),
  modifiers: z.array(modifierSelectionSchema).optional(),
  notes: z.string().optional(),
}).strict();
