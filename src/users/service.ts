import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import { prisma, redis } from '../config/database';
import { config } from '../config/middleware';
import { createError, Errors } from '../middleware/error';
import {
  CreateUserInput,
  UpdateUserInput,
  ChangePasswordInput,
  LoginInput,
  EnableMfaInput,
  UserResponse,
  UserWithRoles,
  LoginResponse,
} from './types';

const SALT_ROUNDS = 12;
const TOKEN_EXPIRY = {
  ACCESS: '24h',
  REFRESH: '7d',
  PASSWORD_RESET: '1h',
  MFA_SETUP: '10m',
};

export class UserService {
  // Create a new user
  async createUser(data: CreateUserInput): Promise<UserResponse> {
    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existingUser) {
      throw Errors.CONFLICT('User with this email already exists');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(data.password, SALT_ROUNDS);

    // Create user
    const user = await prisma.user.create({
      data: {
        email: data.email,
        passwordHash,
        firstName: data.firstName,
        lastName: data.lastName,
        title: data.title,
        department: data.department,
        phone: data.phone,
        avatarUrl: data.avatarUrl,
      },
    });

    // Assign default role if configured
    if (process.env.DEFAULT_ROLE_ID) {
      await prisma.roleAssignment.create({
        data: {
          userId: user.id,
          roleId: process.env.DEFAULT_ROLE_ID,
        },
      });
    }

    return this.formatUserResponse(user);
  }

  // Get user by ID
  async getUserById(id: string, includeRoles: boolean = false): Promise<UserResponse | UserWithRoles> {
    const user = await prisma.user.findUnique({
      where: { id },
      include: includeRoles ? {
        roleAssignments: {
          include: {
            role: true,
          },
        },
      } : undefined,
    });

    if (!user) {
      throw Errors.NOT_FOUND('User');
    }

    const formattedUser = this.formatUserResponse(user);

    if (includeRoles) {
      const roles = user.roleAssignments.map(ra => ({
        id: ra.role.id,
        name: ra.role.name,
        description: ra.role.description,
        permissions: Array.isArray(ra.role.permissions) ? ra.role.permissions : [],
      }));

      return {
        ...formattedUser,
        roles,
      };
    }

    return formattedUser;
  }

