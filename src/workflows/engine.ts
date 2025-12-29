import { randomUUID } from 'crypto';
import { logger } from '../shared/logging';
import { Database } from '../shared/database';

export type WorkflowStatus = 
  | 'draft'
  | 'active'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type StepStatus = 
  | 'pending'
  | 'in_progress'
  | 'completed'
  | 'failed'
  | 'skipped'
  | 'blocked';

export type StepType = 
  | 'approval'
  | 'notification'
  | 'task'
  | 'gateway'
  | 'service'
  | 'timer';

export interface WorkflowDefinition {
  id: string;
  name: string;
  description?: string;
  version: string;
  steps: WorkflowStep[];
  variables?: Record<string, any>;
  conditions?: Record<string, string>;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface WorkflowStep {
  id: string;
  name: string;
  type: StepType;
  config: Record<string, any>;
  nextSteps?: string[];
  conditions?: Record<string, string>;
  assignee?: string | string[];
  timeout?: number; // in seconds
  retryPolicy?: RetryPolicy;
  metadata?: Record<string, any>;
}

export interface RetryPolicy {
  maxAttempts: number;
  backoffFactor: number;
  maxDelay: number;
}

export interface WorkflowInstance {
  id: string;
  workflowId: string;
  entityId: string;
  entityType: string;
  status: WorkflowStatus;
  currentStep?: string;
  variables: Record<string, any>;
  steps: WorkflowStepInstance[];
  createdBy?: string;
  startedAt?: Date;
  completedAt?: Date;
  timeoutAt?: Date;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface WorkflowStepInstance {
  id: string;
  stepId: string;
  status: StepStatus;
  startedAt?: Date;
  completedAt?: Date;
  result?: any;
  error?: string;
  attempts: number;
  assignee?: string;
  comments?: StepComment[];
  metadata?: Record<string, any>;
}

export interface StepComment {
  id: string;
  userId: string;
  comment: string;
  timestamp: Date;
  attachments?: string[];
}

export interface WorkflowExecutionRequest {
  workflowId: string;
  entityId: string;
  entityType: string;
  variables?: Record<string, any>;
  initiatedBy?: string;
  priority?: 'low' | 'normal' | 'high' | 'critical';
}

export class WorkflowEngine {
  private db: Database;

  constructor() {
    this.db = Database.getInstance();
  }

  async executeWorkflow(request: WorkflowExecutionRequest): Promise<WorkflowInstance> {
    try {
      // Load workflow definition
      const workflowDef = await this.db.getWorkflowDefinition(request.workflowId);
      if (!workflowDef) {
        throw new Error(`Workflow definition not found: ${request.workflowId}`);
      }

      // Create workflow instance
      const instanceId = `WFI-${randomUUID().substring(0, 8).toUpperCase()}`;
      
      const instance: WorkflowInstance = {
        id: instanceId,
        workflowId: request.workflowId,
        entityId: request.entityId,
        entityType: request.entityType,
        status: 'active',
        variables: request.variables || {},
        steps: this.initializeSteps(workflowDef.steps),
        createdBy: request.initiatedBy,
        startedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        metadata: {
          priority: request.priority || 'normal',
        },
      };

      // Save instance
      await this.db.saveWorkflowInstance(instance);

      // Start execution
      await this.startExecution(instanceId);

      logger.info('Workflow execution started', {
        instanceId,
        workflowId: request.workflowId,
        entityId: request.entityId,
        entityType: request.entityType,
        initiatedBy: request.initiatedBy,
      });

      return instance;
    } catch (error) {
      logger.error('Failed to execute workflow', { request, error });
      throw new Error('Failed to execute workflow');
    }
  }

  async getInstance(instanceId: string): Promise<WorkflowInstance | null> {
    try {
      return await this.db.getWorkflowInstance(instanceId);
    } catch (error) {
      logger.error('Failed to get workflow instance', { instanceId, error });
      throw new Error('Failed to get workflow instance');
    }
  }

  async updateStepStatus(
    instanceId: string,
    stepId: string,
    status: StepStatus,
    result?: any,
    error?: string,
    userId?: string
  ): Promise<void> {
    try {
      const instance = await this.db.getWorkflowInstance(instanceId);
      if (!instance) {
        throw new Error(`Workflow instance not found: ${instanceId}`);
      }

      const step = instance.steps.find(s => s.stepId === stepId);
      if (!step) {
        throw new Error(`Step not found: ${stepId}`);
      }

      // Update step
      step.status = status;
      step.updatedAt = new Date();

      if (status === 'completed') {
        step.completedAt = new Date();
        step.result = result;
      } else if (status === 'failed') {
        step.error = error;
        step.completedAt = new Date();
      }

      if (userId && step.assignee !== userId) {
        step.assignee = userId;
      }

      // Update instance
      instance.updatedAt = new Date();

      // Determine next steps
      if (status === 'completed') {
        await this.processCompletedStep(instance, step);
      } else if (status === 'failed') {
        await this.processFailedStep(instance, step);
      }

      // Save updates
      await this.db.saveWorkflowInstance(instance);

      logger.info('Workflow step status updated', {
        instanceId,
        stepId,
        status,
        userId,
      });
    } catch (error) {
      logger.error('Failed to update step status', {
        instanceId,
        stepId,
        status,
        error,
      });
      throw new Error('Failed to update step status');
    }
  }

