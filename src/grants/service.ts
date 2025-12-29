import { randomUUID } from 'crypto';
import { logger } from '../shared/logging';
import { Database } from '../shared/database';
import {
  Grant,
  GrantApplication,
  GrantStatus,
  ApplicationStatus,
  CreateGrantRequest,
  SubmitApplicationRequest,
} from './models';

export class GrantService {
  private db: Database;

  constructor() {
    this.db = Database.getInstance();
  }

  async createGrant(request: CreateGrantRequest, userId: string): Promise<Grant> {
    try {
      // Generate unique grant ID
      const grantId = `GRANT-${randomUUID().substring(0, 8).toUpperCase()}`;

      const grant: Grant = {
        id: grantId,
        title: request.title,
        description: request.description,
        fundingAmount: request.fundingAmount,
        currency: request.currency || 'USD',
        deadline: new Date(request.deadline),
        eligibilityCriteria: request.eligibilityCriteria || [],
        complianceRequirements: request.complianceRequirements || [],
        status: 'draft',
        createdBy: userId,
        createdAt: new Date(),
        updatedAt: new Date(),
        metadata: request.metadata || {},
      };

      // Save to database
      await this.db.saveGrant(grant);

      logger.info('Grant created', {
        grantId,
        userId,
        title: grant.title,
      });

      return grant;
    } catch (error) {
      logger.error('Failed to create grant', { error, userId });
      throw new Error('Failed to create grant');
    }
  }

  async getGrant(grantId: string): Promise<Grant | null> {
    try {
      const grant = await this.db.getGrant(grantId);
      
      if (!grant) {
        return null;
      }

      // Check if grant is accessible
      if (grant.status === 'draft') {
        // Only admins and creators can view draft grants
        // This check should be done at the controller level
      }

      return grant;
    } catch (error) {
      logger.error('Failed to retrieve grant', { grantId, error });
      throw new Error('Failed to retrieve grant');
    }
  }

  async listGrants(options: {
    page?: number;
    limit?: number;
    status?: GrantStatus;
    organizationId?: string;
  }): Promise<{ grants: Grant[]; total: number }> {
    try {
      const page = options.page || 1;
      const limit = options.limit || 20;
      const offset = (page - 1) * limit;

      const { grants, total } = await this.db.listGrants({
        status: options.status,
        organizationId: options.organizationId,
        limit,
        offset,
      });

      return { grants, total };
    } catch (error) {
      logger.error('Failed to list grants', { error });
      throw new Error('Failed to list grants');
    }
  }

  async submitApplication(
    grantId: string,
    request: SubmitApplicationRequest,
    userId: string
  ): Promise<GrantApplication> {
    try {
      // Verify grant exists and is open
      const grant = await this.getGrant(grantId);
      if (!grant) {
        throw new Error('Grant not found');
      }

      if (grant.status !== 'open') {
        throw new Error('Grant is not accepting applications');
      }

      if (grant.deadline < new Date()) {
        throw new Error('Grant application deadline has passed');
      }

      // Check if user has already applied
      const existingApplication = await this.db.getUserApplicationForGrant(
        grantId,
        userId
      );

      if (existingApplication) {
        throw new Error('User has already applied for this grant');
      }

      // Generate application ID
      const applicationId = `APP-${randomUUID().substring(0, 8).toUpperCase()}`;

      const application: GrantApplication = {
        id: applicationId,
        grantId,
        applicantId: userId,
        organizationId: request.organizationId,
        data: request.data,
        attachments: request.attachments || [],
        status: 'submitted',
        submittedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        metadata: request.metadata || {},
      };

      // Save application
      await this.db.saveApplication(application);

      // Log submission
      logger.info('Grant application submitted', {
        applicationId,
        grantId,
        userId,
        organizationId: request.organizationId,
      });

      // Trigger compliance check
      await this.triggerComplianceCheck(applicationId);

      return application;
    } catch (error) {
      logger.error('Failed to submit application', {
        grantId,
        userId,
        error: error.message,
      });
      throw error;
    }
  }

