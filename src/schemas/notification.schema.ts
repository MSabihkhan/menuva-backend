import { z } from 'zod';

export const notificationQuerySchema = z.object({
  channel: z.string().optional(),
  recipientType: z.string().optional(),
  eventType: z.string().optional(),
  limit: z.string().regex(/^\d+$/).optional(),
  offset: z.string().regex(/^\d+$/).optional(),
});
