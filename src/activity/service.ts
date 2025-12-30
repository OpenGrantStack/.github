import { prisma } from '../config/database';
import { createError, Errors } from '../middleware/error';
import {
  GetActivityInput,
  ExportActivityInput,
  ActivityLogResponse,
  ActivityStats,
  AuditTrailEntry,
  PaginatedResponse,
} from './types';
import { Parser } from 'json2csv';

export class ActivityService {
  // Get activity logs with filtering
  async getActivityLogs(filters: GetActivityInput): Promise<PaginatedResponse<ActivityLogResponse>> {
    const {
      entityType,
      entityId,
      userId,
      action,
      startDate,
      endDate,
      page = 1,
      limit = 50,
    } = filters;

    const where: any = {};

    if (entityType) where.entityType = entityType;
    if (entityId) where.entityId = entityId;
    if (userId) where.userId = userId;
    if (action) where.action = action;
    
    if (startDate || endDate) {
      where.timestamp = {};
      if (startDate) where.timestamp.gte = new Date(startDate);
      if (endDate) where.timestamp.lte = new Date(endDate);
    }

    const [total, logs] = await Promise.all([
      prisma.activityLog.count({ where }),
      prisma.activityLog.findMany({
        where,
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
        orderBy: { timestamp: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    const formattedLogs = logs.map(log => this.formatActivityLog(log));

    return {
      data: formattedLogs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
    };
  }

  // Get activity statistics
  async getActivityStats(startDate?: Date, endDate?: Date): Promise<ActivityStats> {
    const where: any = {};
    
    if (startDate || endDate) {
      where.timestamp = {};
      if (startDate) where.timestamp.gte = startDate;
      if (endDate) where.timestamp.lte = endDate;
    }

    const [total, logs] = await Promise.all([
      prisma.activityLog.count({ where }),
      prisma.activityLog.findMany({
        where,
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
        orderBy: { timestamp: 'asc' },
      }),
    ]);

    // Calculate statistics
    const byAction: Record<string, number> = {};
    const byUser: Record<string, number> = {};
    const byEntityType: Record<string, number> = {};
    const hourlyTrend: Record<string, number> = {};

    logs.forEach(log => {
      // By action
      byAction[log.action] = (byAction[log.action] || 0) + 1;

      // By user
      if (log.userId) {
        const userName = log.user ? `${log.user.firstName} ${log.user.lastName}` : 'Unknown';
        byUser[userName] = (byUser[userName] || 0) + 1;
      }

      // By entity type
      byEntityType[log.entityType] = (byEntityType[log.entityType] || 0) + 1;

      // Hourly trend
      const hour = log.timestamp.toISOString().slice(0, 13) + ':00:00Z';
      hourlyTrend[hour] = (hourlyTrend[hour] || 0) + 1;
    });

    return {
      total,
      byAction,
      byUser,
      byEntityType,
      hourlyTrend: Object.entries(hourlyTrend)
        .map(([hour, count]) => ({ hour, count }))
        .sort((a, b) => a.hour.localeCompare(b.hour)),
    };
  }

  // Export activity logs
  async exportActivityLogs(filters: ExportActivityInput, format: 'csv' | 'json' = 'csv'): Promise<string> {
    const where: any = {};

    if (filters.entityType) where.entityType = filters.entityType;
    if (filters.entityId) where.entityId = filters.entityId;
    if (filters.userId) where.userId = filters.userId;
    if (filters.action) where.action = filters.action;
    
    if (filters.startDate || filters.endDate) {
      where.timestamp = {};
      if (filters.startDate) where.timestamp.gte = new Date(filters.startDate);
      if (filters.endDate) where.timestamp.lte = new Date(filters.endDate);
    }

    const logs = await prisma.activityLog.findMany({
      where,
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
      orderBy: { timestamp: 'desc' },
    });

    const formattedLogs = logs.map(log => this.formatActivityLog(log));

    if (format === 'json') {
      return JSON.stringify(formattedLogs, null, 2);
    } else {
      const fields = [
        'timestamp',
        'action',
        'entityType',
        'entityId',
        'userId',
        'userName',
        'ipAddress',
        'userAgent',
        'changes',
      ];

      const json2csvParser = new Parser({ fields });
      return json2csvParser.parse(formattedLogs);
    }
  }

  // Get audit trail
  async getAuditTrail(
    startDate?: Date,
    endDate?: Date,
    eventType?: string
  ): Promise<AuditTrailEntry[]> {
    const where: any = {};
    
    if (eventType) where.eventType = eventType;
    
    if (startDate || endDate) {
      where.recordedAt = {};
      if (startDate) where.recordedAt.gte = startDate;
      if (endDate) where.recordedAt.lte = endDate;
    }

    const auditTrail = await prisma.auditTrail.findMany({
      where,
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
      orderBy: { recordedAt: 'desc' },
    });

    return auditTrail.map(entry => this.formatAuditTrailEntry(entry));
  }

  // Log activity (internal use)
  async logActivity(data: {
    action: string;
    entityType: string;
    entityId: string;
    userId?: string;
    changes?: Record<string, any>;
    userAgent?: string;
    ipAddress?: string;
  }): Promise<void> {
    await prisma.activityLog.create({
      data: {
        ...data,
        timestamp: new Date(),
      },
    });

    // Also log to audit trail for high-security events
    const auditEvents = [
      'user_login',
      'user_logout',
      'user_password_change',
      'role_assignment',
      'permission_change',
      'system_config_change',
    ];

    if (auditEvents.includes(data.action)) {
      await prisma.auditTrail.create({
        data: {
          eventType: data.action,
          description: this.getAuditDescription(data.action, data.entityType, data.entityId),
          payload: data.changes || {},
          sourceIp: data.ipAddress,
          userAgent: data.userAgent,
          userId: data.userId,
          recordedAt: new Date(),
        },
      });
    }
  }

  // Private helper methods
  private formatActivityLog(log: any): ActivityLogResponse {
    return {
      id: log.id,
      action: log.action,
      entityType: log.entityType,
      entityId: log.entityId,
      changes: log.changes as Record<string, any>,
      userId: log.userId,
      userName: log.user ? `${log.user.firstName} ${log.user.lastName}` : undefined,
      userAgent: log.userAgent,
      ipAddress: log.ipAddress,
      timestamp: log.timestamp,
    };
  }

  private formatAuditTrailEntry(entry: any): AuditTrailEntry {
    return {
      id: entry.id,
      eventType: entry.eventType,
      description: entry.description,
      payload: entry.payload as Record<string, any>,
      sourceIp: entry.sourceIp,
      userAgent: entry.userAgent,
      userId: entry.userId,
      userName: entry.user ? `${entry.user.firstName} ${entry.user.lastName}` : undefined,
      recordedAt: entry.recordedAt,
    };
  }

  private getAuditDescription(action: string, entityType: string, entityId: string): string {
    const descriptions: Record<string, string> = {
      'user_login': `User logged in`,
      'user_logout': `User logged out`,
      'user_password_change': `User changed password`,
      'role_assignment': `Role assignment modified for ${entityType} ${entityId}`,
      'permission_change': `Permissions modified for ${entityType} ${entityId}`,
      'system_config_change': `System configuration changed`,
    };

    return descriptions[action] || `${action} on ${entityType} ${entityId}`;
  }
}

export const activityService = new ActivityService();
