import { prisma } from '../config/database';
import { workflowEngine } from './workflows';
import { createError, Errors } from '../middleware/error';
import {
  CreateWorkflowInput,
  UpdateWorkflowInput,
  CreateApprovalInput,
  UpdateApprovalInput,
  ApproveRequestInput,
  ApprovalWorkflowResponse,
  ApprovalResponse,
  ApprovalStats,
  TimelineEvent,
} from './types';

export class ApprovalService {
  // Workflow management
  async createWorkflow(data: CreateWorkflowInput, createdBy: string): Promise<ApprovalWorkflowResponse> {
    // Validate approvers exist
    for (const stage of data.stages) {
      for (const approverId of stage.approvers) {
        const user = await prisma.user.findUnique({
          where: { id: approverId },
        });
        
        if (!user) {
          throw createError(`Approver not found: ${approverId}`, 400);
        }
      }
    }

    const workflow = await prisma.approvalWorkflow.create({
      data: {
        ...data,
        createdBy,
      },
    });

    return this.formatWorkflowResponse(workflow);
  }

  async getWorkflows(includeInactive: boolean = false): Promise<ApprovalWorkflowResponse[]> {
    const workflows = await prisma.approvalWorkflow.findMany({
      where: includeInactive ? undefined : { isActive: true },
      orderBy: { createdAt: 'desc' },
    });

    return workflows.map(wf => this.formatWorkflowResponse(wf));
  }

  async getWorkflowById(id: string): Promise<ApprovalWorkflowResponse> {
    const workflow = await prisma.approvalWorkflow.findUnique({
      where: { id },
    });

    if (!workflow) {
      throw Errors.NOT_FOUND('Workflow');
    }

    return this.formatWorkflowResponse(workflow);
  }

  async updateWorkflow(id: string, data: UpdateWorkflowInput): Promise<ApprovalWorkflowResponse> {
    const workflow = await prisma.approvalWorkflow.update({
      where: { id },
      data,
    });

    return this.formatWorkflowResponse(workflow);
  }

  async deleteWorkflow(id: string): Promise<void> {
    // Check if workflow is in use
    const approvals = await prisma.approval.count({
      where: { workflowId: id },
    });

    if (approvals > 0) {
      throw createError('Cannot delete workflow with active approvals', 400);
    }

    await prisma.approvalWorkflow.delete({
      where: { id },
    });
  }

  // Approval management
  async createApproval(data: CreateApprovalInput, createdBy: string): Promise<ApprovalResponse> {
    const approval = await workflowEngine.createApproval(
      data.workflowId,
      data.entityId,
      data.entityType,
      createdBy,
      data.metadata
    );

    return this.formatApprovalResponse(approval);
  }

