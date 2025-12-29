import dotenv from 'dotenv';
import { existsSync } from 'fs';
import { join } from 'path';

// Load environment variables
const envPath = join(process.cwd(), '.env');
if (existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

export interface Config {
  // Server Configuration
  port: number;
  nodeEnv: 'development' | 'production' | 'test';
  apiVersion: string;
  baseUrl: string;

  // Database Configuration
  database: {
    host: string;
    port: number;
    name: string;
    user: string;
    password: string;
    ssl: boolean;
    poolSize: number;
    connectionTimeout: number;
    maxConnections: number;
  };

  // Redis Configuration
  redis: {
    host: string;
    port: number;
    password?: string;
    tls: boolean;
    keyPrefix: string;
  };

  // JWT Configuration
  jwt: {
    secret: string;
    accessTokenExpiry: number; // seconds
    refreshTokenExpiry: number; // seconds
    issuer: string;
    audience: string;
  };

  // Security Configuration
  security: {
    corsOrigins: string[];
    rateLimit: {
      windowMs: number;
      maxRequests: number;
    };
    passwordPolicy: {
      minLength: number;
      requireUppercase: boolean;
      requireLowercase: boolean;
      requireNumbers: boolean;
      requireSpecialChars: boolean;
      maxAgeDays: number;
    };
  };

  // AWS Configuration (if using AWS services)
  aws?: {
    region: string;
    accessKeyId?: string;
    secretAccessKey?: string;
    s3Bucket: string;
    snsTopicArn?: string;
  };

  // Email Configuration
  email?: {
    provider: 'ses' | 'sendgrid' | 'smtp';
    fromAddress: string;
    apiKey?: string;
    smtp?: {
      host: string;
      port: number;
      secure: boolean;
      auth: {
        user: string;
        pass: string;
      };
    };
  };

  // Logging Configuration
  logging: {
    level: 'error' | 'warn' | 'info' | 'debug';
    format: 'json' | 'text';
    directory: string;
    maxFiles: number;
    maxSize: string;
  };

  // Feature Flags
  features: {
    enableMfa: boolean;
    enableAuditLogging: boolean;
    enableRateLimiting: boolean;
    enableComplianceChecks: boolean;
    enableWorkflowEngine: boolean;
  };
}

export class ConfigService {
  private static instance: ConfigService;
  private config: Config;

  private constructor() {
    this.config = this.loadConfig();
  }

  static getInstance(): ConfigService {
    if (!ConfigService.instance) {
      ConfigService.instance = new ConfigService();
    }
    return ConfigService.instance;
  }

  get<T = any>(key: string): T {
    const keys = key.split('.');
    let value: any = this.config;

    for (const k of keys) {
      if (value === undefined || value === null) {
        return undefined as T;
      }
      value = value[k];
    }

    return value as T;
  }

  getAll(): Config {
    return { ...this.config };
  }

  private loadConfig(): Config {
    return {
      // Server Configuration
      port: parseInt(process.env.PORT || '3000', 10),
      nodeEnv: (process.env.NODE_ENV as any) || 'development',
      apiVersion: process.env.API_VERSION || 'v1',
      baseUrl: process.env.BASE_URL || 'http://localhost:3000',

      // Database Configuration
      database: {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432', 10),
        name: process.env.DB_NAME || 'grantready',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || 'postgres',
        ssl: process.env.DB_SSL === 'true',
        poolSize: parseInt(process.env.DB_POOL_SIZE || '10', 10),
        connectionTimeout: parseInt(process.env.DB_CONNECTION_TIMEOUT || '5000', 10),
        maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS || '100', 10),
      },

      // Redis Configuration
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
        password: process.env.REDIS_PASSWORD,
        tls: process.env.REDIS_TLS === 'true',
        keyPrefix: process.env.REDIS_KEY_PREFIX || 'grantready:',
      },

      // JWT Configuration
      jwt: {
        secret: this.getRequiredEnv('JWT_SECRET'),
        accessTokenExpiry: parseInt(process.env.JWT_ACCESS_TOKEN_EXPIRY || '900', 10), // 15 minutes
        refreshTokenExpiry: parseInt(process.env.JWT_REFRESH_TOKEN_EXPIRY || '604800', 10), // 7 days
        issuer: process.env.JWT_ISSUER || 'grantready-cloud',
        audience: process.env.JWT_AUDIENCE || 'grantready-client',
      },

      // Security Configuration
      security: {
        corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:3000').split(','),
        rateLimit: {
          windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 minutes
          maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
        },
        passwordPolicy: {
          minLength: parseInt(process.env.PASSWORD_MIN_LENGTH || '12', 10),
          requireUppercase: process.env.PASSWORD_REQUIRE_UPPERCASE !== 'false',
          requireLowercase: process.env.PASSWORD_REQUIRE_LOWERCASE !== 'false',
          requireNumbers: process.env.PASSWORD_REQUIRE_NUMBERS !== 'false',
          requireSpecialChars: process.env.PASSWORD_REQUIRE_SPECIAL_CHARS !== 'false',
          maxAgeDays: parseInt(process.env.PASSWORD_MAX_AGE_DAYS || '90', 10),
        },
      },

      // AWS Configuration
      aws: process.env.AWS_REGION ? {
        region: process.env.AWS_REGION,
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        s3Bucket: process.env.AWS_S3_BUCKET || 'grantready-documents',
        snsTopicArn: process.env.AWS_SNS_TOPIC_ARN,
      } : undefined,

      // Email Configuration
      email: process.env.EMAIL_PROVIDER ? {
        provider: process.env.EMAIL_PROVIDER as any,
        fromAddress: process.env.EMAIL_FROM_ADDRESS || 'noreply@grantready.cloud',
        apiKey: process.env.EMAIL_API_KEY,
        smtp: process.env.SMTP_HOST ? {
          host: process.env.SMTP_HOST,
          port: parseInt(process.env.SMTP_PORT || '587', 10),
          secure: process.env.SMTP_SECURE === 'true',
          auth: {
            user: process.env.SMTP_USER || '',
            pass: process.env.SMTP_PASS || '',
          },
        } : undefined,
      } : undefined,

      // Logging Configuration
      logging: {
        level: (process.env.LOG_LEVEL as any) || 'info',
        format: (process.env.LOG_FORMAT as any) || 'json',
        directory: process.env.LOG_DIRECTORY || './logs',
        maxFiles: parseInt(process.env.LOG_MAX_FILES || '14', 10),
        maxSize: process.env.LOG_MAX_SIZE || '100m',
      },

      // Feature Flags
      features: {
        enableMfa: process.env.ENABLE_MFA !== 'false',
        enableAuditLogging: process.env.ENABLE_AUDIT_LOGGING !== 'false',
        enableRateLimiting: process.env.ENABLE_RATE_LIMITING !== 'false',
        enableComplianceChecks: process.env.ENABLE_COMPLIANCE_CHECKS !== 'false',
        enableWorkflowEngine: process.env.ENABLE_WORKFLOW_ENGINE !== 'false',
      },
    };
  }

  private getRequiredEnv(key: string): string {
    const value = process.env[key];
    if (!value) {
      throw new Error(`Environment variable ${key} is required`);
    }
    return value;
  }
}

export const config = ConfigService.getInstance();
