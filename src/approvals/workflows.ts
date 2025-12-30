import { prisma } from '../config/database';
import { io } from '../index';

export class WorkflowEngine {
  // Create a new approval instance
  async createApproval(workflowId: string, entityId: string, entityType: string, createdBy: string, metadata?: any) {
    const workflow = await prisma.approvalWorkflow.findUnique({
      where: { id: workflowId },
    });

    if (!workflow) {
      throw new Error('Workflow not found');
    }

    const stages = Array.isArray(workflow.stages) ? workflow.stages : [];
    const firstStage = stages[0];
    
    if (!firstStage) {
      throw new Error('Workflow has no stages');
    }

    const approval = await prisma.approval.create({
      data: {
        workflowId,
        entityId,
        entityType,
        currentStage: 0,
        status: 'PENDING',
        createdBy,
        assignedTo: firstStage.approvers || [],
        metadata,
      },
    });

    // Notify approvers
    this.notifyApprovers(firstStage.approvers, {
      type: 'approval_assigned',
      approvalId: approval.id,
      entityId,
      entityType,
      stage: firstStage.name,
    });

    // Log activity
    await this.logActivity({
      action: 'approval_created',
      entityType: 'approval',
      entityId: approval.id,
      userId: createdBy,
      changes: { workflowId, entityId, entityType },
    });

    return approval;
  }

  // Process approval decision
  async processDecision(approvalId: string, userId: string, decision: string, reason?: string) {
    const approval = await prisma.approval.findUnique({
      where: { id: approvalId },
      include: {
        workflow: true,
      },
    });

    if (!approval) {
      throw new Error('Approval not found');
    }

    const stages = Array.isArray(approval.workflow.stages) ? approval.workflow.stages : [];
    const currentStage = stages[approval.currentStage];

    if (!currentStage) {
      throw new Error('Invalid workflow stage');
    }

    // Check if user is authorized to approve
    if (!approval.assignedTo.includes(userId)) {
      throw new Error('User not authorized to approve this stage');
    }

    let updatedApproval;
    let nextStageApprovers: string[] = [];

    switch (decision) {
      case 'APPROVE':
        updatedApproval = await this.handleApproval(approval, userId, reason, stages);
        nextStageApprovers = updatedApproval.assignedTo;
        break;

      case 'REJECT':
        updatedApproval = await this.handleRejection(approval, userId, reason);
        break;

      case 'REQUEST_CHANGES':
        updatedApproval = await this.handleRequestChanges(approval, userId, reason);
        break;

      case 'ESCALATE':
        updatedApproval = await this.handleEscalation(approval, userId, reason);
        break;

      default:
        throw new Error('Invalid decision');
    }

    // Notify relevant users
    this.notifyDecision(approval, decision, userId, reason);

    // Log activity
    await this.logActivity({
      action: `approval_${decision.toLowerCase()}`,
      entityType: 'approval',
      entityId: approvalId,
      userId,
      changes: { decision, reason },
    });

    // Notify next stage approvers if applicable
    if (nextStageApprovers.length > 0) {
      this.notifyApprovers(nextStageApprovers, {
        type: 'approval_assigned',
        approvalId: approval.id,
        entityId: approval.entityId,
        entityType: approval.entityType,
        stage: stages[updatedApproval!.currentStage]?.name,
      });
    }

    return updatedApproval;
  }

  // Private methods
  private async handleApproval(approval: any, userId: string, reason: string, stages: any[]) {
    const currentStage = stages[approval.currentStage];
    const approvedBy = [...(approval.approvedBy || []), userId];
    
    // Check if stage requirements are met
    if (approvedBy.length >= currentStage.minApprovals) {
      // Move to next stage or complete
      if (approval.currentStage < stages.length - 1) {
        const nextStage = stages[approval.currentStage + 1];
        
        return await prisma.approval.update({
          where: { id: approval.id },
          data: {
            currentStage: approval.currentStage + 1,
            status: approval.currentStage + 1 === stages.length - 1 ? 'IN_REVIEW' : 'PENDING',
            approvedBy: [],
            assignedTo: nextStage.approvers,
            decision: null,
            decisionReason: null,
            decisionAt: null,
          },
        });
      } else {
        // All stages complete
        return await prisma.approval.update({
          where: { id: approval.id },
          data: {
            status: 'APPROVED',
            decision: 'APPROVE',
            decisionReason: reason,
            decisionAt: new Date(),
            approvedBy,
          },
        });
      }
    } else {
      // Still need more approvals for this stage
      return await prisma.approval.update({
        where: { id: approval.id },
        data: {
          approvedBy,
        },
      });
    }
  }