  async getApprovalById(id: string): Promise<ApprovalResponse> {
    const approval = await prisma.approval.findUnique({
      where: { id },
      include: {
        workflow: true,
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (!approval) {
      throw Errors.NOT_FOUND('Approval');
    }

    return this.formatApprovalResponse(approval);
  }

  async getUserApprovals(userId: string, status?: string): Promise<ApprovalResponse[]> {
    const where: any = {
      OR: [
        { createdBy: userId },
        { assignedTo: { has: userId } },
        { approvedBy: { has: userId } },
      ],
    };

    if (status) {
      where.status = status;
    }

    const approvals = await prisma.approval.findMany({
      where,
      include: {
        workflow: true,
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return approvals.map(approval => this.formatApprovalResponse(approval));
  }

  async processApprovalDecision(
    approvalId: string,
    userId: string,
    data: ApproveRequestInput
  ): Promise<ApprovalResponse> {
    await workflowEngine.processDecision(approvalId, userId, data.decision, data.reason);

    // If comments provided, add them
    if (data.comments) {
      await prisma.comment.create({
        data: {
          content: data.comments,
          entityId: approvalId,
          entityType: 'approval',
          authorId: userId,
        },
      });
    }

    return this.getApprovalById(approvalId);
  }

  async getApprovalStats(userId: string): Promise<ApprovalStats> {
    const [
      total,
      pending,
      inReview,
      approved,
      rejected,
      overdue,
      assignedToMe,
    ] = await Promise.all([
      // Total approvals user is involved with
      prisma.approval.count({
        where: {
          OR: [
            { createdBy: userId },
            { assignedTo: { has: userId } },
          ],
        },
      }),

      // Pending approvals
      prisma.approval.count({
        where: {
          status: 'PENDING',
          OR: [
            { createdBy: userId },
            { assignedTo: { has: userId } },
          ],
        },
      }),

      // In review approvals
      prisma.approval.count({
        where: {
          status: 'IN_REVIEW',
          OR: [
            { createdBy: userId },
            { assignedTo: { has: userId } },
          ],
        },
      }),

      // Approved
      prisma.approval.count({
        where: {
          status: 'APPROVED',
          OR: [
            { createdBy: userId },
            { assignedTo: { has: userId } },
          ],
        },
      }),

      // Rejected
      prisma.approval.count({
        where: {
          status: 'REJECTED',
          OR: [
            { createdBy: userId },
            { assignedTo: { has: userId } },
          ],
        },
      }),

      // Overdue
      prisma.approval.count({
        where: {
          status: { in: ['PENDING', 'IN_REVIEW'] },
          dueAt: { lt: new Date() },
          OR: [
            { createdBy: userId },
            { assignedTo: { has: userId } },
          ],
        },
      }),

      // Assigned to me
      prisma.approval.count({
        where: {
          status: { in: ['PENDING', 'IN_REVIEW'] },
          assignedTo: { has: userId },
        },
      }),
    ]);

    return {
      total,
      pending,
      inReview,
      approved,
      rejected,
      overdue,
      assignedToMe,
    };
  }

  async getApprovalTimeline(approvalId: string): Promise<TimelineEvent[]> {
    const [approval, comments, activityLogs] = await Promise.all([
      prisma.approval.findUnique({
        where: { id: approvalId },
        include: {
          user: true,
        },
      }),
      prisma.comment.findMany({
        where: {
          entityId: approvalId,
          entityType: 'approval',
        },
        include: {
          author: true,
        },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.activityLog.findMany({
        where: {
          entityId: approvalId,
          entityType: 'approval',
        },
        orderBy: { timestamp: 'asc' },
      }),
    ]);

    if (!approval) {
      throw Errors.NOT_FOUND('Approval');
    }

    const timeline: TimelineEvent[] = [];

    // Add approval creation event
    timeline.push({
      id: `create-${approval.id}`,
      type: 'stage_change',
      userId: approval.createdBy,
      userName: approval.user ? `${approval.user.firstName} ${approval.user.lastName}` : 'System',
      timestamp: approval.createdAt,
      data: {
        stage: 0,
        action: 'created',
      },
    });

    // Add comments
    comments.forEach(comment => {
      timeline.push({
        id: comment.id,
        type: 'comment',
        userId: comment.authorId,
        userName: `${comment.author.firstName} ${comment.author.lastName}`,
        timestamp: comment.createdAt,
        data: {
          content: comment.content,
          edited: comment.isEdited,
        },
      });
    });

    // Add activity logs
    activityLogs.forEach(log => {
      let type: TimelineEvent['type'] = 'stage_change';
      
      if (log.action.includes('approval')) {
        type = log.action.includes('approve') ? 'approval' : 'rejection';
      } else if (log.action.includes('escalate')) {
        type = 'escalation';
      }

      timeline.push({
        id: log.id,
        type,
        userId: log.userId || 'system',
        userName: log.userId ? 'System' : 'Unknown',
        timestamp: log.timestamp,
        data: log.changes || {},
      });
    });

    // Add decision event if exists
    if (approval.decision && approval.decisionAt) {
      timeline.push({
        id: `decision-${approval.id}`,
        type: approval.decision.toLowerCase() as any,
        userId: approval.rejectedBy || approval.approvedBy?.[0] || 'system',
        userName: 'System',
        timestamp: approval.decisionAt,
        data: {
          decision: approval.decision,
          reason: approval.decisionReason,
        },
      });
    }

    // Sort by timestamp
    return timeline.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  // Private helper methods
  private formatWorkflowResponse(workflow: any): ApprovalWorkflowResponse {
    const stages = Array.isArray(workflow.stages) ? workflow.stages : [];
    
    return {
      id: workflow.id,
      name: workflow.name,
      description: workflow.description,
      entityType: workflow.entityType,
      stages: stages.map((stage: any, index: number) => ({
        id: index,
        name: stage.name,
        description: stage.description,
        approvers: stage.approvers || [],
        minApprovals: stage.minApprovals || 1,
        approvalsReceived: [],
        autoEscalateAfter: stage.autoEscalateAfter,
        requireSequential: stage.requireSequential || false,
        status: 'pending',
      })),
      conditions: Array.isArray(workflow.conditions) ? workflow.conditions : [],
      escalationRules: workflow.escalationRules,
      isActive: workflow.isActive,
      createdAt: workflow.createdAt,
      updatedAt: workflow.updatedAt,
      createdBy: workflow.createdBy,
    };
  }

  private formatApprovalResponse(approval: any): ApprovalResponse {
    const workflow = approval.workflow || {};
    const stages = Array.isArray(workflow.stages) ? workflow.stages : [];
    
    return {
      id: approval.id,
      workflowId: approval.workflowId,
      entityId: approval.entityId,
      entityType: approval.entityType,
      currentStage: approval.currentStage,
      status: approval.status,
      stages: stages.map((stage: any, index: number) => ({
        id: index,
        name: stage.name,
        description: stage.description,
        approvers: stage.approvers || [],
        minApprovals: stage.minApprovals || 1,
        approvalsReceived: approval.approvedBy || [],
        autoEscalateAfter: stage.autoEscalateAfter,
        requireSequential: stage.requireSequential || false,
        status: this.getStageStatus(index, approval.currentStage, approval.status),
      })),
      createdBy: approval.createdBy,
      assignedTo: approval.assignedTo || [],
      approvedBy: approval.approvedBy || [],
      rejectedBy: approval.rejectedBy,
      decision: approval.decision,
      decisionReason: approval.decisionReason,
      decisionAt: approval.decisionAt,
      dueAt: approval.dueAt,
      metadata: approval.metadata,
      createdAt: approval.createdAt,
      updatedAt: approval.updatedAt,
    };
  }

  private getStageStatus(
    stageIndex: number,
    currentStage: number,
    approvalStatus: string
  ): 'pending' | 'in_review' | 'approved' | 'rejected' {
    if (approvalStatus === 'REJECTED' || approvalStatus === 'CANCELLED') {
      return 'rejected';
    }

    if (approvalStatus === 'APPROVED') {
      return 'approved';
    }

    if (stageIndex < currentStage) {
      return 'approved';
    }

    if (stageIndex === currentStage) {
      return approvalStatus === 'IN_REVIEW' ? 'in_review' : 'pending';
    }

    return 'pending';
  }
}

export const approvalService = new ApprovalService();