  async addStepComment(
    instanceId: string,
    stepId: string,
    userId: string,
    comment: string,
    attachments?: string[]
  ): Promise<void> {
    try {
      const instance = await this.db.getWorkflowInstance(instanceId);
      if (!instance) {
        throw new Error(`Workflow instance not found: ${instanceId}`);
      }

      const step = instance.steps.find(s => s.stepId === stepId);
      if (!step) {
        throw new Error(`Step not found: ${stepId}`);
      }

      const commentId = randomUUID();
      step.comments = step.comments || [];
      step.comments.push({
        id: commentId,
        userId,
        comment,
        timestamp: new Date(),
        attachments,
      });

      instance.updatedAt = new Date();

      await this.db.saveWorkflowInstance(instance);

      logger.info('Step comment added', {
        instanceId,
        stepId,
        userId,
        commentId,
      });
    } catch (error) {
      logger.error('Failed to add step comment', {
        instanceId,
        stepId,
        userId,
        error,
      });
      throw new Error('Failed to add step comment');
    }
  }

  async cancelWorkflow(instanceId: string, reason?: string, userId?: string): Promise<void> {
    try {
      const instance = await this.db.getWorkflowInstance(instanceId);
      if (!instance) {
        throw new Error(`Workflow instance not found: ${instanceId}`);
      }

      if (instance.status === 'completed' || instance.status === 'cancelled') {
        throw new Error(`Cannot cancel workflow in ${instance.status} status`);
      }

      instance.status = 'cancelled';
      instance.completedAt = new Date();
      instance.updatedAt = new Date();

      // Cancel all pending steps
      for (const step of instance.steps) {
        if (step.status === 'pending' || step.status === 'in_progress') {
          step.status = 'skipped';
          step.completedAt = new Date();
        }
      }

      await this.db.saveWorkflowInstance(instance);

      logger.info('Workflow cancelled', {
        instanceId,
        reason,
        userId,
      });
    } catch (error) {
      logger.error('Failed to cancel workflow', { instanceId, error });
      throw new Error('Failed to cancel workflow');
    }
  }

  async getWorkflowHistory(instanceId: string): Promise<WorkflowStepInstance[]> {
    try {
      const instance = await this.db.getWorkflowInstance(instanceId);
      if (!instance) {
        throw new Error(`Workflow instance not found: ${instanceId}`);
      }

      return instance.steps;
    } catch (error) {
      logger.error('Failed to get workflow history', { instanceId, error });
      throw new Error('Failed to get workflow history');
    }
  }

  async searchWorkflows(query: {
    workflowId?: string;
    entityId?: string;
    entityType?: string;
    status?: WorkflowStatus | WorkflowStatus[];
    createdBy?: string;
    startedAfter?: Date;
    startedBefore?: Date;
    page?: number;
    limit?: number;
  }): Promise<{ instances: WorkflowInstance[]; total: number }> {
    try {
      const page = query.page || 1;
      const limit = query.limit || 20;
      const offset = (page - 1) * limit;

      return await this.db.searchWorkflowInstances({
        ...query,
        limit,
        offset,
      });
    } catch (error) {
      logger.error('Failed to search workflows', { query, error });
      throw new Error('Failed to search workflows');
    }
  }

  private initializeSteps(steps: WorkflowStep[]): WorkflowStepInstance[] {
    return steps.map(step => ({
      id: randomUUID(),
      stepId: step.id,
      status: 'pending',
      attempts: 0,
      assignee: this.resolveAssignee(step.assignee),
      metadata: step.metadata,
    }));
  }

  private resolveAssignee(assignee?: string | string[]): string | undefined {
    if (!assignee) return undefined;

    if (Array.isArray(assignee)) {
      // Round-robin assignment or other logic
      return assignee[0];
    }

    return assignee;
  }

  private async startExecution(instanceId: string): Promise<void> {
    const instance = await this.db.getWorkflowInstance(instanceId);
    if (!instance) return;

    // Find first step
    const firstStep = instance.steps.find(step => step.status === 'pending');
    if (firstStep) {
      await this.executeStep(instance, firstStep);
    }
  }

