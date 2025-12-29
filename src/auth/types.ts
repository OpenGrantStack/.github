import { Request, Response, NextFunction } from 'express';
import { AuthService } from './service';
import { logger } from '../shared/logging';

const authService = new AuthService();

export interface AuthenticatedRequest extends Request {
  user?: any;
  session?: any;
}

export function authMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Authentication required',
      code: 'AUTH_REQUIRED',
    });
  }

  const token = authHeader.substring(7);

  try {
    const session = authService.verifyToken(token);
    req.user = { id: session.userId, email: session.email };
    req.session = session;
    next();
  } catch (error) {
    logger.warn('Authentication failed', {
      ip: req.ip,
      path: req.path,
      error: error.message,
    });

    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid or expired token',
      code: 'INVALID_TOKEN',
    });
  }
}

export function requireRole(roles: string | string[]) {
  const requiredRoles = Array.isArray(roles) ? roles : [roles];

  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.session) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required',
        code: 'AUTH_REQUIRED',
      });
    }

    try {
      const hasRole = await authService.validateRoles(
        req.session.userId,
        requiredRoles
      );

      if (!hasRole) {
        logger.warn('Insufficient permissions', {
          userId: req.session.userId,
          requiredRoles,
          actualRoles: req.session.roles,
          path: req.path,
        });

        return res.status(403).json({
          error: 'Forbidden',
          message: 'Insufficient permissions',
          code: 'INSUFFICIENT_PERMISSIONS',
        });
      }

      next();
    } catch (error) {
      logger.error('Role validation failed', { error });
      return res.status(500).json({
        error: 'Internal Server Error',
        message: 'Unable to validate permissions',
        code: 'ROLE_VALIDATION_ERROR',
      });
    }
  };
}

export function rateLimitMiddleware(options: {
  windowMs: number;
  maxRequests: number;
  keyGenerator?: (req: Request) => string;
}) {
  const { windowMs, maxRequests, keyGenerator } = options;

  return (req: Request, res: Response, next: NextFunction) => {
    // Rate limiting implementation
    // Could use Redis for distributed rate limiting
    next();
  };
}

export function auditMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const startTime = Date.now();

  // Capture response data
  const originalSend = res.send;
  res.send = function(body: any) {
    const duration = Date.now() - startTime;

    // Log audit entry
    logger.info('API Request', {
      timestamp: new Date().toISOString(),
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration,
      userId: req.user?.id,
      ip: req.ip,
      userAgent: req.get('user-agent'),
      requestId: req.headers['x-request-id'],
    });

    return originalSend.call(this, body);
  };

  next();
}
