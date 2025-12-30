import { prisma } from '../config/database';
import { createError, Errors } from '../middleware/error';
import {
  CreateRoleInput,
  UpdateRoleInput,
  AssignRoleInput,
  RoleResponse,
  RoleWithUsers,
  UserRoleAssignment,
  CommonPermissions,
} from './types';

export class RoleService {
  // Create a new role
  async createRole(data: CreateRoleInput): Promise<RoleResponse> {
    // Check if role already exists
    const existingRole = await prisma.role.findUnique({
      where: { name: data.name },
    });

    if (existingRole) {
      throw Errors.CONFLICT('Role with this name already exists');
    }

    // Validate permissions (could add more validation here)
    const validatedPermissions = this.validatePermissions(data.permissions);

    const role = await prisma.role.create({
      data: {
        name: data.name,
        description: data.description,
        level: data.level || 0,
        permissions: validatedPermissions,
      },
    });

    return this.formatRoleResponse(role);
  }

  // Get all roles
  async getRoles(includeUsers: boolean = false): Promise<RoleResponse[] | RoleWithUsers[]> {
    const roles = await prisma.role.findMany({
      include: includeUsers ? {
        assignments: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      } : undefined,
      orderBy: { level: 'desc' },
    });

    return roles.map(role => this.formatRoleResponse(role, includeUsers));
  }

  // Get role by ID
  async getRoleById(id: string, includeUsers: boolean = false): Promise<RoleResponse | RoleWithUsers> {
    const role = await prisma.role.findUnique({
      where: { id },
      include: includeUsers ? {
        assignments: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      } : undefined,
    });

    if (!role) {
      throw Errors.NOT_FOUND('Role');
    }

    return this.formatRoleResponse(role, includeUsers);
  }

  // Update role
  async updateRole(id: string, data: UpdateRoleInput): Promise<RoleResponse> {
    // Check if role exists and is not a system role
    const existingRole = await prisma.role.findUnique({
      where: { id },
    });

    if (!existingRole) {
      throw Errors.NOT_FOUND('Role');
    }

    if (existingRole.isSystem) {
      throw createError('Cannot modify system roles', 403);
    }

    // Check name uniqueness if changing name
    if (data.name && data.name !== existingRole.name) {
      const duplicate = await prisma.role.findUnique({
        where: { name: data.name },
      });
      
      if (duplicate) {
        throw Errors.CONFLICT('Role with this name already exists');
      }
    }

    // Validate permissions if updating
    if (data.permissions) {
      data.permissions = this.validatePermissions(data.permissions);
    }

    const role = await prisma.role.update({
      where: { id },
      data: {
        name: data.name,
        description: data.description,
        level: data.level,
        permissions: data.permissions,
      },
    });

    return this.formatRoleResponse(role);
  }

  // Delete role
  async deleteRole(id: string): Promise<void> {
    // Check if role exists and is not a system role
    const existingRole = await prisma.role.findUnique({
      where: { id },
      include: { assignments: true },
    });

    if (!existingRole) {
      throw Errors.NOT_FOUND('Role');
    }

    if (existingRole.isSystem) {
      throw createError('Cannot delete system roles', 403);
    }

    if (existingRole.assignments.length > 0) {
      throw createError('Cannot delete role with active assignments', 400);
    }

    await prisma.role.delete({
      where: { id },
    });
  }