  private async executeStep(
    instance: WorkflowInstance,
    stepInstance: WorkflowStepInstance
  ): Promise<void> {
    try {
      const workflowDef = await this.db.getWorkflowDefinition(instance.workflowId);
      if (!workflowDef) return;

      const stepDef = workflowDef.steps.find(s => s.id === stepInstance.stepId);
      if (!stepDef) return;

      // Update step status
      stepInstance.status = 'in_progress';
      stepInstance.startedAt = new Date();
      stepInstance.attempts++;

      // Update instance
      instance.currentStep = stepInstance.stepId;
      instance.updatedAt = new Date();

      await this.db.saveWorkflowInstance(instance);

      // Execute step based on type
      await this.executeStepByType(instance, stepDef, stepInstance);
    } catch (error) {
      logger.error('Step execution failed', {
        instanceId: instance.id,
        stepId: stepInstance.stepId,
        error,
      });

      await this.handleStepFailure(instance, stepInstance, error.message);
    }
  }

  private async executeStepByType(
    instance: WorkflowInstance,
    stepDef: WorkflowStep,
    stepInstance: WorkflowStepInstance
  ): Promise<void> {
    switch (stepDef.type) {
      case 'approval':
        await this.executeApprovalStep(instance, stepDef, stepInstance);
        break;
      case 'notification':
        await this.executeNotificationStep(instance, stepDef, stepInstance);
        break;
      case 'task':
        await this.executeTaskStep(instance, stepDef, stepInstance);
        break;
      case 'service':
        await this.executeServiceStep(instance, stepDef, stepInstance);
        break;
      case 'timer':
        await this.executeTimerStep(instance, stepDef, stepInstance);
        break;
      case 'gateway':
        await this.executeGatewayStep(instance, stepDef, stepInstance);
        break;
      default:
        throw new Error(`Unknown step type: ${stepDef.type}`);
    }
  }

  private async executeApprovalStep(
    instance: WorkflowInstance,
    stepDef: WorkflowStep,
    stepInstance: WorkflowStepInstance
  ): Promise<void> {
    // For approval steps, we typically wait for manual intervention
    // Create an approval task in the task service
    const taskService = new (await import('./tasks')).TaskService();
    
    await taskService.createApprovalTask({
      workflowInstanceId: instance.id,
      stepId: stepDef.id,
      entityId: instance.entityId,
      entityType: instance.entityType,
      assignee: stepInstance.assignee,
      title: stepDef.name,
      description: stepDef.config.description,
      dueDate: stepDef.timeout ? 
        new Date(Date.now() + stepDef.timeout * 1000) : 
        undefined,
      metadata: {
        ...stepDef.metadata,
        variables: instance.variables,
      },
    });

    logger.info('Approval step created', {
      instanceId: instance.id,
      stepId: stepDef.id,
      assignee: stepInstance.assignee,
    });
  }

  private async executeNotificationStep(
    instance: WorkflowInstance,
    stepDef: WorkflowStep,
    stepInstance: WorkflowStepInstance
  ): Promise<void> {
    // Send notification
    const notificationService = new (await import('../shared/notifications')).NotificationService();
    
    await notificationService.send({
      to: stepDef.config.recipients || stepInstance.assignee,
      type: stepDef.config.notificationType || 'workflow',
      subject: stepDef.config.subject || `Workflow Notification: ${stepDef.name}`,
      body: this.resolveTemplate(stepDef.config.template, instance.variables),
      metadata: {
        workflowInstanceId: instance.id,
        stepId: stepDef.id,
        entityId: instance.entityId,
      },
    });

    // Notification steps are typically auto-completed
    await this.updateStepStatus(
      instance.id,
      stepInstance.stepId,
      'completed',
      { notificationSent: true }
    );
  }

  private async executeTaskStep(
    instance: WorkflowInstance,
    stepDef: WorkflowStep,
    stepInstance: WorkflowStepInstance
  ): Promise<void> {
    // Create a manual task
    const taskService = new (await import('./tasks')).TaskService();
    
    await taskService.createTask({
      workflowInstanceId: instance.id,
      stepId: stepDef.id,
      entityId: instance.entityId,
      entityType: instance.entityType,
      assignee: stepInstance.assignee,
      title: stepDef.name,
      description: stepDef.config.description,
      instructions: stepDef.config.instructions,
      dueDate: stepDef.timeout ? 
        new Date(Date.now() + stepDef.timeout * 1000) : 
        undefined,
      metadata: stepDef.metadata,
    });

    logger.info('Task step created', {
      instanceId: instance.id,
      stepId: stepDef.id,
      assignee: stepInstance.assignee,
    });
  }

