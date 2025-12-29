import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import { config } from './config';

export interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  service?: string;
  module?: string;
  correlationId?: string;
  userId?: string;
  organizationId?: string;
  duration?: number;
  [key: string]: any;
}

export class Logger {
  private static instance: Logger;
  private logger: winston.Logger;

  private constructor() {
    const loggingConfig = config.get('logging');
    const nodeEnv = config.get('nodeEnv');

    const transports: winston.transport[] = [];

    // Console transport for development
    if (nodeEnv !== 'production') {
      transports.push(
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
          ),
        })
      );
    }

    // File transport for all environments
    transports.push(
      new DailyRotateFile({
        dirname: loggingConfig.directory,
        filename: 'grantready-%DATE%.log',
        datePattern: 'YYYY-MM-DD',
        maxFiles: loggingConfig.maxFiles,
        maxSize: loggingConfig.maxSize,
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.json()
        ),
      })
    );

    // Error file transport
    transports.push(
      new DailyRotateFile({
        dirname: loggingConfig.directory,
        filename: 'error-%DATE%.log',
        datePattern: 'YYYY-MM-DD',
        maxFiles: loggingConfig.maxFiles,
        maxSize: loggingConfig.maxSize,
        level: 'error',
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.json()
        ),
      })
    );

    this.logger = winston.createLogger({
      level: loggingConfig.level,
      defaultMeta: {
        service: 'grantready-cloud',
        environment: nodeEnv,
      },
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      transports,
    });

    // Handle uncaught exceptions
    this.logger.exceptions.handle(
      new winston.transports.File({
        filename: `${loggingConfig.directory}/exceptions.log`,
      })
    );
  }

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  info(message: string, meta?: Record<string, any>): void {
    this.logger.info(message, meta);
  }

  error(message: string, meta?: Record<string, any>): void {
    this.logger.error(message, meta);
  }

  warn(message: string, meta?: Record<string, any>): void {
    this.logger.warn(message, meta);
  }

  debug(message: string, meta?: Record<string, any>): void {
    this.logger.debug(message, meta);
  }

  audit(event: string, details: Record<string, any>): void {
    this.logger.info(`AUDIT: ${event}`, {
      ...details,
      audit: true,
      timestamp: new Date().toISOString(),
    });
  }

  security(event: string, details: Record<string, any>): void {
    this.logger.warn(`SECURITY: ${event}`, {
      ...details,
      security: true,
      timestamp: new Date().toISOString(),
    });
  }

  performance(operation: string, duration: number, meta?: Record<string, any>): void {
    this.logger.info(`PERFORMANCE: ${operation}`, {
      ...meta,
      performance: true,
      duration,
      timestamp: new Date().toISOString(),
    });
  }

  withContext(context: Record<string, any>): {
    info: (message: string, meta?: Record<string, any>) => void;
    error: (message: string, meta?: Record<string, any>) => void;
    warn: (message: string, meta?: Record<string, any>) => void;
    debug: (message: string, meta?: Record<string, any>) => void;
  } {
    return {
      info: (message: string, meta?: Record<string, any>) =>
        this.info(message, { ...context, ...meta }),
      error: (message: string, meta?: Record<string, any>) =>
        this.error(message, { ...context, ...meta }),
      warn: (message: string, meta?: Record<string, any>) =>
        this.warn(message, { ...context, ...meta }),
      debug: (message: string, meta?: Record<string, any>) =>
        this.debug(message, { ...context, ...meta }),
    };
  }

  // Structured logging helpers
  logApiRequest(req: any, res: any, duration: number): void {
    this.info('API Request', {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration,
      userId: req.user?.id,
      ip: req.ip,
      userAgent: req.get('user-agent'),
      requestId: req.headers['x-request-id'],
      correlationId: req.headers['x-correlation-id'],
    });
  }

  logDatabaseQuery(query: string, duration: number, rowCount?: number): void {
    this.debug('Database Query', {
      query,
      duration,
      rowCount,
    });
  }

  logExternalServiceCall(service: string, operation: string, duration: number, success: boolean): void {
    this.info('External Service Call', {
      service,
      operation,
      duration,
      success,
    });
  }

  logBusinessEvent(event: string, entityType: string, entityId: string, userId?: string): void {
    this.info('Business Event', {
      event,
      entityType,
      entityId,
      userId,
    });
  }
}

export const logger = Logger.getInstance();
