import { z } from 'zod';

export const PROMPT_KINDS = ['place_order', 'split_method', 'end_session', 'pay_bill'] as const;

/** Custom split was removed: only these three are offered. */
export const SPLIT_CHOICES = ['full', 'equal', 'personal'] as const;

export const openPromptSchema = z.object({
  kind: z.enum(PROMPT_KINDS),
  payload: z.record(z.any()).optional(),
}).strict();

export const promptParamsSchema = z.object({
  promptId: z.string().uuid(),
}).strict();

// 'yes' / 'wait' answer a place_order or end_session prompt; a split choice
// answers a split_method one. One column, because a response is a response.
export const respondPromptSchema = z.object({
  response: z.union([z.enum(['yes', 'wait']), z.enum(SPLIT_CHOICES)]),
}).strict();
