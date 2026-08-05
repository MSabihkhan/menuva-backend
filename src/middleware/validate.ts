import type { RequestHandler } from 'express';
import type { ZodType } from 'zod';
import { AppError } from '../utils/AppError';

export const validate =
  (schema: ZodType<unknown>, source: 'body' | 'query' | 'params' = 'body'): RequestHandler =>
  (req, _res, next) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        'Request validation failed',
        result.error.flatten(),
      );
    }
    // Replace with parsed + coerced + stripped data
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (req as any)[source] = result.data;
    next();
  };