  private async handleRejection(approval: any, userId: string, reason: string) {
    return await prisma.approval.update({
      where: { id: approval.id },
      data: {
        status: 'REJECTED',
        decision: 'REJECT',
        decisionReason: reason,
        decisionAt: new Date(),
        rejectedBy: userId,
      },
    });
  }

  private async handleRequestChanges(approval: any, userId: string, reason: string) {
    return await prisma.approval.update({
      where: { id: approval.id },
      data: {
        status: 'PENDING',
        decision: 'REQUEST_CHANGES',
        decisionReason: reason,
        decisionAt: new Date(),
      },
    });
  }

  private async handleEscalation(approval: any, userId: string, reason: string) {
    const workflow = approval.workflow;
    const escalationRules = workflow.escalationRules || {};
    const escalationChain = escalationRules.escalationChain || [];

    // Find next person in escalation chain
    const currentEscalatorIndex = escalationChain.indexOf(userId);
    const nextEscalator = currentEscalatorIndex < escalationChain.length - 1 
      ? escalationChain[currentEscalatorIndex + 1]
      : null;

    if (nextEscalator) {
      // Escalate to next person
      return await prisma.approval.update({
        where: { id: approval.id },
        data: {
          status: 'ESCALATED',
          assignedTo: [nextEscalator],
          decision: 'ESCALATE',
          decisionReason: reason,
          decisionAt: new Date(),
        },
      });
    } else {
      // No more escalation, treat as rejection
      return await this.handleRejection(approval, userId, reason);
    }
  }

  private notifyApprovers(userIds: string[], notification: any) {
    userIds.forEach(userId => {
      io.to(`user:${userId}`).emit('notification', notification);
    });
  }

  private notifyDecision(approval: any, decision: string, userId: string, reason?: string) {
    // Notify the approval creator
    io.to(`user:${approval.createdBy}`).emit('approval_decision', {
      approvalId: approval.id,
      decision,
      decidedBy: userId,
      reason,
      timestamp: new Date(),
    });

    // Notify all approvers
    approval.assignedTo.forEach((approverId: string) => {
      if (approverId !== userId) {
        io.to(`user:${approverId}`).emit('approval_updated', {
          approvalId: approval.id,
          decision,
          decidedBy: userId,
        });
      }
    });
  }

  private async logActivity(data: {
    action: string;
    entityType: string;
    entityId: string;
    userId: string;
    changes?: any;
  }) {
    await prisma.activityLog.create({
      data: {
        ...data,
        timestamp: new Date(),
      },
    });
  }

  // Check for overdue approvals
  async checkOverdueApprovals() {
    const overdueApprovals = await prisma.approval.findMany({
      where: {
        status: { in: ['PENDING', 'IN_REVIEW'] },
        dueAt: { lt: new Date() },
      },
      include: {
        workflow: true,
      },
    });

    for (const approval of overdueApprovals) {
      const workflow = approval.workflow;
      const currentStage = (Array.isArray(workflow.stages) ? workflow.stages : [])[approval.currentStage];

      if (currentStage?.autoEscalateAfter) {
        // Auto-escalate overdue approvals
        await this.handleEscalation(approval, 'system', 'Auto-escalated due to overdue');
      }

      // Send overdue notifications
      this.notifyApprovers(approval.assignedTo, {
        type: 'approval_overdue',
        approvalId: approval.id,
        entityId: approval.entityId,
        entityType: approval.entityType,
      });
    }
  }
}

export const workflowEngine = new WorkflowEngine();