  // Update user
  async updateUser(userId: string, data: UpdateUserInput): Promise<UserResponse> {
    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        firstName: data.firstName,
        lastName: data.lastName,
        title: data.title,
        department: data.department,
        phone: data.phone,
        avatarUrl: data.avatarUrl,
      },
    });

    return this.formatUserResponse(user);
  }

  // Change password
  async changePassword(userId: string, data: ChangePasswordInput): Promise<void> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { passwordHash: true },
    });

    if (!user) {
      throw Errors.NOT_FOUND('User');
    }

    // Verify current password
    const isValid = await bcrypt.compare(data.currentPassword, user.passwordHash!);
    if (!isValid) {
      throw Errors.BAD_REQUEST('Current password is incorrect');
    }

    // Hash new password
    const newPasswordHash = await bcrypt.hash(data.newPassword, SALT_ROUNDS);

    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newPasswordHash },
    });
  }

  // Login
  async login(data: LoginInput): Promise<LoginResponse> {
    const user = await prisma.user.findUnique({
      where: { email: data.email },
      include: {
        roleAssignments: {
          include: {
            role: true,
          },
        },
      },
    });

    if (!user) {
      throw Errors.UNAUTHORIZED();
    }

    // Check if account is locked
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw createError('Account is temporarily locked', 423, {
        lockedUntil: user.lockedUntil,
      });
    }

    // Verify password
    const isValid = await bcrypt.compare(data.password, user.passwordHash!);
    if (!isValid) {
      // Increment failed login attempts
      await this.recordFailedLogin(user.id);
      throw Errors.UNAUTHORIZED();
    }

    // Reset failed login attempts on successful login
    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLogins: 0,
        lockedUntil: null,
        lastLoginAt: new Date(),
      },
    });

    const formattedUser = this.formatUserResponse(user);

    // Check if MFA is required
    if (user.mfaEnabled && config.security.enableMfa) {
      if (!data.mfaCode) {
        // Return MFA token for verification
        const mfaToken = this.generateMfaToken(user.id);
        return {
          user: formattedUser,
          token: '',
          requiresMfa: true,
          mfaToken,
        };
      }

      // Verify MFA code
      const isValidMfa = speakeasy.totp.verify({
        secret: user.mfaSecret!,
        encoding: 'base32',
        token: data.mfaCode,
        window: 1,
      });

      if (!isValidMfa) {
        throw Errors.UNAUTHORIZED();
      }
    }

    // Generate JWT token
    const token = this.generateAuthToken(user);

    return {
      user: formattedUser,
      token,
      requiresMfa: false,
    };
  }

  // Generate MFA setup
  async generateMfaSetup(userId: string): Promise<{ secret: string; qrCode: string }> {
    const secret = speakeasy.generateSecret({
      name: `GrantReady Hub (${userId})`,
    });

    // Generate QR code
    const qrCode = await QRCode.toDataURL(secret.otpauth_url!);

    // Store secret temporarily (will be saved after verification)
    const tempToken = crypto.randomBytes(32).toString('hex');
    await redis.setEx(
      `mfa:setup:${tempToken}`,
      600, // 10 minutes
      JSON.stringify({ userId, secret: secret.base32 })
    );

    return {
      secret: secret.base32,
      qrCode,
    };
  }

  // Enable MFA
  async enableMfa(data: EnableMfaInput): Promise<void> {
    const tempData = await redis.get(`mfa:setup:${data.token}`);
    if (!tempData) {
      throw Errors.BAD_REQUEST('Invalid or expired setup token');
    }

    const { userId, secret } = JSON.parse(tempData);

    // Verify the code
    const isValid = speakeasy.totp.verify({
      secret,
      encoding: 'base32',
      token: data.code,
      window: 1,
    });

    if (!isValid) {
      throw Errors.BAD_REQUEST('Invalid verification code');
    }

    // Enable MFA for user
    await prisma.user.update({
      where: { id: userId },
      data: {
        mfaEnabled: true,
        mfaSecret: secret,
      },
    });

    // Clean up temp data
    await redis.del(`mfa:setup:${data.token}`);
  }

  // Disable MFA
  async disableMfa(userId: string): Promise<void> {
    await prisma.user.update({
      where: { id: userId },
      data: {
        mfaEnabled: false,
        mfaSecret: null,
      },
    });
  }

  // Private helper methods
  private formatUserResponse(user: any): UserResponse {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      title: user.title,
      department: user.department,
      phone: user.phone,
      avatarUrl: user.avatarUrl,
      emailVerified: user.emailVerified,
      mfaEnabled: user.mfaEnabled,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  private generateAuthToken(user: any): string {
    const roles = user.roleAssignments.map((ra: any) => ra.role.name);
    const permissions = user.roleAssignments.flatMap((ra: any) => 
      Array.isArray(ra.role.permissions) ? ra.role.permissions : []
    );

    const payload = {
      userId: user.id,
      sessionId: crypto.randomBytes(16).toString('hex'),
      email: user.email,
      roles,
      permissions: [...new Set(permissions)],
    };

    return jwt.sign(payload, config.jwtSecret, {
      expiresIn: TOKEN_EXPIRY.ACCESS,
    });
  }

  private generateMfaToken(userId: string): string {
    return jwt.sign(
      { userId, purpose: 'mfa_verification' },
      config.jwtSecret,
      { expiresIn: '5m' }
    );
  }

  private async recordFailedLogin(userId: string): Promise<void> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { failedLogins: true },
    });

    if (!user) return;

    const newFailedCount = user.failedLogins + 1;
    let lockedUntil = null;

    // Lock account after 5 failed attempts
    if (newFailedCount >= 5) {
      lockedUntil = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
    }

    await prisma.user.update({
      where: { id: userId },
      data: {
        failedLogins: newFailedCount,
        lockedUntil,
      },
    });
  }
}

export const userService = new UserService();
