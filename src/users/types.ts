import { z } from 'zod';

// User schemas
export const CreateUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(12),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  title: z.string().optional(),
  department: z.string().optional(),
  phone: z.string().optional(),
  avatarUrl: z.string().url().optional(),
});

export const UpdateUserSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  title: z.string().optional(),
  department: z.string().optional(),
  phone: z.string().optional(),
  avatarUrl: z.string().url().optional(),
});

export const ChangePasswordSchema = z.object({
  currentPassword: z.string(),
  newPassword: z.string().min(12),
});

export const ResetPasswordSchema = z.object({
  token: z.string(),
  newPassword: z.string().min(12),
});

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
  mfaCode: z.string().optional(),
});

export const EnableMfaSchema = z.object({
  token: z.string(),
  code: z.string().length(6),
});

// User types
export type CreateUserInput = z.infer<typeof CreateUserSchema>;
export type UpdateUserInput = z.infer<typeof UpdateUserSchema>;
export type ChangePasswordInput = z.infer<typeof ChangePasswordSchema>;
export type ResetPasswordInput = z.infer<typeof ResetPasswordSchema>;
export type LoginInput = z.infer<typeof LoginSchema>;
export type EnableMfaInput = z.infer<typeof EnableMfaSchema>;

export interface UserResponse {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  title?: string;
  department?: string;
  phone?: string;
  avatarUrl?: string;
  emailVerified: boolean;
  mfaEnabled: boolean;
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserWithRoles extends UserResponse {
  roles: Array<{
    id: string;
    name: string;
    description?: string;
    permissions: string[];
  }>;
}

export interface LoginResponse {
  user: UserResponse;
  token: string;
  requiresMfa: boolean;
  mfaToken?: string;
}

export interface AuthTokenPayload {
  userId: string;
  sessionId: string;
  email: string;
  roles: string[];
  permissions: string[];
  iat: number;
  exp: number;
}
