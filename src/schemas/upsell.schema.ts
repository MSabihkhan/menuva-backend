import { z } from 'zod';

export const getSuggestionsSchema = z.object({
  trigger: z.enum(['add_to_cart', 'cart', 'checkout']),
  triggerItemId: z.string().uuid().optional(),
  cartItemIds: z.array(z.string().uuid()),
  declinedItemIds: z.array(z.string().uuid()).optional(),
  impressionsThisRound: z.number().int().nonnegative()
}).strict();

export const logEventSchema = z.object({
  eventType: z.enum(['upsell_shown', 'upsell_accepted', 'upsell_declined', 'upsell_ignored']),
  payload: z.record(z.any())
}).strict();

export const patchRulesSchema = z.object({
  isEnabled: z.boolean().optional(),
  maxSuggestionsAddCart: z.number().int().positive().optional(),
  maxSuggestionsCart: z.number().int().positive().optional(),
  maxSuggestionsCheckout: z.number().int().positive().optional(),
  maxImpressionsPerRound: z.number().int().positive().optional(),
  autoDismissSeconds: z.number().int().positive().optional(),
  suppressAfterDecline: z.boolean().optional(),
  minimumSupportBps: z.number().int().nonnegative().optional(),
  minimumLiftBps: z.number().int().nonnegative().optional()
}).strict();

export const createPairingSchema = z.object({
  sourceItemId: z.string().uuid(),
  targetItemIds: z.array(z.string().uuid()),
  sortOrder: z.number().int().nonnegative().optional()
}).strict();

export const createAffinitySchema = z.object({
  sourceCategoryId: z.string().uuid(),
  targetCategoryId: z.string().uuid(),
  priority: z.number().int().nonnegative().optional()
}).strict();
