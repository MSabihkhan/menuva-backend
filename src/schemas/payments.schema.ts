import { z } from 'zod';

export const splitPreviewSchema = z.object({
  choices: z.record(z.enum(['full', 'equal', 'personal'])),
}).strict();

export const payBillSchema = z.object({
  splitMethod: z.enum(['full', 'equal', 'by_person', 'custom']),
  method: z.enum(['cash', 'card', 'wallet']),
  allocations: z.array(
    z.object({
      memberId: z.string().uuid(),
      amount: z.number().int().nonnegative()
    })
  ).optional(),
  offerId: z.string().uuid().optional(),
  /** Bank card the diner says they're paying with. Opt-in, `card` method only. */
  cardDiscountId: z.string().uuid().optional()
}).strict();
