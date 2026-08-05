import { z } from 'zod';

export const payBillSchema = z.object({
  splitMethod: z.enum(['full', 'equal', 'by_person', 'custom']),
  method: z.enum(['cash', 'card', 'wallet']),
  allocations: z.array(
    z.object({
      memberId: z.string().uuid(),
      amount: z.number().int().nonnegative()
    })
  ).optional(),
  offerId: z.string().uuid().optional()
}).strict();
