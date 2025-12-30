# Workflow Engine

GrantReady Hub's workflow engine manages multi-stage approval processes with configurable rules, escalation paths, and audit trails.

## Architecture Overview

```

┌─────────────────────────────────────┐
│Workflow Definition         │
│• Stages & Approvers              │
│• Conditions & Routing            │
│• Escalation Rules               │
└──────────────────┬──────────────────┘
│
┌──────────────────▼──────────────────┐
│Approval Instance            │
│• Current Stage                   │
│• Status & Decision              │
│• Timeline & Comments            │
└──────────────────┬──────────────────┘
│
┌──────────────────▼──────────────────┐
│Stage Processing             │
│• Approval Collection             │
│• Decision Evaluation             │
│• Next Stage Transition           │
└─────────────────────────────────────┘

```

## Core Components

### 1. Workflow Definition
JSON-based definition of approval processes:

```json
{
  "name": "Grant Application Review",
  "entityType": "grant_application",
  "stages": [
    {
      "name": "Technical Review",
      "approvers": ["user1", "user2"],
      "minApprovals": 1,
      "requireSequential": false
    },
    {
      "name": "Budget Approval",
      "approvers": ["user3", "user4", "user5"],
      "minApprovals": 2,
      "autoEscalateAfter": 48
    }
  ],
  "conditions": [
    {
      "field": "amount",
      "operator": "greater_than",
      "value": 100000,
      "targetStage": 2
    }
  ],
  "escalationRules": {
    "escalationChain": ["director", "vp", "cio"],
    "notifyOriginalApprovers": true
  }
}
```

2. Approval Instance

Tracks the state of a specific approval request:

· Current stage and status
· Assigned approvers
· Decisions and comments
· Metadata and timeline

3. Stage Processing Engine

Manages state transitions and decision processing:

· Approval collection and validation
· Conditional routing
· Escalation handling
· Notification dispatch

Workflow Stages

Stage Properties

```typescript
interface WorkflowStage {
  name: string;                    // Stage identifier
  description?: string;           // Stage description
  approvers: string[];           // User IDs who can approve
  minApprovals: number;          // Required approvals to advance
  autoEscalateAfter?: number;    // Hours before auto-escalation
  requireSequential: boolean;    // Approvals must be in order
  allowedDecisions: string[];    // Allowed decision types
}
```

Stage Types

1. Parallel Approval
   · Multiple approvers can approve simultaneously
   · Minimum number of approvals required
   · No specific order required
2. Sequential Approval
   · Approvers must approve in specified order
   · Each approver waits for previous approval
   · Single path through stage
3. Conditional Stage
   · Stage execution based on conditions
   · Dynamic approver assignment
   · Optional stage skipping

Decision Types

1. Approve

· Moves to next stage or completes workflow
· Records approval with optional comments
· Triggers notifications

2. Reject

· Terminates approval process
· Records rejection reason
· Notifies all participants

3. Request Changes

· Returns to previous stage or creator
· Specifies required changes
· Pauses timeline

4. Escalate

· Moves to higher authority
· Follows escalation chain
· Preserves decision context

Conditional Routing

Condition Evaluation

Conditions are evaluated when transitioning between stages:

```javascript
{
  "conditions": [
    {
      "field": "amount",           // Entity field to evaluate
      "operator": "greater_than",  // Comparison operator
      "value": 50000,             // Comparison value
      "targetStage": 2            // Jump to stage if true
    }
  ]
}
```

Supported Operators

· equals: Field equals value
· not_equals: Field not equal to value
· greater_than: Field greater than value
· less_than: Field less than value
· contains: Field contains value (for arrays/strings)
· in: Field value in array

Escalation System

Escalation Triggers

1. Manual Escalation: Approver escalates decision
2. Auto-escalation: Timeout without decision
3. Recursive Escalation: Multiple escalation levels

Escalation Chain

```json
{
  "escalationRules": {
    "escalationChain": [
      "department_head",
      "division_director", 
      "vice_president"
    ],
    "notifyOriginalApprovers": true,
    "maxEscalationLevel": 3
  }
}
```

Escalation Process

1. Current approver escalates to next in chain
2. System notifies new approver
3. Timeline pauses during escalation
4. If final escalation fails, workflow rejects

Timeline & Audit

Timeline Events

```typescript
interface TimelineEvent {
  timestamp: Date;
  type: 'stage_change' | 'approval' | 'rejection' | 'comment';
  userId: string;
  details: Record<string, any>;
}
```

Audit Requirements

1. Immutable Logging: All decisions permanently recorded
2. Before/After State: Changes captured for compliance
3. User Context: IP, user agent, and session info
4. Digital Signatures: Optional cryptographic signing

Notifications

Notification Types

1. Assignment: User assigned to approve
2. Decision: Approval decision made
3. Escalation: Workflow escalated
4. Overdue: Approval past due date
5. Completion: Workflow completed

Delivery Channels

· In-app notifications
· Email
· SMS
· Mobile push
· WebSocket real-time updates

Implementation

Workflow Engine Service

```typescript
class WorkflowEngine {
  async createApproval(workflowId: string, entity: any): Promise<Approval>
  async processDecision(approvalId: string, decision: Decision): Promise<void>
  async escalate(approvalId: string, reason: string): Promise<void>
  async getTimeline(approvalId: string): Promise<TimelineEvent[]>
}
```