  // Assign role to user
  async assignRole(data: AssignRoleInput, assignedBy: string): Promise<void> {
    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { id: data.userId },
    });

    if (!user) {
      throw Errors.NOT_FOUND('User');
    }

    // Check if role exists
    const role = await prisma.role.findUnique({
      where: { id: data.roleId },
    });

    if (!role) {
      throw Errors.NOT_FOUND('Role');
    }

    // Check for existing assignment
    const existingAssignment = await prisma.roleAssignment.findUnique({
      where: {
        userId_roleId: {
          userId: data.userId,
          roleId: data.roleId,
        },
      },
    });

    if (existingAssignment) {
      throw Errors.CONFLICT('Role already assigned to user');
    }

    // Create assignment
    await prisma.roleAssignment.create({
      data: {
        userId: data.userId,
        roleId: data.roleId,
        scope: data.scope,
        expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
        assignedBy,
      },
    });
  }

  // Remove role from user
  async removeRole(userId: string, roleId: string): Promise<void> {
    const assignment = await prisma.roleAssignment.findUnique({
      where: {
        userId_roleId: {
          userId,
          roleId,
        },
      },
    });

    if (!assignment) {
      throw Errors.NOT_FOUND('Role assignment');
    }

    await prisma.roleAssignment.delete({
      where: {
        userId_roleId: {
          userId,
          roleId,
        },
      },
    });
  }

  // Get user's roles
  async getUserRoles(userId: string): Promise<UserRoleAssignment[]> {
    const assignments = await prisma.roleAssignment.findMany({
      where: { userId },
      include: {
        role: true,
      },
      orderBy: { assignedAt: 'desc' },
    });

    return assignments.map(assignment => ({
      id: assignment.id,
      role: this.formatRoleResponse(assignment.role),
      assignedAt: assignment.assignedAt,
      assignedBy: assignment.assignedBy,
      scope: assignment.scope as Record<string, any>,
      expiresAt: assignment.expiresAt,
    }));
  }

  // Private helper methods
  private validatePermissions(permissions: string[]): string[] {
    // Remove duplicates
    const uniquePermissions = [...new Set(permissions)];
    
    // Validate against known permissions (optional)
    // This could be expanded to check against a registry of valid permissions
    
    return uniquePermissions;
  }

  private formatRoleResponse(role: any, includeUsers: boolean = false): RoleResponse | RoleWithUsers {
    const baseResponse: RoleResponse = {
      id: role.id,
      name: role.name,
      description: role.description,
      level: role.level,
      permissions: Array.isArray(role.permissions) ? role.permissions : [],
      isSystem: role.isSystem,
      userCount: role.assignments?.length || 0,
      createdAt: role.createdAt,
      updatedAt: role.updatedAt,
    };

    if (!includeUsers) {
      return baseResponse;
    }

    const users = (role.assignments || []).map((assignment: any) => ({
      id: assignment.user.id,
      email: assignment.user.email,
      firstName: assignment.user.firstName,
      lastName: assignment.user.lastName,
      assignedAt: assignment.assignedAt,
      assignedBy: assignment.assignedBy,
      expiresAt: assignment.expiresAt,
    }));

    return {
      ...baseResponse,
      users,
    };
  }

  // System role initialization
  async initializeSystemRoles(): Promise<void> {
    const systemRoles = [
      {
        name: 'Super Administrator',
        description: 'Full system access',
        level: 1000,
        isSystem: true,
        permissions: Object.values(CommonPermissions),
      },
      {
        name: 'Administrator',
        description: 'Administrative access',
        level: 900,
        isSystem: true,
        permissions: [
          CommonPermissions.USERS_READ,
          CommonPermissions.USERS_WRITE,
          CommonPermissions.ROLES_READ,
          CommonPermissions.ROLES_WRITE,
          CommonPermissions.APPROVALS_READ,
          CommonPermissions.APPROVALS_WRITE,
          CommonPermissions.ACTIVITY_READ,
          CommonPermissions.SETTINGS_READ,
        ],
      },
      {
        name: 'Approver',
        description: 'Grant approval authority',
        level: 500,
        isSystem: true,
        permissions: [
          CommonPermissions.APPROVALS_READ,
          CommonPermissions.APPROVALS_REVIEW,
          CommonPermissions.APPROVALS_APPROVE,
          CommonPermissions.APPROVALS_REJECT,
        ],
      },
      {
        name: 'Viewer',
        description: 'Read-only access',
        level: 100,
        isSystem: true,
        permissions: [
          CommonPermissions.APPROVALS_READ,
          CommonPermissions.ACTIVITY_READ,
        ],
      },
    ];

    for (const roleData of systemRoles) {
      const existing = await prisma.role.findUnique({
        where: { name: roleData.name },
      });

      if (!existing) {
        await prisma.role.create({
          data: roleData,
        });
      }
    }
  }
}

export const roleService = new RoleService();
