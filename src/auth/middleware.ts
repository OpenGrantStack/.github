import { createHash, randomBytes, timingSafeEqual } from 'crypto';
import { sign, verify } from 'jsonwebtoken';
import { config } from '../shared/config';
import { logger } from '../shared/logging';

export interface UserCredentials {
  email: string;
  password: string;
  deviceId?: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: string;
}

export interface UserSession {
  userId: string;
  email: string;
  roles: string[];
  organizationId?: string;
  deviceId?: string;
  issuedAt: Date;
  expiresAt: Date;
}

export class AuthService {
  private readonly jwtSecret: string;
  private readonly tokenExpiry = 15 * 60; // 15 minutes
  private readonly refreshTokenExpiry = 7 * 24 * 60 * 60; // 7 days

  constructor() {
    this.jwtSecret = config.get('JWT_SECRET');
    if (!this.jwtSecret || this.jwtSecret.length < 32) {
      throw new Error('JWT_SECRET must be at least 32 characters');
    }
  }

  async authenticate(credentials: UserCredentials): Promise<AuthTokens> {
    try {
      const user = await this.validateCredentials(
        credentials.email,
        credentials.password
      );

      if (!user) {
        throw new Error('Invalid credentials');
      }

      // Check if user account is active
      if (user.status !== 'active') {
        throw new Error('Account is not active');
      }

      // Check for suspicious login patterns
      await this.checkLoginPatterns(user.id, credentials.deviceId);

      // Generate tokens
      const session: UserSession = {
        userId: user.id,
        email: user.email,
        roles: user.roles,
        organizationId: user.organizationId,
        deviceId: credentials.deviceId,
        issuedAt: new Date(),
        expiresAt: new Date(Date.now() + this.tokenExpiry * 1000),
      };

      const accessToken = this.generateAccessToken(session);
      const refreshToken = this.generateRefreshToken(user.id);

      // Log successful authentication
      await this.logAuthentication(user.id, 'success', credentials.deviceId);

      return {
        accessToken,
        refreshToken,
        expiresIn: this.tokenExpiry,
        tokenType: 'Bearer',
      };
    } catch (error) {
      // Log failed authentication
      await this.logAuthentication(credentials.email, 'failure', credentials.deviceId);
      throw error;
    }
  }

  async refreshToken(refreshToken: string): Promise<AuthTokens> {
    try {
      const payload = this.verifyRefreshToken(refreshToken);
      const user = await this.getUserById(payload.userId);

      if (!user) {
        throw new Error('User not found');
      }

      if (user.status !== 'active') {
        throw new Error('Account is not active');
      }

      // Check if refresh token is revoked
      const isRevoked = await this.isTokenRevoked(refreshToken);
      if (isRevoked) {
        throw new Error('Refresh token revoked');
      }

      // Generate new tokens
      const session: UserSession = {
        userId: user.id,
        email: user.email,
        roles: user.roles,
        organizationId: user.organizationId,
        issuedAt: new Date(),
        expiresAt: new Date(Date.now() + this.tokenExpiry * 1000),
      };

      const newAccessToken = this.generateAccessToken(session);
      const newRefreshToken = this.generateRefreshToken(user.id);

      // Revoke old refresh token
      await this.revokeToken(refreshToken);

      return {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        expiresIn: this.tokenExpiry,
        tokenType: 'Bearer',
      };
    } catch (error) {
      logger.error('Token refresh failed', { error });
      throw new Error('Invalid refresh token');
    }
  }

  async logout(accessToken: string, refreshToken?: string): Promise<void> {
    try {
      // Add access token to blacklist
      const payload = this.verifyToken(accessToken, false);
      const ttl = Math.floor((payload.exp * 1000 - Date.now()) / 1000);
      
      if (ttl > 0) {
        await this.blacklistToken(accessToken, ttl);
      }

      // Revoke refresh token if provided
      if (refreshToken) {
        await this.revokeToken(refreshToken);
      }

      // Log logout event
      await this.logLogout(payload.userId);
    } catch (error) {
      logger.warn('Logout cleanup failed', { error });
    }
  }

