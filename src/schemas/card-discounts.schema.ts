import { z } from 'zod';

export const createCardDiscountSchema = z.object({
  bankName: z.string().min(1),
  cardType: z.string().min(1).optional().nullable(),
  discountBps: z.number().int().nonnegative(),
  validFrom: z.string().datetime().optional().nullable(),
  validUntil: z.string().datetime().optional().nullable(),
  isActive: z.boolean().optional(),
}).strict();

export const updateCardDiscountSchema = z.object({
  bankName: z.string().min(1).optional(),
  cardType: z.string().min(1).optional().nullable(),
  discountBps: z.number().int().nonnegative().optional(),
  validFrom: z.string().datetime().optional().nullable(),
  validUntil: z.string().datetime().optional().nullable(),
  isActive: z.boolean().optional(),
}).strict();
