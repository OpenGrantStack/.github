import { randomUUID } from 'crypto';
import { logger } from '../shared/logging';
import { Database } from '../shared/database';

export interface AuditEvent {
  id: string;
  eventType: string;
  entityType: string;
  entityId: string;
  userId?: string;
  organizationId?: string;
  ipAddress?: string;
  userAgent?: string;
  action: string;
  changes: AuditChange[];
  metadata?: Record<string, any>;
  timestamp: Date;
  requestId?: string;
}

export interface AuditChange {
  field: string;
  oldValue?: any;
  newValue?: any;
  type: 'create' | 'update' | 'delete';
}

export interface AuditQuery {
  entityType?: string;
  entityId?: string;
  userId?: string;
  organizationId?: string;
  eventType?: string;
  startDate?: Date;
  endDate?: Date;
  page?: number;
  limit?: number;
}

export class AuditService {
  private db: Database;

  constructor() {
    this.db = Database.getInstance();
  }

  async logEvent(event: Omit<AuditEvent, 'id' | 'timestamp'>): Promise<string> {
    try {
      const auditEvent: AuditEvent = {
        id: randomUUID(),
        timestamp: new Date(),
        ...event,
      };

      // Ensure changes are serializable
      auditEvent.changes = this.sanitizeChanges(auditEvent.changes);

      await this.db.saveAuditEvent(auditEvent);

      // Also log to structured logging system
      logger.info('Audit event recorded', {
        auditId: auditEvent.id,
        eventType: auditEvent.eventType,
        entityType: auditEvent.entityType,
        entityId: auditEvent.entityId,
        userId: auditEvent.userId,
      });

      return auditEvent.id;
    } catch (error) {
      logger.error('Failed to log audit event', { error, event });
      throw new Error('Failed to log audit event');
    }
  }

  async getEvents(query: AuditQuery): Promise<{
    events: AuditEvent[];
    total: number;
    page: number;
    pages: number;
  }> {
    try {
      const page = query.page || 1;
      const limit = query.limit || 50;
      const offset = (page - 1) * limit;

      const { events, total } = await this.db.getAuditEvents({
        ...query,
        limit,
        offset,
      });

      return {
        events,
        total,
        page,
        pages: Math.ceil(total / limit),
      };
    } catch (error) {
      logger.error('Failed to retrieve audit events', { query, error });
      throw new Error('Failed to retrieve audit events');
    }
  }

  async getEvent(eventId: string): Promise<AuditEvent | null> {
    try {
      return await this.db.getAuditEvent(eventId);
    } catch (error) {
      logger.error('Failed to retrieve audit event', { eventId, error });
      throw new Error('Failed to retrieve audit event');
    }
  }

  async exportEvents(
    query: AuditQuery,
    format: 'json' | 'csv' = 'json'
  ): Promise<string> {
    try {
      const { events } = await this.getEvents({ ...query, limit: 1000 });

      switch (format) {
        case 'json':
          return JSON.stringify(events, null, 2);
        case 'csv':
          return this.convertToCSV(events);
        default:
          throw new Error(`Unsupported format: ${format}`);
      }
    } catch (error) {
      logger.error('Failed to export audit events', { query, format, error });
      throw new Error('Failed to export audit events');
    }
  }

  async createDataAccessLog(
    userId: string,
    resourceType: string,
    resourceId: string,
    action: string,
    details?: Record<string, any>
  ): Promise<string> {
    return this.logEvent({
      eventType: 'DATA_ACCESS',
      entityType: resourceType,
      entityId: resourceId,
      userId,
      action,
      changes: [],
      metadata: details,
    });
  }

  async createDataModificationLog(
    userId: string,
    resourceType: string,
    resourceId: string,
    action: string,
    changes: AuditChange[],
    details?: Record<string, any>
  ): Promise<string> {
    return this.logEvent({
      eventType: 'DATA_MODIFICATION',
      entityType: resourceType,
      entityId: resourceId,
      userId,
      action,
      changes,
      metadata: details,
    });
  }

  async createComplianceCheckLog(
    checkType: string,
    entityType: string,
    entityId: string,
    passed: boolean,
    details?: Record<string, any>
  ): Promise<string> {
    return this.logEvent({
      eventType: 'COMPLIANCE_CHECK',
      entityType,
      entityId,
      action: checkType,
      changes: [
        {
          field: 'compliance_status',
          oldValue: undefined,
          newValue: passed ? 'passed' : 'failed',
          type: 'update',
        },
      ],
      metadata: {
        ...details,
        passed,
        checkType,
      },
    });
  }

  async createSecurityEventLog(
    eventType: string,
    userId?: string,
    details?: Record<string, any>
  ): Promise<string> {
    return this.logEvent({
      eventType: 'SECURITY_EVENT',
      entityType: 'system',
      entityId: 'security',
      userId,
      action: eventType,
      changes: [],
      metadata: details,
    });
  }

  private sanitizeChanges(changes: AuditChange[]): AuditChange[] {
    return changes.map(change => ({
      ...change,
      // Remove sensitive data from audit logs
      oldValue: this.redactSensitiveData(change.field, change.oldValue),
      newValue: this.redactSensitiveData(change.field, change.newValue),
    }));
  }

  private redactSensitiveData(field: string, value: any): any {
    const sensitiveFields = [
      'password',
      'token',
      'secret',
      'key',
      'ssn',
      'socialSecurity',
      'creditCard',
      'cvv',
      'pin',
    ];

    const isSensitive = sensitiveFields.some(sensitive =>
      field.toLowerCase().includes(sensitive.toLowerCase())
    );

    if (isSensitive && value !== undefined) {
      return '[REDACTED]';
    }

    return value;
  }

  private convertToCSV(events: AuditEvent[]): string {
    if (events.length === 0) {
      return '';
    }

    const headers = [
      'id',
      'timestamp',
      'eventType',
      'entityType',
      'entityId',
      'userId',
      'organizationId',
      'action',
      'ipAddress',
      'requestId',
    ];

    const rows = events.map(event => [
      event.id,
      event.timestamp.toISOString(),
      event.eventType,
      event.entityType,
      event.entityId,
      event.userId || '',
      event.organizationId || '',
      event.action,
      event.ipAddress || '',
      event.requestId || '',
    ]);

    const csv = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
    ].join('\n');

    return csv;
  }
}
