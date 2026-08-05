import pino from 'pino';
import { env } from '../config/env';

const level = env.LOG_LEVEL ?? (env.NODE_ENV === 'production' ? 'info' : 'debug');

export const logger = pino({
  level,
  redact: {
    paths: ['req.headers.authorization', 'req.headers.cookie', 'res.headers["set-cookie"]'],
    censor: '[REDACTED]',
  },
  transport:
    env.NODE_ENV !== 'production'
      ? { target: 'pino/file', options: { destination: 1 } }
      : undefined,
  serializers: {
    ...pino.stdSerializers,
  },
});
