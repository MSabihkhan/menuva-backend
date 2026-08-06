import type { ErrorRequestHandler, RequestHandler } from 'express';
import { AppError } from '../utils/AppError';
import { logger } from '../utils/logger';
import { env } from '../config/env';

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  // Normalize Multer file size limit errors
  if (err && (err.code === 'LIMIT_FILE_SIZE' || err.name === 'MulterError')) {
    err = new AppError(413, 'PAYLOAD_TOO_LARGE', err.message || 'File size limit exceeded (max 50MB)');
  }

  // Determine if this is a known AppError or an unexpected error
  const isAppError = err instanceof AppError;
  const isHttpError = err && typeof err.status === 'number' && err.status >= 400 && err.status < 600;

  const statusCode = isAppError ? err.statusCode : (isHttpError ? err.status : 500);
  const code = isAppError ? err.code : (statusCode === 413 ? 'PAYLOAD_TOO_LARGE' : 'INTERNAL_ERROR');
  const message = isAppError
    ? err.message
    : env.NODE_ENV === 'production'
      ? 'An unexpected error occurred'
      : (err as Error).message || 'An unexpected error occurred';

  // Log the error
  const logPayload = {
    requestId: req.id,
    statusCode,
    code,
    message: (err as Error).message,
    ...(statusCode >= 500 ? { stack: (err as Error).stack } : {}),
  };

  if (statusCode >= 500 || statusCode === 403 || statusCode === 401) {
    logger.error(logPayload, 'Unhandled or auth error');
  } else if (['RATE_LIMITED', 'INVALID_TOKEN', 'CONFLICT'].includes(code)) {
    logger.warn(logPayload, `Client error: ${code}`);
  }

  // Determine whether to include details
  let details: unknown = undefined;
  if (isAppError && err.details) {
    // Only show details for validation errors in production
    if (code === 'VALIDATION_ERROR' || env.NODE_ENV !== 'production') {
      details = err.details;
    }
  }

  res.status(statusCode).json({
    ok: false,
    error: {
      code,
      message,
      ...(details !== undefined ? { details } : {}),
    },
  });
};

// Not-found handler — registered before errorHandler
export const notFoundHandler: RequestHandler = (_req, _res, next) => {
  next(new AppError(404, 'NOT_FOUND', 'The requested resource was not found'));
};
