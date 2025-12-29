import { Pool, PoolClient, QueryResult } from 'pg';
import { config } from './config';
import { logger } from './logging';

export class Database {
  private static instance: Database;
  private pool: Pool;

  private constructor() {
    const dbConfig = config.get('database');

    this.pool = new Pool({
      host: dbConfig.host,
      port: dbConfig.port,
      database: dbConfig.name,
      user: dbConfig.user,
      password: dbConfig.password,
      ssl: dbConfig.ssl ? {
        rejectUnauthorized: false,
      } : false,
      max: dbConfig.maxConnections,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: dbConfig.connectionTimeout,
    });

    this.setupEventListeners();
  }

  static getInstance(): Database {
    if (!Database.instance) {
      Database.instance = new Database();
    }
    return Database.instance;
  }

  private setupEventListeners(): void {
    this.pool.on('connect', (client: PoolClient) => {
      logger.debug('Database client connected');
    });

    this.pool.on('error', (err: Error) => {
      logger.error('Database pool error', { error: err.message });
    });

    this.pool.on('remove', (client: PoolClient) => {
      logger.debug('Database client removed from pool');
    });
  }

  async query<T = any>(text: string, params?: any[]): Promise<QueryResult<T>> {
    const start = Date.now();
    
    try {
      const result = await this.pool.query<T>(text, params);
      const duration = Date.now() - start;

      logger.debug('Database query executed', {
        text,
        params,
        duration,
        rowCount: result.rowCount,
      });

      return result;
    } catch (error) {
      const duration = Date.now() - start;
      
      logger.error('Database query failed', {
        text,
        params,
        duration,
        error: error.message,
      });

      throw error;
    }
  }

  async transaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async getClient(): Promise<PoolClient> {
    return await this.pool.connect();
  }

  async close(): Promise<void> {
    await this.pool.end();
    logger.info('Database pool closed');
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.query('SELECT 1');
      return true;
    } catch (error) {
      logger.error('Database health check failed', { error: error.message });
      return false;
    }
  }

  // Helper methods for common operations
  async findById<T>(table: string, id: string): Promise<T | null> {
    const result = await this.query<T>(
      `SELECT * FROM ${this.escapeIdentifier(table)} WHERE id = $1`,
      [id]
    );
    return result.rows[0] || null;
  }

  async insert<T>(table: string, data: Record<string, any>): Promise<T> {
    const keys = Object.keys(data);
    const values = Object.values(data);
    const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
    
    const result = await this.query<T>(
      `INSERT INTO ${this.escapeIdentifier(table)} (${keys.map(k => this.escapeIdentifier(k)).join(', ')}) 
       VALUES (${placeholders}) 
       RETURNING *`,
      values
    );
    
    return result.rows[0];
  }

  async update<T>(table: string, id: string, data: Record<string, any>): Promise<T | null> {
    const keys = Object.keys(data);
    const values = Object.values(data);
    const setClause = keys.map((k, i) => `${this.escapeIdentifier(k)} = $${i + 1}`).join(', ');
    
    const result = await this.query<T>(
      `UPDATE ${this.escapeIdentifier(table)} 
       SET ${setClause}, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $${keys.length + 1} 
       RETURNING *`,
      [...values, id]
    );
    
    return result.rows[0] || null;
  }

  async delete(table: string, id: string): Promise<boolean> {
    const result = await this.query(
      `DELETE FROM ${this.escapeIdentifier(table)} WHERE id = $1`,
      [id]
    );
    return result.rowCount > 0;
  }

  private escapeIdentifier(identifier: string): string {
    return `"${identifier.replace(/"/g, '""')}"`;
  }

  // Method stubs for service implementations
  async saveGrant(grant: any): Promise<void> {
    // Implementation depends on your schema
    throw new Error('Not implemented');
  }

  async getGrant(grantId: string): Promise<any> {
    // Implementation depends on your schema
    throw new Error('Not implemented');
  }

  async listGrants(options: any): Promise<{ grants: any[]; total: number }> {
    // Implementation depends on your schema
    throw new Error('Not implemented');
  }

  async saveApplication(application: any): Promise<void> {
    // Implementation depends on your schema
    throw new Error('Not implemented');
  }

  async getApplication(applicationId: string): Promise<any> {
    // Implementation depends on your schema
    throw new Error('Not implemented');
  }

  async getUserApplicationForGrant(grantId: string, userId: string): Promise<any> {
    // Implementation depends on your schema
    throw new Error('Not implemented');
  }

  async getApplicationStatistics(grantId: string): Promise<any> {
    // Implementation depends on your schema
    throw new Error('Not implemented');
  }

  async getUser(userId: string): Promise<any> {
    // Implementation depends on your schema
    throw new Error('Not implemented');
  }

  async saveAuditEvent(event: any): Promise<void> {
    // Implementation depends on your schema
    throw new Error('Not implemented');
  }

  async getAuditEvents(query: any): Promise<{ events: any[]; total: number }> {
    // Implementation depends on your schema
    throw new Error('Not implemented');
  }

  async getAuditEvent(eventId: string): Promise<any> {
    // Implementation depends on your schema
    throw new Error('Not implemented');
  }

  async saveComplianceCheck(check: any): Promise<void> {
    // Implementation depends on your schema
    throw new Error('Not implemented');
  }

  async getComplianceChecks(entityId: string, entityType: string, limit: number): Promise<any[]> {
    // Implementation depends on your schema
    throw new Error('Not implemented');
  }

  async saveComplianceSchedule(schedule: any): Promise<void> {
    // Implementation depends on your schema
    throw new Error('Not implemented');
  }

  async getEntity(entityId: string, entityType: string): Promise<any> {
    // Implementation depends on your schema
    throw new Error('Not implemented');
  }

  async getEntityDocuments(entityId: string, entityType: string): Promise<any[]> {
    // Implementation depends on your schema
    throw new Error('Not implemented');
  }

  async getWorkflowDefinition(workflowId: string): Promise<any> {
    // Implementation depends on your schema
    throw new Error('Not implemented');
  }

  async saveWorkflowInstance(instance: any): Promise<void> {
    // Implementation depends on your schema
    throw new Error('Not implemented');
  }

  async getWorkflowInstance(instanceId: string): Promise<any> {
    // Implementation depends on your schema
    throw new Error('Not implemented');
  }

  async searchWorkflowInstances(query: any): Promise<{ instances: any[]; total: number }> {
    // Implementation depends on your schema
    throw new Error('Not implemented');
  }

  async saveTask(task: any): Promise<void> {
    // Implementation depends on your schema
    throw new Error('Not implemented');
  }

  async getTask(taskId: string): Promise<any> {
    // Implementation depends on your schema
    throw new Error('Not implemented');
  }

  async searchTasks(query: any): Promise<{ tasks: any[]; total: number }> {
    // Implementation depends on your schema
    throw new Error('Not implemented');
  }

  async getTaskStatistics(userId?: string, dateRange?: any): Promise<any> {
    // Implementation depends on your schema
    throw new Error('Not implemented');
  }
      }
