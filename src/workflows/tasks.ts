import { randomUUID } from 'crypto';
import { logger } from '../shared/logging';
import { Database } from '../shared/database';

export type TaskStatus = 
  | 'pending'
  | 'in_progress'
  | 'completed'
  | 'blocked'
  | 'cancelled'
  | 'overdue';

export type TaskPriority = 'low' | 'normal' | 'high' | 'critical';

export interface Task {
  id: string;
  title: string;
  description?: string;
  instructions?: string;
  type: 'approval' | 'review' | 'data_entry' | 'verification' | 'follow_up';
  status: TaskStatus;
  priority: TaskPriority;
  assignee?: string;
  assigneeGroup?: string;
  dueDate?: Date;
  completedDate?: Date;
  workflowInstanceId?: string;
  stepId?: string;
  entityId?: string;
  entityType?: string;
  metadata?: Record<string, any>;
  comments?: TaskComment[];
  attachments?: string[];
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface TaskComment {
  id: string;
  userId: string;
  comment: string;
  timestamp: Date;
  attachments?: string[];
}

export interface CreateTaskRequest {
  title: string;
  description?: string;
  instructions?: string;
  type?: Task['type'];
  priority?: TaskPriority;
  assignee?: string;
  assigneeGroup?: string;
  dueDate?: Date;
  workflowInstanceId?: string;
  stepId?: string;
  entityId?: string;
  entityType?: string;
  metadata?: Record<string, any>;
}

export interface CreateApprovalTaskRequest extends CreateTaskRequest {
  approvers?: string[];
  options?: string[];
  minApprovals?: number;
}

export interface TaskSearchCriteria {
  assignee?: string;
  assigneeGroup?: string;
  status?: TaskStatus | TaskStatus[];
  priority?: TaskPriority | TaskPriority[];
  type?: Task['type'] | Task['type'][];
  workflowInstanceId?: string;
  entityId?: string;
  entityType?: string;
  dueBefore?: Date;
  dueAfter?: Date;
  createdBefore?: Date;
  createdAfter?: Date;
  page?: number;
  limit?: number;
}

export class TaskService {
  private db: Database;

  constructor() {
    this.db = Database.getInstance();
  }