  async getApplication(applicationId: string, userId: string): Promise<GrantApplication | null> {
    try {
      const application = await this.db.getApplication(applicationId);
      
      if (!application) {
        return null;
      }

      // Check access permissions
      const hasAccess = await this.checkApplicationAccess(application, userId);
      if (!hasAccess) {
        throw new Error('Access denied');
      }

      return application;
    } catch (error) {
      logger.error('Failed to retrieve application', { applicationId, error });
      throw new Error('Failed to retrieve application');
    }
  }

  async updateApplicationStatus(
    applicationId: string,
    status: ApplicationStatus,
    reviewerId: string,
    notes?: string
  ): Promise<GrantApplication> {
    try {
      const application = await this.db.getApplication(applicationId);
      if (!application) {
        throw new Error('Application not found');
      }

      // Validate status transition
      this.validateStatusTransition(application.status, status);

      // Update application
      application.status = status;
      application.updatedAt = new Date();

      if (notes) {
        application.reviewNotes = application.reviewNotes || [];
        application.reviewNotes.push({
          reviewerId,
          notes,
          timestamp: new Date(),
        });
      }

      await this.db.saveApplication(application);

      // Log status change
      logger.info('Application status updated', {
        applicationId,
        oldStatus: application.status,
        newStatus: status,
        reviewerId,
      });

      // Trigger workflow if needed
      if (status === 'approved' || status === 'rejected') {
        await this.triggerWorkflow(applicationId, status);
      }

      return application;
    } catch (error) {
      logger.error('Failed to update application status', {
        applicationId,
        status,
        reviewerId,
        error,
      });
      throw error;
    }
  }

  async getApplicationStatistics(grantId: string): Promise<{
    total: number;
    byStatus: Record<ApplicationStatus, number>;
    byOrganization: Record<string, number>;
  }> {
    try {
      return await this.db.getApplicationStatistics(grantId);
    } catch (error) {
      logger.error('Failed to get application statistics', { grantId, error });
      throw new Error('Failed to get application statistics');
    }
  }

  private async checkApplicationAccess(
    application: GrantApplication,
    userId: string
  ): Promise<boolean> {
    // Check if user is the applicant
    if (application.applicantId === userId) {
      return true;
    }

    // Check if user is a grant manager
    const user = await this.db.getUser(userId);
    if (user?.roles.includes('grant_manager')) {
      return true;
    }

    // Check if user is in the same organization
    if (application.organizationId && user?.organizationId === application.organizationId) {
      return true;
    }

    return false;
  }

  private validateStatusTransition(
    currentStatus: ApplicationStatus,
    newStatus: ApplicationStatus
  ): void {
    const validTransitions: Record<ApplicationStatus, ApplicationStatus[]> = {
      draft: ['submitted', 'cancelled'],
      submitted: ['under_review', 'cancelled'],
      under_review: ['approved', 'rejected', 'needs_revision'],
      needs_revision: ['resubmitted', 'cancelled'],
      resubmitted: ['under_review', 'cancelled'],
      approved: ['funded'],
      rejected: [],
      cancelled: [],
      funded: [],
    };

    if (!validTransitions[currentStatus]?.includes(newStatus)) {
      throw new Error(`Invalid status transition from ${currentStatus} to ${newStatus}`);
    }
  }

  private async triggerComplianceCheck(applicationId: string): Promise<void> {
    // Implementation depends on your compliance service
    // This could be a message queue, direct API call, or database trigger
    logger.info('Compliance check triggered', { applicationId });
  }

  private async triggerWorkflow(applicationId: string, status: ApplicationStatus): Promise<void> {
    // Implementation depends on your workflow service
    logger.info('Workflow triggered', { applicationId, status });
  }
      }
