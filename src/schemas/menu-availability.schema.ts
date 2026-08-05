import { z } from 'zod';

export const updateAvailabilitySchema = z.object({
  available: z.boolean(),
}).strict();

export const updatePriceOverrideSchema = z.object({
  priceOverride: z.number().int().nonnegative().nullable(),
}).strict();

export const branchMenuItemParamsSchema = z.object({
  branchId: z.string().uuid(),
  itemId: z.string().uuid(),
}).strict();
