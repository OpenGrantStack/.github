import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const configSchema = z.object({
  nodeEnv: z.enum(['development', 'test', 'production']).default('development'),
  port: z.string().transform(Number).default('3000'),
  databaseUrl: z.string().url(),
  redisUrl: z.string().url(),
  jwtSecret: z.string().min(32),
  encryptionKey: z.string().length(32),
  cors: z.object({
    origin: z.string().transform(str => str.split(',')),
  }),
  rateLimit: z.object({
    window: z.string().transform(Number).default('900000'),
    max: z.string().transform(Number).default('100'),
  }),
  session: z.object({
    secret: z.string().min(32),
    maxAge: z.string().transform(Number).default('86400000'),
  }),
  security: z.object({
    enableMfa: z.string().transform(val => val === 'true').default('true'),
    enableAuditLogs: z.string().transform(val => val === 'true').default('true'),
    passwordPolicy: z.object({
      minLength: z.number().default(12),
      requireUppercase: z.boolean().default(true),
      requireLowercase: z.boolean().default(true),
      requireNumbers: z.boolean().default(true),
      requireSpecialChars: z.boolean().default(true),
    }),
  }),
});

const rawConfig = {
  nodeEnv: process.env.NODE_ENV,
  port: process.env.PORT,
  databaseUrl: process.env.DATABASE_URL,
  redisUrl: process.env.REDIS_URL,
  jwtSecret: process.env.JWT_SECRET,
  encryptionKey: process.env.ENCRYPTION_KEY,
  cors: {
    origin: process.env.CORS_ORIGIN,
  },
  rateLimit: {
    window: process.env.RATE_LIMIT_WINDOW,
    max: process.env.RATE_LIMIT_MAX,
  },
  session: {
    secret: process.env.SESSION_SECRET,
    maxAge: process.env.SESSION_MAX_AGE,
  },
  security: {
    enableMfa: process.env.ENABLE_MFA,
    enableAuditLogs: process.env.ENABLE_AUDIT_LOGS,
    passwordPolicy: {
      minLength: 12,
      requireUppercase: true,
      requireLowercase: true,
      requireNumbers: true,
      requireSpecialChars: true,
    },
  },
};

const config = configSchema.parse(rawConfig);

export { config };
