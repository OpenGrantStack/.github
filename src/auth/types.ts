export interface User {
  id: string;
  email: string;
  name?: string;
  roles: string[];
  organizationId?: string;
  status: 'active' | 'suspended' | 'pending';
  lastLogin?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface Organization {
  id: string;
  name: string;
  type: 'government' | 'nonprofit' | 'educational' | 'commercial';
  taxId?: string;
  address?: Address;
  status: 'active' | 'inactive' | 'pending_verification';
  createdAt: Date;
  updatedAt: Date;
}

export interface Address {
  street: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

export interface Permission {
  id: string;
  resource: string;
  action: 'create' | 'read' | 'update' | 'delete' | 'approve';
  conditions?: Record<string, any>;
}

export interface Role {
  id: string;
  name: string;
  description: string;
  permissions: Permission[];
  isSystemRole: boolean;
}

export interface Session {
  id: string;
  userId: string;
  deviceId?: string;
  ipAddress: string;
  userAgent: string;
  issuedAt: Date;
  expiresAt: Date;
  lastActivity: Date;
  isRevoked: boolean;
}

export interface AuthEvent {
  id: string;
  userId?: string;
  email?: string;
  eventType: 'login' | 'logout' | 'token_refresh' | 'password_change';
  status: 'success' | 'failure';
  ipAddress: string;
  userAgent?: string;
  deviceId?: string;
  details?: Record<string, any>;
  timestamp: Date;
}

export interface TokenBlacklist {
  tokenHash: string;
  expiresAt: Date;
  reason?: string;
  createdAt: Date;
}

export interface RateLimitRule {
  key: string;
  windowMs: number;
  maxRequests: number;
  currentCount: number;
  resetTime: Date;
}

export interface SecurityConfig {
  passwordPolicy: {
    minLength: number;
    requireUppercase: boolean;
    requireLowercase: boolean;
    requireNumbers: boolean;
    requireSpecialChars: boolean;
    maxAgeDays: number;
  };
  sessionPolicy: {
    maxConcurrentSessions: number;
    idleTimeoutMinutes: number;
    absoluteTimeoutMinutes: number;
  };
  mfaPolicy: {
    enabled: boolean;
    requiredRoles: string[];
    methods: ('totp' | 'sms' | 'email' | 'webauthn')[];
  };
}

  