  private async executeServiceStep(
    instance: WorkflowInstance,
    stepDef: WorkflowStep,
    stepInstance: WorkflowStepInstance
  ): Promise<void> {
    // Execute an automated service call
    const serviceUrl = stepDef.config.serviceUrl;
    const method = stepDef.config.method || 'POST';
    const payload = this.resolvePayload(stepDef.config.payload, instance.variables);

    // Make HTTP request to service
    const response = await fetch(serviceUrl, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...stepDef.config.headers,
      },
      body: payload ? JSON.stringify(payload) : undefined,
    });

    if (!response.ok) {
      throw new Error(`Service call failed: ${response.statusText}`);
    }

    const result = await response.json();

    // Update variables if configured
    if (stepDef.config.resultVariable) {
      instance.variables[stepDef.config.resultVariable] = result;
    }

    await this.updateStepStatus(
      instance.id,
      stepInstance.stepId,
      'completed',
      result
    );
  }

  private async executeTimerStep(
    instance: WorkflowInstance,
    stepDef: WorkflowStep,
    stepInstance: WorkflowStepInstance
  ): Promise<void> {
    // Schedule a timer
    const delay = stepDef.config.delay || stepDef.timeout || 0;
    
    setTimeout(async () => {
      await this.updateStepStatus(
        instance.id,
        stepInstance.stepId,
        'completed',
        { timerCompleted: true }
      );
    }, delay * 1000);

    logger.info('Timer step scheduled', {
      instanceId: instance.id,
      stepId: stepDef.id,
      delay,
    });
  }

  private async executeGatewayStep(
    instance: WorkflowInstance,
    stepDef: WorkflowStep,
    stepInstance: WorkflowStepInstance
  ): Promise<void> {
    // Evaluate conditions to determine next steps
    const condition = stepDef.config.condition;
    const shouldProceed = this.evaluateCondition(condition, instance.variables);

    const result = { conditionEvaluated: shouldProceed };

    if (shouldProceed && stepDef.nextSteps && stepDef.nextSteps.length > 0) {
      // Schedule next steps
      for (const nextStepId of stepDef.nextSteps) {
        const nextStep = instance.steps.find(s => s.stepId === nextStepId);
        if (nextStep && nextStep.status === 'pending') {
          // In a real implementation, you might want to execute these in parallel or sequence
          result[nextStepId] = 'scheduled';
        }
      }
    }

    await this.updateStepStatus(
      instance.id,
      stepInstance.stepId,
      'completed',
      result
    );
  }

  private async processCompletedStep(
    instance: WorkflowInstance,
    stepInstance: WorkflowStepInstance
  ): Promise<void> {
    const workflowDef = await this.db.getWorkflowDefinition(instance.workflowId);
    if (!workflowDef) return;

    const stepDef = workflowDef.steps.find(s => s.id === stepInstance.stepId);
    if (!stepDef) return;

    // Determine next steps
    if (stepDef.nextSteps && stepDef.nextSteps.length > 0) {
      for (const nextStepId of stepDef.nextSteps) {
        const nextStep = instance.steps.find(s => s.stepId === nextStepId);
        if (nextStep && nextStep.status === 'pending') {
          await this.executeStep(instance, nextStep);
          break; // Execute one step at a time for now
        }
      }
    } else {
      // No next steps, check if workflow is complete
      await this.checkWorkflowCompletion(instance);
    }
  }

  private async processFailedStep(
    instance: WorkflowInstance,
    stepInstance: WorkflowStepInstance,
    error: string
  ): Promise<void> {
    const workflowDef = await this.db.getWorkflowDefinition(instance.workflowId);
    if (!workflowDef) return;

    const stepDef = workflowDef.steps.find(s => s.id === stepInstance.stepId);
    if (!stepDef) return;

    // Check retry policy
    if (
      stepDef.retryPolicy &&
      stepInstance.attempts < stepDef.retryPolicy.maxAttempts
    ) {
      // Calculate delay for retry
      const delay = Math.min(
        stepDef.retryPolicy.backoffFactor * Math.pow(2, stepInstance.attempts - 1),
        stepDef.retryPolicy.maxDelay
      );

      // Schedule retry
      setTimeout(async () => {
        await this.executeStep(instance, stepInstance);
      }, delay * 1000);
    } else {
      // Max retries exceeded or no retry policy
      // Check for error handling steps
      const errorStep = workflowDef.steps.find(s => 
        s.id === stepDef.config.onErrorStep
      );

      if (errorStep) {
        const errorStepInstance = instance.steps.find(s => s.stepId === errorStep.id);
        if (errorStepInstance) {
          await this.executeStep(instance, errorStepInstance);
        }
      } else {
        // Mark workflow as failed
        instance.status = 'failed';
        instance.completedAt = new Date();
        instance.updatedAt = new Date();

        await this.db.saveWorkflowInstance(instance);

        logger.error('Workflow failed', {
          instanceId: instance.id,
   