  verifyToken(token: string, checkBlacklist = true): UserSession {
    try {
      const payload = verify(token, this.jwtSecret) as any;

      const session: UserSession = {
        userId: payload.sub,
        email: payload.email,
        roles: payload.roles || [],
        organizationId: payload.org,
        deviceId: payload.deviceId,
        issuedAt: new Date(payload.iat * 1000),
        expiresAt: new Date(payload.exp * 1000),
      };

      // Check if token is blacklisted
      if (checkBlacklist) {
        const isBlacklisted = this.isTokenBlacklisted(token);
        if (isBlacklisted) {
          throw new Error('Token is blacklisted');
        }
      }

      return session;
    } catch (error) {
      logger.error('Token verification failed', { error });
      throw new Error('Invalid token');
    }
  }

  async validateRoles(userId: string, requiredRoles: string[]): Promise<boolean> {
    const user = await this.getUserById(userId);
    if (!user) return false;

    return requiredRoles.some(role => user.roles.includes(role));
  }

  private generateAccessToken(session: UserSession): string {
    const payload = {
      sub: session.userId,
      email: session.email,
      roles: session.roles,
      org: session.organizationId,
      deviceId: session.deviceId,
      iat: Math.floor(session.issuedAt.getTime() / 1000),
      exp: Math.floor(session.expiresAt.getTime() / 1000),
    };

    return sign(payload, this.jwtSecret, { algorithm: 'HS256' });
  }

  private generateRefreshToken(userId: string): string {
    const token = randomBytes(32).toString('hex');
    const hash = createHash('sha256').update(token).digest('hex');

    // Store hash in database
    this.storeRefreshToken(userId, hash);

    return token;
  }

  private verifyRefreshToken(token: string): { userId: string } {
    const hash = createHash('sha256').update(token).digest('hex');
    const storedToken = this.getStoredRefreshToken(hash);

    if (!storedToken) {
      throw new Error('Invalid refresh token');
    }

    if (storedToken.expiresAt < new Date()) {
      throw new Error('Refresh token expired');
    }

    return { userId: storedToken.userId };
  }

  // Database methods (implement based on your ORM)
  private async validateCredentials(email: string, password: string): Promise<any> {
    // Implementation depends on your database/ORM
    // This should:
    // 1. Find user by email
    // 2. Verify password hash
    // 3. Return user object with id, email, roles, status, organizationId
    throw new Error('Not implemented');
  }

  private async getUserById(userId: string): Promise<any> {
    // Implementation depends on your database/ORM
    throw new Error('Not implemented');
  }

  private async checkLoginPatterns(userId: string, deviceId?: string): Promise<void> {
    // Check for suspicious login patterns:
    // - Multiple failed attempts
    // - Unusual location
    // - New device
    // Implement based on your security requirements
  }

  private async logAuthentication(identifier: string, status: 'success' | 'failure', deviceId?: string): Promise<void> {
    // Log authentication attempt for audit trail
  }

  private async logLogout(userId: string): Promise<void> {
    // Log logout event
  }

  private async storeRefreshToken(userId: string, tokenHash: string): Promise<void> {
    // Store refresh token hash in database with expiry
  }

  private async getStoredRefreshToken(tokenHash: string): Promise<any> {
    // Retrieve refresh token from database
    throw new Error('Not implemented');
  }

  private async isTokenRevoked(tokenHash: string): Promise<boolean> {
    // Check if token is in revocation list
    return false;
  }

  private async revokeToken(token: string): Promise<void> {
    const hash = createHash('sha256').update(token).digest('hex');
    // Add to revocation list
  }

  private async blacklistToken(token: string, ttl: number): Promise<void> {
    // Add to Redis blacklist with TTL
  }

  private async isTokenBlacklisted(token: string): Promise<boolean> {
    // Check Redis blacklist
    return false;
  }
}
