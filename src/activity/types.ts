import { z } from 'zod';

// Activity schemas
export const GetActivitySchema = z.object({
  entityType: z.string().optional(),
  entityId: z.string().optional(),
  userId: z.string().uuid().optional(),
  action: z.string().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  page: z.string().transform(Number).default('1'),
  limit: z.string().transform(Number).default('50'),
});

export const ExportActivitySchema = z.object({
  entityType: z.string().optional(),
  entityId: z.string().optional(),
  userId: z.string().uuid().optional(),
  action: z.string().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  format: z.enum(['csv', 'json']).default('csv'),
});

// Types
export type GetActivityInput = z.infer<typeof GetActivitySchema>;
export type ExportActivityInput = z.infer<typeof ExportActivitySchema>;

export interface ActivityLogResponse {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  changes: Record<string, any>;
  userId?: string;
  userName?: string;
  userAgent?: string;
  ipAddress?: string;
  timestamp: Date;
}

export interface ActivityStats {
  total: number;
  byAction: Record<string, number>;
  byUser: Record<string, number>;
  byEntityType: Record<string, number>;
  hourlyTrend: Array<{ hour: string; count: number }>;
}

export interface AuditTrailEntry {
  id: string;
  eventType: string;
  description: string;
  payload: Record<string, any>;
  sourceIp?: string;
  userAgent?: string;
  userId?: string;
  userName?: string;
  recordedAt: Date;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
    }
