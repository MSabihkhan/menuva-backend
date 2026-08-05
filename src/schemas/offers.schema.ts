import { z } from 'zod';
import { DISCOUNT_TYPES } from '../config/constants';

export const createOfferBodySchema = z.object({
  name: z.string().min(1),
  discountType: z.enum(DISCOUNT_TYPES),
  discountValue: z.number().int().min(0),
  validFrom: z.string().datetime().optional(),
  validUntil: z.string().datetime().optional(),
  isActive: z.boolean().optional(),
}).strict();

export const updateOfferParamsSchema = z.object({
  id: z.string().uuid()
});

export const updateOfferBodySchema = z.object({
  name: z.string().min(1).optional(),
  discountType: z.enum(DISCOUNT_TYPES).optional(),
  discountValue: z.number().int().min(0).optional(),
  validFrom: z.string().datetime().optional().nullable(),
  validUntil: z.string().datetime().optional().nullable(),
  isActive: z.boolean().optional(),
}).strict();

export const deleteOfferParamsSchema = z.object({
  id: z.string().uuid()
});

export const createCardDiscountBodySchema = z.object({
  bankName: z.string().min(1),
  cardType: z.string().optional().nullable(),
  discountBps: z.number().int().min(0),
  validFrom: z.string().datetime().optional(),
  validUntil: z.string().datetime().optional(),
  isActive: z.boolean().optional(),
}).strict();

export const updateCardDiscountParamsSchema = z.object({
  id: z.string().uuid()
});

export const updateCardDiscountBodySchema = z.object({
  bankName: z.string().min(1).optional(),
  cardType: z.string().optional().nullable(),
  discountBps: z.number().int().min(0).optional(),
  validFrom: z.string().datetime().optional().nullable(),
  validUntil: z.string().datetime().optional().nullable(),
  isActive: z.boolean().optional(),
}).strict();

export const deleteCardDiscountParamsSchema = z.object({
  id: z.string().uuid()
});
