import { z } from 'zod';

// Permission categories
export const PermissionCategories = {
  USER_MANAGEMENT: 'users',
  ROLE_MANAGEMENT: 'roles',
  APPROVAL_WORKFLOWS: 'approvals',
  ACTIVITY_LOGS: 'activity',
  SYSTEM_SETTINGS: 'settings',
} as const;

// Common permissions
export const CommonPermissions = {
  // User management
  USERS_READ: 'users:read',
  USERS_WRITE: 'users:write',
  USERS_DELETE: 'users:delete',
  
  // Role management
  ROLES_READ: 'roles:read',
  ROLES_WRITE: 'roles:write',
  ROLES_DELETE: 'roles:delete',
  ROLES_ASSIGN: 'roles:assign',
  
  // Approval workflows
  APPROVALS_READ: 'approvals:read',
  APPROVALS_WRITE: 'approvals:write',
  APPROVALS_DELETE: 'approvals:delete',
  APPROVALS_REVIEW: 'approvals:review',
  APPROVALS_APPROVE: 'approvals:approve',
  APPROVALS_REJECT: 'approvals:reject',
  
  // Activity logs
  ACTIVITY_READ: 'activity:read',
  ACTIVITY_EXPORT: 'activity:export',
  
  // System settings
  SETTINGS_READ: 'settings:read',
  SETTINGS_WRITE: 'settings:write',
} as const;

// Role schemas
export const CreateRoleSchema = z.object({
  name: z.string().min(3).max(50),
  description: z.string().max(500).optional(),
  level: z.number().int().min(0).max(1000).optional(),
  permissions: z.array(z.string()),
});

export const UpdateRoleSchema = z.object({
  name: z.string().min(3).max(50).optional(),
  description: z.string().max(500).optional(),
  level: z.number().int().min(0).max(1000).optional(),
  permissions: z.array(z.string()).optional(),
});

export const AssignRoleSchema = z.object({
  userId: z.string().uuid(),
  roleId: z.string().uuid(),
  scope: z.record(z.any()).optional(),
  expiresAt: z.string().datetime().optional(),
});

// Role types
export type CreateRoleInput = z.infer<typeof CreateRoleSchema>;
export type UpdateRoleInput = z.infer<typeof UpdateRoleSchema>;
export type AssignRoleInput = z.infer<typeof AssignRoleSchema>;

export interface RoleResponse {
  id: string;
  name: string;
  description?: string;
  level: number;
  permissions: string[];
  isSystem: boolean;
  userCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface RoleWithUsers extends RoleResponse {
  users: Array<{
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    assignedAt: Date;
    assignedBy?: string;
    expiresAt?: Date;
  }>;
}

export interface UserRoleAssignment {
  id: string;
  role: RoleResponse;
  assignedAt: Date;
  assignedBy?: string;
  scope?: Record<string, any>;
  expiresAt?: Date;
}
