import { z } from 'zod';

// Workflow schemas
export const CreateWorkflowSchema = z.object({
  name: z.string().min(3).max(100),
  description: z.string().max(500).optional(),
  entityType: z.string().min(1).max(50),
  stages: z.array(z.object({
    name: z.string(),
    description: z.string().optional(),
    approvers: z.array(z.string().uuid()), // User IDs
    minApprovals: z.number().int().min(1),
    autoEscalateAfter: z.number().int().optional(), // Hours
    requireSequential: z.boolean().default(false),
  })),
  conditions: z.array(z.object({
    field: z.string(),
    operator: z.enum(['equals', 'not_equals', 'greater_than', 'less_than', 'contains']),
    value: z.any(),
    targetStage: z.number().int(),
  })).optional(),
  escalationRules: z.object({
    escalationChain: z.array(z.string().uuid()), // User IDs for escalation
    notifyOriginalApprovers: z.boolean().default(true),
    maxEscalationLevel: z.number().int().min(1).max(5).default(3),
  }).optional(),
});

export const UpdateWorkflowSchema = z.object({
  name: z.string().min(3).max(100).optional(),
  description: z.string().max(500).optional(),
  stages: z.array(z.object({
    name: z.string(),
    description: z.string().optional(),
    approvers: z.array(z.string().uuid()),
    minApprovals: z.number().int().min(1),
    autoEscalateAfter: z.number().int().optional(),
    requireSequential: z.boolean().default(false),
  })).optional(),
  conditions: z.array(z.object({
    field: z.string(),
    operator: z.enum(['equals', 'not_equals', 'greater_than', 'less_than', 'contains']),
    value: z.any(),
    targetStage: z.number().int(),
  })).optional(),
  escalationRules: z.object({
    escalationChain: z.array(z.string().uuid()),
    notifyOriginalApprovers: z.boolean().default(true),
    maxEscalationLevel: z.number().int().min(1).max(5).default(3),
  }).optional(),
  isActive: z.boolean().optional(),
});

// Approval schemas
export const CreateApprovalSchema = z.object({
  workflowId: z.string().uuid(),
  entityId: z.string().min(1),
  entityType: z.string().min(1).max(50),
  dueAt: z.string().datetime().optional(),
  metadata: z.record(z.any()).optional(),
});

export const UpdateApprovalSchema = z.object({
  status: z.enum(['CANCELLED']).optional(),
  dueAt: z.string().datetime().optional(),
});

export const ApproveRequestSchema = z.object({
  decision: z.enum(['APPROVE', 'REJECT', 'REQUEST_CHANGES', 'ESCALATE']),
  reason: z.string().max(1000).optional(),
  comments: z.string().max(5000).optional(),
});

// Types
export type CreateWorkflowInput = z.infer<typeof CreateWorkflowSchema>;
export type UpdateWorkflowInput = z.infer<typeof UpdateWorkflowSchema>;
export type CreateApprovalInput = z.infer<typeof CreateApprovalSchema>;
export type UpdateApprovalInput = z.infer<typeof UpdateApprovalSchema>;
export type ApproveRequestInput = z.infer<typeof ApproveRequestSchema>;

export interface WorkflowStage {
  id: number;
  name: string;
  description?: string;
  approvers: string[];
  minApprovals: number;
  approvalsReceived: string[];
  autoEscalateAfter?: number;
  requireSequential: boolean;
  status: 'pending' | 'in_review' | 'approved' | 'rejected';
}

export interface ApprovalWorkflowResponse {
  id: string;
  name: string;
  description?: string;
  entityType: string;
  stages: WorkflowStage[];
  conditions?: any[];
  escalationRules?: any;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

export interface ApprovalResponse {
  id: string;
  workflowId: string;
  entityId: string;
  entityType: string;
  currentStage: number;
  status: 'PENDING' | 'IN_REVIEW' | 'APPROVED' | 'REJECTED' | 'CANCELLED' | 'ESCALATED';
  stages: WorkflowStage[];
  createdBy: string;
  assignedTo: string[];
  approvedBy: string[];
  rejectedBy?: string;
  decision?: 'APPROVE' | 'REJECT' | 'REQUEST_CHANGES' | 'ESCALATE';
  decisionReason?: string;
  decisionAt?: Date;
  dueAt?: Date;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface ApprovalStats {
  total: number;
  pending: number;
  inReview: number;
  approved: number;
  rejected: number;
  overdue: number;
  assignedToMe: number;
}

export interface TimelineEvent {
  id: string;
  type: 'stage_change' | 'approval' | 'rejection' | 'comment' | 'escalation';
  userId: string;
  userName: string;
  timestamp: Date;
  data: Record<string, any>;
}