  async createTask(request: CreateTaskRequest): Promise<Task> {
    try {
      const taskId = `TASK-${randomUUID().substring(0, 8).toUpperCase()}`;
      
      const task: Task = {
        id: taskId,
        title: request.title,
        description: request.description,
        instructions: request.instructions,
        type: request.type || 'data_entry',
        status: 'pending',
        priority: request.priority || 'normal',
        assignee: request.assignee,
        assigneeGroup: request.assigneeGroup,
        dueDate: request.dueDate,
        workflowInstanceId: request.workflowInstanceId,
        stepId: request.stepId,
        entityId: request.entityId,
        entityType: request.entityType,
        metadata: request.metadata || {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await this.db.saveTask(task);

      logger.info('Task created', {
        taskId,
        title: task.title,
        assignee: task.assignee,
        type: task.type,
      });

      return task;
    } catch (error) {
      logger.error('Failed to create task', { request, error });
      throw new Error('Failed to create task');
    }
  }

  async createApprovalTask(request: CreateApprovalTaskRequest): Promise<Task> {
    const task = await this.createTask({
      ...request,
      type: 'approval',
      metadata: {
        ...request.metadata,
        approvalConfig: {
          approvers: request.approvers,
          options: request.options,
          minApprovals: request.minApprovals || 1,
          approvals: [],
          rejections: [],
        },
      },
    });

    // Send notifications to approvers
    if (request.approvers && request.approvers.length > 0) {
      const notificationService = new (await import('../shared/notifications')).NotificationService();
      
      for (const approver of request.approvers) {
        await notificationService.send({
          to: approver,
          type: 'approval',
          subject: `Approval Required: ${request.title}`,
          body: request.description || 'Your approval is required',
          metadata: {
            taskId: task.id,
            entityId: request.entityId,
            entityType: request.entityType,
          },
        });
      }
    }

    return task;
  }

  async getTask(taskId: string): Promise<Task | null> {
    try {
      return await this.db.getTask(taskId);
    } catch (error) {
      logger.error('Failed to get task', { taskId, error });
      throw new Error('Failed to get task');
    }
  }

  async updateTask(
    taskId: string,
    updates: Partial<Pick<Task, 'status' | 'priority' | 'assignee' | 'dueDate'>>,
    userId?: string
  ): Promise<Task> {
    try {
      const task = await this.db.getTask(taskId);
      if (!task) {
        throw new Error(`Task not found: ${taskId}`);
      }

      // Apply updates
      Object.assign(task, updates);
      task.updatedAt = new Date();

      // Handle status changes
      if (updates.status === 'completed') {
        task.completedDate = new Date();
      }

      await this.db.saveTask(task);

      logger.info('Task updated', {
        taskId,
        updates,
        userId,
      });

      return task;
    } catch (error) {
      logger.error('Failed to update task', { taskId, updates, error });
      throw new Error('Failed to update task');
    }
  }

  async addTaskComment(
    taskId: string,
    userId: string,
    comment: string,
    attachments?: string[]
  ): Promise<TaskComment> {
    try {
      const task = await this.db.getTask(taskId);
      if (!task) {
        throw new Error(`Task not found: ${taskId}`);
      }

      const commentId = randomUUID();
      const taskComment: TaskComment = {
        id: commentId,
        userId,
        comment,
        timestamp: new Date(),
        attachments,
      };

      task.comments = task.comments || [];
      task.comments.push(taskComment);
      task.updatedAt = new Date();

      await this.db.saveTask(task);

      logger.info('Task comment added', {
        taskId,
        commentId,
        userId,
      });

      return taskComment;
    } catch (error) {
      logger.error('Failed to add task comment', {
        taskId,
        userId,
        error,
      });
      throw new Error('Failed to add task comment');
    }
  }

  async submitApproval(
    taskId: string,
    userId: string,
    decision: 'approve' | 'reject',
    comments?: string
  ): Promise<{ task: Task; completed: boolean }> {
    try {
      const task = await this.db.getTask(taskId);
      if (!task) {
        throw new Error(`Task not found: ${taskId}`);
      }

      if (task.type !== 'approval') {
        throw new Error('Task is not an approval task');
      }

      const approvalConfig = task.metadata?.approvalConfig;
      if (!approvalConfig) {
        throw new Error('Approval configuration not found');
      }

      // Record decision
      if (decision === 'approve') {
        approvalConfig.approvals = approvalConfig.approvals || [];
        if (!approvalConfig.approvals.includes(userId)) {
          approvalConfig.approvals.push(userId);
        }
      } else {
        approvalConfig.rejections = approvalConfig.rejections || [];
        if (!approvalConfig.rejections.includes(userId)) {
          approvalConfig.rejections.push(userId);
        }
      }

      // Add comment if provided
      if (comments) {
        await this.addTaskComment(taskId, userId, comments);
      }

      // Check if approval is complete
      const minApprovals = approvalConfig.minApprovals || 1;
      const approvalsCount = approvalConfig.approvals.length;
      const rejectionsCount = approvalConfig.rejections.length;

      let completed = false;
      let newStatus: TaskStatus = task.status;

      if (rejectionsCount > 0) {
        // Rejection overrides approvals
        completed = true;
        newStatus = 'completed';
        task.metadata!.approvalResult = 'rejected';
      } else if (approvalsCount >= minApprovals) {
        completed = true;
        newStatus = 'completed';
        task.metadata!.approvalResult = 'approved';
      }

      // Update task
      task.status = newStatus;
      if (completed) {
        task.completedDate = new Date();
      }
      task.updatedAt = new Date();

      await this.db.saveTask(task);

      logger.info('Approval submitted', {
        taskId,
        userId,
        decision,
        approvalsCount,
        rejectionsCount,
        completed,
      });

      return { task, completed };
    } catch (error) {
      logger.error('Failed to submit approval', {
        taskId,
        userId,
        decision,
        error,
      });
      throw new Error('Failed to submit approval');
    }
  }

  async searchTasks(criteria: TaskSearchCriteria): Promise<{
    tasks: Task[];
    total: number;
    page: number;
    pages: number;
  }> {
    try {
      const page = criteria.page || 1;
      const limit = criteria.limit || 20;
      const offset = (page - 1) * limit;

      const { tasks, total } = await this.db.searchTasks({
        ...criteria,
        limit,
        offset,
      });

      return {
        tasks,
        total,
        page,
        pages: Math.ceil(total / limit),
      };
    } catch (error) {
      logger.error('Failed to search tasks', { criteria, error });
      throw new Error('Failed to search tasks');
    }
  }

  async getUserTasks(
    userId: string,
    options?: {
      includeGroupTasks?: boolean;
      status?: TaskStatus | TaskStatus[];
      priority?: TaskPriority | TaskPriority[];
      page?: number;
      limit?: number;
    }
  ): Promise<{ tasks: Task[]; total: number }> {
    try {
      const criteria: TaskSearchCriteria = {
        assignee: userId,
        status: options?.status,
        priority: options?.priority,
        page: options?.page,
        limit: options?.limit,
      };

      if (options?.includeGroupTasks) {
        // Get user's groups and include those tasks
        const userGroups = await this.getUserGroups(userId);
        if (userGroups.length > 0) {
          criteria.assigneeGroup = userGroups[0]; // Simplified - would need more complex logic for multiple groups
        }
      }

      const result = await this.searchTasks(criteria);
      return { tasks: result.tasks, total: result.total };
    } catch (error) {
      logger.error('Failed to get user tasks', { userId, options, error });
      throw new Error('Failed to get user tasks');
    }
  }

  async getOverdueTasks(): Promise<Task[]> {
    try {
      const now = new Date();
      const { tasks } = await this.searchTasks({
        status: ['pending', 'in_progress'],
        dueBefore: now,
        limit: 1000, // Adjust based on your needs
      });

      return tasks;
    } catch (error) {
      logger.error('Failed to get overdue tasks', { error });
      throw new Error('Failed to get overdue tasks');
    }
  }

  async getTaskStatistics(
    userId?: string,
    dateRange?: { start: Date; end: Date }
  ): Promise<{
    total: number;
    byStatus: Record<TaskStatus, number>;
    byPriority: Record<TaskPriority, number>;
    byType: Record<Task['type'], number>;
    completionRate: number;
    averageCompletionTime?: number; // in hours
  }> {
    try {
      return await this.db.getTaskStatistics(userId, dateRange);
    } catch (error) {
      logger.error('Failed to get task statistics', { userId, dateRange, error });
      throw new Error('Failed to get task statistics');
    }
  }

  async reassignTask(
    taskId: string,
    newAssignee: string,
    reassignedBy: string,
    reason?: string
  ): Promise<Task> {
    try {
      const task = await this.db.getTask(taskId);
      if (!task) {
        throw new Error(`Task not found: ${taskId}`);
      }

      const oldAssignee = task.assignee;
      task.assignee = newAssignee;
      task.updatedAt = new Date();

      // Add reassignment comment
      const comment = `Task reassigned from ${oldAssignee || 'unassigned'} to ${newAssignee}${
        reason ? `: ${reason}` : ''
      }`;
      
      await this.addTaskComment(taskId, reassignedBy, comment);

      await this.db.saveTask(task);

      logger.info('Task reassigned', {
        taskId,
        oldAssignee,
        newAssignee,
        reassignedBy,
        reason,
      });

      return task;
    } catch (error) {
      logger.error('Failed to reassign task', {
        taskId,
        newAssignee,
        reassignedBy,
        error,
      });
      throw new Error('Failed to reassign task');
    }
  }

  async escalateTask(
    taskId: string,
    escalatedBy: string,
    reason?: string
  ): Promise<Task> {
    try {
      const task = await this.db.getTask(taskId);
      if (!task) {
        throw new Error(`Task not found: ${taskId}`);
      }

      // Increase priority
      const priorityOrder: TaskPriority[] = ['low', 'normal', 'high', 'critical'];
      const currentIndex = priorityOrder.indexOf(task.priority);
      if (currentIndex < priorityOrder.length - 1) {
        task.priority = priorityOrder[currentIndex + 1];
      }

      // Add escalation comment
      const comment = `Task escalated to ${task.priority} priority${
        reason ? `: ${reason}` : ''
      }`;
      
      await this.addTaskComment(taskId, escalatedBy, comment);

      task.updatedAt = new Date();
      await this.db.saveTask(task);

      logger.info('Task escalated', {
        taskId,
        newPriority: task.priority,
        escalatedBy,
        reason,
      });

      return task;
    } catch (error) {
      logger.error('Failed to escalate task', {
        taskId,
        escalatedBy,
        error,
      });
      throw new Error('Failed to escalate task');
    }
  }

  private async getUserGroups(userId: string): Promise<string[]> {
    // Implementation depends on your user/group management system
    // This should return the groups the user belongs to
    return [];
  }
  }
