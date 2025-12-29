// Base types
export interface ApiResponse<T = any> {
  data: T;
  meta?: {
    requestId: string;
    timestamp: string;
    pagination?: PaginationMeta;
  };
  error?: ApiError;
}

export interface PaginatedResponse<T> {
  items: T[];
  pagination: PaginationMeta;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, any>;
  timestamp: string;
}

// Authentication types
export interface UserCredentials {
  email: string;
  password: string;
  deviceId?: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: string;
  user?: UserProfile;
}

export interface UserProfile {
  id: string;
  email: string;
  name?: string;
  roles: string[];
  organizationId?: string;
  permissions?: string[];
}

export interface UserSession {
  userId: string;
  email: string;
  roles: string[];
  organizationId?: string;
  deviceId?: string;
  issuedAt: Date;
  expiresAt: Date;
}

// Grant types
export type GrantStatus = 'draft' | 'open' | 'review' | 'closed' | 'archived';
export type ApplicationStatus = 
  | 'draft'
  | 'submitted'
  | 'under_review'
  | 'needs_revision'
  | 'resubmitted'
  | 'approved'
  | 'rejected'
  | 'cancelled'
  | 'funded';

export interface Grant {
  id: string;
  title: string;
  description?: string;
  fundingAmount: number;
  currency: string;
  deadline: string;
  eligibilityCriteria: string[];
  complianceRequirements: ComplianceRequirement[];
  status: GrantStatus;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, any>;
}

export interface ComplianceRequirement {
  code: string;
  description: string;
  required: boolean;
  validationRule?: string;
  documentationUrl?: string;
}

export interface GrantApplication {
  id: string;
  grantId: string;
  applicantId: string;
  organizationId?: string;
  data: Record<string, any>;
  attachments: Attachment[];
  status: ApplicationStatus;
  submittedAt: string;
  reviewNotes?: ReviewNote[];
  complianceCheckId?: string;
  workflowInstanceId?: string;
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, any>;
}

export interface Attachment {
  id: string;
  name: string;
  type: string;
  size: number;
  url: string;
  uploadedAt: string;
  checksum: string;
  storageLocation: string;
}

export interface ReviewNote {
  reviewerId: string;
  notes: string;
  timestamp: string;
  attachments?: string[];
}

export interface CreateGrantRequest {
  title: string;
  description?: string;
  fundingAmount: number;
  currency?: string;
  deadline: string;
  eligibilityCriteria?: string[];
  complianceRequirements?: ComplianceRequirement[];
  metadata?: Record<string, any>;
}

export interface SubmitApplicationRequest {
  organizationId?: string;
  data: Record<string, any>;
  attachments?: Omit<Attachment, 'id' | 'uploadedAt' | 'checksum' | 'storageLocation'>[];
  metadata?: Record<string, any>;
}

// Compliance types
export interface ComplianceCheckRequest {
  entityId: string;
  entityType: 'application' | 'applicant' | 'grant' | 'organization';
  checkTypes?: string[];
  standards?: string[];
  forceRefresh?: boolean;
}

export interface ComplianceCheckResult {
  results: Record<string, CheckResult>;
  overallStatus: 'passed' | 'failed' | 'warning';
  checksPerformed: number;
}

export interface CheckResult {
  passed: boolean;
  warnings: string[];
  errors: string[];
  details: Record<string, any>;
  requiredActions?: string[];
}

// Workflow types
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
  startedAt?: string;
  completedAt?: string;
  timeoutAt?: string;
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowStepInstance {
  id: string;
  stepId: string;
  status: StepStatus;
  startedAt?: string;
  completedAt?: string;
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
  timestamp: string;
  attachments?: string[];
}

// Task types
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
  dueDate?: string;
  completedDate?: string;
  workflowInstanceId?: string;
  stepId?: string;
  entityId?: string;
  entityType?: string;
  metadata?: Record<string, any>;
  comments?: TaskComment[];
  attachments?: string[];
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TaskComment {
  id: string;
  userId: string;
  comment: string;
  timestamp: string;
  attachments?: string[];
}

// Search and filter types
export interface SearchCriteria {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  filters?: Record<string, any>;
}

export interface DateRange {
  start: string;
  end: string;
}

// Event types
export interface WebhookEvent {
  id: string;
  type: string;
  resourceType: string;
  resourceId: string;
  timestamp: string;
  data: Record<string, any>;
  metadata?: Record<string, any>;
}

export interface WebhookSubscription {
  id: string;
  url: string;
  events: string[];
  secret?: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

// Configuration types
export interface ClientConfig {
  baseUrl: string;
  apiKey?: string;
  accessToken?: string;
  timeout?: number;
  maxRetries?: number;
  headers?: Record<string, string>;
  webhookSecret?: string;
}
