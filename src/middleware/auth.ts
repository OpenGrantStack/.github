import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../config/database';

interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    roles: string[];
    permissions: string[];
  };
}

export const authMiddleware = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];
    const secret = process.env.JWT_SECRET;

    if (!secret) {
      throw new Error('JWT secret not configured');
    }

    // Verify token
    const decoded = jwt.verify(token, secret) as {
      userId: string;
      sessionId: string;
    };

    // Check if session is valid (optional, for enhanced security)
    const session = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        lockedUntil: true,
        roleAssignments: {
          include: {
            role: true,
          },
        },
      },
    });

    if (!session) {
      return res.status(401).json({ error: 'User not found' });
    }

    // Check if account is locked
    if (session.lockedUntil && session.lockedUntil > new Date()) {
      return res.status(423).json({ error: 'Account is locked' });
    }

    // Extract roles and permissions
    const roles = session.roleAssignments.map(ra => ra.role.name);
    const permissions = session.roleAssignments.flatMap(ra => 
      Array.isArray(ra.role.permissions) ? ra.role.permissions : []
    );

    req.user = {
      id: session.id,
      email: session.email,
      roles,
      permissions: [...new Set(permissions)], // Remove duplicates
    };

    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      return res.status(401).json({ error: 'Invalid token' });
    }
    
    console.error('Auth middleware error:', error);
    return res.status(500).json({ error: 'Authentication failed' });
  }
};

// Role-based authorization middleware
export const requireRole = (...requiredRoles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const hasRole = requiredRoles.some(role => req.user!.roles.includes(role));
    
    if (!hasRole) {
      return res.status(403).json({ 
        error: 'Insufficient permissions',
        required: requiredRoles,
        actual: req.user.roles,
      });
    }

    next();
  };
};

// Permission-based authorization middleware
export const requirePermission = (...requiredPermissions: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const hasPermission = requiredPermissions.every(permission => 
      req.user!.permissions.includes(permission)
    );
    
    if (!hasPermission) {
      return res.status(403).json({ 
        error: 'Insufficient permissions',
        required: requiredPermissions,
        actual: req.user.permissions,
      });
    }

    next();
  };
};

// Multi-factor authentication check
export const requireMfa = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  // Check MFA status from session or token claims
  const mfaVerified = req.headers['x-mfa-verified'] === 'true';
  
  if (!mfaVerified && process.env.ENABLE_MFA === 'true') {
    return res.status(403).json({ 
      error: 'Multi-factor authentication required',
      code: 'MFA_REQUIRED',
    });
  }

  next();
};

// Export types for use in controllers
export type { AuthRequest };
