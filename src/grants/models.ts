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
  deadline: Date;
  eligibilityCriteria: string[];
  complianceRequirements: ComplianceRequirement[];
  status: GrantStatus;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  metadata: Record<string, any>;
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
  submittedAt: Date;
  reviewNotes?: ReviewNote[];
  complianceCheckId?: string;
  workflowInstanceId?: string;
  createdAt: Date;
  updatedAt: Date;
  metadata: Record<string, any>;
}

export interface Attachment {
  id: string;
  name: string;
  type: string;
  size: number;
  url: string;
  uploadedAt: Date;
  checksum: string;
  storageLocation: string;
}

export interface ReviewNote {
  reviewerId: string;
  notes: string;
  timestamp: Date;
  attachments?: string[]; // Attachment IDs
}

export interface CreateGrantRequest {
  title: string;
  description?: string;
  fundingAmount: number;
  currency?: string;
  deadline: string | Date;
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

export interface ApplicationSearchCriteria {
  grantId?: string;
  applicantId?: string;
  organizationId?: string;
  status?: ApplicationStatus | ApplicationStatus[];
  submittedAfter?: Date;
  submittedBefore?: Date;
  page?: number;
  limit?: number;
}

export interface GrantSearchCriteria {
  status?: GrantStatus | GrantStatus[];
  deadlineAfter?: Date;
  deadlineBefore?: Date;
  fundingAmountMin?: number;
  fundingAmountMax?: number;
  organizationId?: string; // Grants available to specific organizations
  page?: number;
  limit?: number;
}

export interface GrantStatistics {
  totalApplications: number;
  applicationsByStatus: Record<ApplicationStatus, number>;
  fundingDistributed: number;
  averageProcessingTime: number; // in days
  complianceCheckPassRate: number;
}

export interface FundingAllocation {
  applicationId: string;
  amount: number;
  currency: string;
  disbursementDate: Date;
  paymentMethod: 'check' | 'wire' | 'ach' | 'card';
  status: 'pending' | 'processed' | 'failed';
  transactionId?: string;
  notes?: string;
}

export interface EligibilityCheck {
  criteria: string;
  passed: boolean;
  evidence?: string;
  checkedAt: Date;
  checkedBy: string; // system or user ID
}