Database Schema

```prisma
model ApprovalWorkflow {
  id              String
  name            String
  entityType      String
  stages          Json      // Array of stage definitions
  conditions      Json?     // Conditional routing rules
  escalationRules Json?     // Escalation configuration
}

model Approval {
  id            String
  workflowId    String
  entityId      String
  currentStage  Int
  status        ApprovalStatus
  assignedTo    String[]    // Current approvers
  approvedBy    String[]    // Users who approved
  timeline      Json?       // Timeline events
}
```

Configuration Examples

Simple Two-Stage Approval

```json
{
  "name": "Document Review",
  "stages": [
    {
      "name": "Peer Review",
      "approvers": ["peer1", "peer2", "peer3"],
      "minApprovals": 2
    },
    {
      "name": "Manager Approval",
      "approvers": ["manager"],
      "minApprovals": 1
    }
  ]
}
```

Conditional Budget Approval

```json
{
  "name": "Budget Approval",
  "stages": [
    {
      "name": "Department Approval",
      "approvers": ["dept_head"],
      "minApprovals": 1
    }
  ],
  "conditions": [
    {
      "field": "amount",
      "operator": "greater_than",
      "value": 100000,
      "targetStage": 1
    }
  ]
}
```

Escalation Workflow

```json
{
  "name": "Critical System Access",
  "stages": [
    {
      "name": "IT Manager Review",
      "approvers": ["it_manager"],
      "minApprovals": 1,
      "autoEscalateAfter": 4
    }
  ],
  "escalationRules": {
    "escalationChain": ["it_director", "cio"],
    "maxEscalationLevel": 2
  }
}
```

Integration Patterns

1. External System Integration

```typescript
// Webhook notification
await webhookService.notify({
  event: 'approval_created',
  approvalId: approval.id,
  entity: approval.entity,
  url: externalSystem.webhookUrl
});
```

2. Document Generation

```typescript
// Generate approval document
const document = await documentService.generate({
  template: 'approval_certificate',
  data: {
    approval: approval,
    decisions: approval.timeline,
    signatures: approval.approvedBy
  }
});
```

3. Compliance Reporting

```typescript
// Export for audit
const auditReport = await reportService.generate({
  type: 'approval_audit',
  timeframe: { start, end },
  filters: { department: 'Research' }
});
```

Performance Considerations

1. Scalability

· Batch process overdue approvals
· Use Redis for workflow state caching
· Implement connection pooling for database

2. Reliability

· Idempotent decision processing
· Retry mechanisms for failures
· Dead letter queue for failed notifications

3. Monitoring

· Track approval cycle times
· Monitor escalation rates
· Alert on stuck workflows

Security Considerations

1. Access Control

· Validate approver authorization
· Check scope restrictions
· Verify temporal constraints

2. Data Integrity

· Checksums for workflow definitions
· Digital signatures for decisions
· Immutable audit trail

3. Compliance

· GDPR: Right to explanation for decisions
· HIPAA: Audit trail for access approvals
· SOX: Segregation of duties enforcement

Testing Strategies

Unit Tests

```typescript
describe('WorkflowEngine', () => {
  it('should advance to next stage when approvals met', async () => {
    const engine = new WorkflowEngine();
    const result = await engine.processDecision(approvalId, 'APPROVE');
    expect(result.currentStage).toBe(1);
  });
});
```

Integration Tests

```typescript
describe('Approval Workflow', () => {
  it('should complete multi-stage approval', async () => {
    const approval = await createTestApproval();
    await simulateApprovals(approval, ['APPROVE', 'APPROVE']);
    expect(approval.status).toBe('APPROVED');
  });
});
``

Load Tests

```typescript
describe('Workflow Performance', () => {
  it('should handle 1000 concurrent approvals', async () => {
    const approvals = await createConcurrentApprovals(1000);
    const results = await processBatch(approvals);
    expect(results).toHaveLength(1000);
  });
});
```

Troubleshooting Guide

Common Issues

1. Stuck Workflows
   · Check for expired approvers
   · Verify notification delivery
   · Review escalation configuration
2. Permission Errors
   · Validate approver assignments
   · Check role permissions
   · Verify scope restrictions
3. Performance Issues
   · Monitor database indexes
   · Check cache hit rates
   · Review query performance

Debug Endpoints

```typescript
// Get workflow state
GET /api/v1/workflows/:id/debug

// Force transition (admin only)
POST /api/v1/approvals/:id/force-transition

// Reset workflow (admin only)
POST /api/v1/approvals/:id/reset
```

Migration & Versioning

Workflow Versioning

```json
{
  "workflowId": "budget-approval-v2",
  "version": "2.1.0",
  "compatibility": ["2.0.0", "1.5.0"],
  "migrationScript": "migrate-v1-to-v2.js"
}
```

Data Migration

1. Backward Compatibility: Old approvals continue with original workflow
2. Version Tracking: Record workflow version with each approval
3. Migration Tools: Scripts to update in-flight approvals

---

This workflow engine is designed for government and enterprise use, with emphasis on auditability, compliance, and reliability.
