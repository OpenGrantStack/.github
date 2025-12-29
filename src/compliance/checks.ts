import { logger } from '../shared/logging';
import { Database } from '../shared/database';
import { STANDARDS, ComplianceStandard } from './standards';

export interface ComplianceCheck {
  id: string;
  entityId: string;
  entityType: 'application' | 'applicant' | 'grant' | 'organization';
  checkType: string;
  standard: string;
  requirement: string;
  status: 'pending' | 'passed' | 'failed' | 'warning';
  details?: Record<string, any>;
  checkedAt: Date;
  checkedBy: string; // system or user ID
  expiresAt?: Date;
  metadata?: Record<string, any>;
}

export interface CheckResult {
  passed: boolean;
  warnings: string[];
  errors: string[];
  details: Record<string, any>;
  requiredActions?: string[];
}

export interface ComplianceCheckRequest {
  entityId: string;
  entityType: 'application' | 'applicant' | 'grant' | 'organization';
  checkTypes?: string[];
  standards?: string[];
  forceRefresh?: boolean;
}

export class ComplianceService {
  private db: Database;

  constructor() {
    this.db = Database.getInstance();
  }

  async runComplianceCheck(request: ComplianceCheckRequest): Promise<{
    results: Record<string, CheckResult>;
    overallStatus: 'passed' | 'failed' | 'warning';
    checksPerformed: number;
  }> {
    try {
      const { entityId, entityType, checkTypes, standards, forceRefresh } = request;

      // Get applicable standards
      const applicableStandards = this.getApplicableStandards(
        entityType,
        standards
      );

      // Determine which checks to run
      const checksToRun = this.determineChecksToRun(
        applicableStandards,
        checkTypes
      );

      // Run checks
      const results: Record<string, CheckResult> = {};
      let passedChecks = 0;
      let failedChecks = 0;
      let warningChecks = 0;

      for (const check of checksToRun) {
        const result = await this.runSingleCheck(entityId, entityType, check);
        results[check.id] = result;

        // Store check result
        await this.storeCheckResult(entityId, entityType, check, result);

        // Count results
        if (result.passed) {
          passedChecks++;
        } else if (result.errors.length > 0) {
          failedChecks++;
        } else if (result.warnings.length > 0) {
          warningChecks++;
        }
      }

      // Determine overall status
      let overallStatus: 'passed' | 'failed' | 'warning' = 'passed';
      if (failedChecks > 0) {
        overallStatus = 'failed';
      } else if (warningChecks > 0) {
        overallStatus = 'warning';
      }

      logger.info('Compliance check completed', {
        entityId,
        entityType,
        checksPerformed: checksToRun.length,
        passedChecks,
        failedChecks,
        warningChecks,
        overallStatus,
      });

      return {
        results,
        overallStatus,
        checksPerformed: checksToRun.length,
      };
    } catch (error) {
      logger.error('Compliance check failed', { request, error });
      throw new Error('Failed to run compliance check');
    }
  }

  async getCheckHistory(
    entityId: string,
    entityType: string,
    limit: number = 10
  ): Promise<ComplianceCheck[]> {
    try {
      return await this.db.getComplianceChecks(entityId, entityType, limit);
    } catch (error) {
      logger.error('Failed to get compliance check history', {
        entityId,
        entityType,
        error,
      });
      throw new Error('Failed to get compliance check history');
    }
  }

  async validateAgainstStandard(
    entityId: string,
    entityType: string,
    standardId: string
  ): Promise<CheckResult> {
    try {
      const standard = STANDARDS.find(s => s.id === standardId);
      if (!standard) {
        throw new Error(`Standard not found: ${standardId}`);
      }

      // Check if this standard applies to the entity type
      if (!standard.appliesTo.includes(entityType)) {
        throw new Error(
          `Standard ${standardId} does not apply to ${entityType}`
        );
      }

      // Run all requirements for this standard
      const aggregatedResult: CheckResult = {
        passed: true,
        warnings: [],
        errors: [],
        details: {},
        requiredActions: [],
      };

      for (const requirement of standard.requirements) {
        const requirementResult = await this.checkRequirement(
          entityId,
          entityType,
          requirement
        );

        // Aggregate results
        aggregatedResult.passed = aggregatedResult.passed && requirementResult.passed;
        aggregatedResult.warnings.push(...requirementResult.warnings);
        aggregatedResult.errors.push(...requirementResult.errors);
        aggregatedResult.details[requirement.id] = requirementResult.details;
        
        if (requirementResult.requiredActions) {
          aggregatedResult.requiredActions!.push(...requirementResult.requiredActions);
        }
      }

      return aggregatedResult;
    } catch (error) {
      logger.error('Standard validation failed', {
        entityId,
        entityType,
        standardId,
        error,
      });
      throw error;
    }
  }

  async scheduleRecurringCheck(
    entityId: string,
    entityType: string,
    checkType: string,
    intervalDays: number
  ): Promise<string> {
    try {
      const scheduleId = `SCHED-${Date.now()}-${Math.random()
        .toString(36)
        .substr(2, 9)}`;

      await this.db.saveComplianceSchedule({
        id: scheduleId,
        entityId,
        entityType,
        checkType,
        intervalDays,
        nextRun: new Date(Date.now() + intervalDays * 24 * 60 * 60 * 1000),
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      logger.info('Recurring compliance check scheduled', {
        scheduleId,
        entityId,
        entityType,
        checkType,
        intervalDays,
      });

      return scheduleId;
    } catch (error) {
      logger.error('Failed to schedule recurring check', {
        entityId,
        entityType,
        checkType,
        intervalDays,
        error,
      });
      throw new Error('Failed to schedule recurring check');
    }
  }

  private getApplicableStandards(
    entityType: string,
    requestedStandards?: string[]
  ): ComplianceStandard[] {
    let standards = STANDARDS.filter(standard =>
      standard.appliesTo.includes(entityType)
    );

    if (requestedStandards && requestedStandards.length > 0) {
      standards = standards.filter(standard =>
        requestedStandards.includes(standard.id)
      );
    }

    return standards;
  }

  private determineChecksToRun(
    standards: ComplianceStandard[],
    requestedCheckTypes?: string[]
  ): Array<{ id: string; type: string; requirement: any }> {
    const checks: Array<{ id: string; type: string; requirement: any }> = [];

    for (const standard of standards) {
      for (const requirement of standard.requirements) {
        // Check if this check type should be run
        if (
          requestedCheckTypes &&
          requestedCheckTypes.length > 0 &&
          !requestedCheckTypes.includes(requirement.checkType)
        ) {
          continue;
        }

        checks.push({
          id: `${standard.id}:${requirement.id}`,
          type: requirement.checkType,
          requirement,
        });
      }
    }

    return checks;
  }

  private async runSingleCheck(
    entityId: string,
    entityType: string,
    check: { id: string; type: string; requirement: any }
  ): Promise<CheckResult> {
    const { requirement } = check;

    try {
      // Determine which check function to call based on check type
      switch (requirement.checkType) {
        case 'sanctions':
          return await this.runSanctionsCheck(entityId, entityType, requirement);
        case 'eligibility':
          return await this.runEligibilityCheck(entityId, entityType, requirement);
        case 'completeness':
          return await this.runCompletenessCheck(entityId, entityType, requirement);
        case 'risk':
          return await this.runRiskAssessment(entityId, entityType, requirement);
        case 'document_validation':
          return await this.runDocumentValidation(entityId, entityType, requirement);
        default:
          throw new Error(`Unknown check type: ${requirement.checkType}`);
      }
    } catch (error) {
      logger.error('Check execution failed', {
        entityId,
        entityType,
        checkId: check.id,
        error,
      });

      return {
        passed: false,
        warnings: [],
        errors: [`Check execution failed: ${error.message}`],
        details: { error: error.message },
      };
    }
  }

  private async runSanctionsCheck(
    entityId: string,
    entityType: string,
    requirement: any
  ): Promise<CheckResult> {
    // Implementation depends on your sanctions screening service
    // This would typically integrate with WorldCheck, LexisNexis, etc.
    
    const result: CheckResult = {
      passed: true,
      warnings: [],
      errors: [],
      details: {},
    };

    // Mock implementation - replace with real integration
    const mockSanctionsList = ['SANCTIONED_ENTITY_1', 'SANCTIONED_ENTITY_2'];
    const entity = await this.db.getEntity(entityId, entityType);

    if (entity) {
      // Check entity name against sanctions list
      const entityName = entity.name || '';
      const isSanctioned = mockSanctionsList.some(sanctioned =>
        entityName.toLowerCase().includes(sanctioned.toLowerCase())
      );

      if (isSanctioned) {
        result.passed = false;
        result.errors.push('Entity matches sanctions list');
        result.details.matchFound = true;
        result.details.matchedTerm = 'SANCTIONED_ENTITY';
      }
    }

    return result;
  }

  private async runEligibilityCheck(
    entityId: string,
    entityType: string,
    requirement: any
  ): Promise<CheckResult> {
    // Check if entity meets eligibility criteria
    const result: CheckResult = {
      passed: true,
      warnings: [],
      errors: [],
      details: {},
    };

    // Implementation depends on your data model
    // This would check criteria like:
    // - Organization type
    // - Location restrictions
    // - Previous grant history
    // - Financial stability

    return result;
  }

  private async runCompletenessCheck(
    entityId: string,
    entityType: string,
    requirement: any
  ): Promise<CheckResult> {
    // Check if all required information is provided
    const result: CheckResult = {
      passed: true,
      warnings: [],
      errors: [],
      details: {},
    };

    const requiredFields = requirement.requiredFields || [];
    const entity = await this.db.getEntity(entityId, entityType);

    if (entity) {
      const missingFields: string[] = [];

      for (const field of requiredFields) {
        if (
          entity[field] === undefined ||
          entity[field] === null ||
          entity[field] === ''
        ) {
          missingFields.push(field);
        }
      }

      if (missingFields.length > 0) {
        result.passed = false;
        result.errors.push(`Missing required fields: ${missingFields.join(', ')}`);
        result.details.missingFields = missingFields;
      }
    }

    return result;
  }

  private async runRiskAssessment(
    entityId: string,
    entityType: string,
    requirement: any
  ): Promise<CheckResult> {
    // Perform risk assessment
    const result: CheckResult = {
      passed: true,
      warnings: [],
      errors: [],
      details: { riskScore: 0 },
    };

    // Calculate risk score based on various factors
    let riskScore = 0;

    // Example risk factors:
    // - New entity (higher risk)
    // - Large funding request (higher risk)
    // - Previous compliance issues (higher risk)
    // - Strong financials (lower risk)

    result.details.riskScore = riskScore;

    if (riskScore > requirement.threshold) {
      result.passed = false;
      result.errors.push(`Risk score ${riskScore} exceeds threshold ${requirement.threshold}`);
      result.requiredActions = ['MANUAL_REVIEW_REQUIRED'];
    } else if (riskScore > requirement.warningThreshold) {
      result.warnings.push(`Risk score ${riskScore} is above warning threshold`);
    }

    return result;
  }

  private async runDocumentValidation(
    entityId: string,
    entityType: string,
    requirement: any
  ): Promise<CheckResult> {
    // Validate required documents
    const result: CheckResult = {
      passed: true,
      warnings: [],
      errors: [],
      details: {},
    };

    const requiredDocuments = requirement.requiredDocuments || [];
    const documents = await this.db.getEntityDocuments(entityId, entityType);

    const missingDocuments: string[] = [];
    const invalidDocuments: string[] = [];

    for (const docType of requiredDocuments) {
      const document = documents.find(d => d.type === docType);

      if (!document) {
        missingDocuments.push(docType);
      } else if (document.status !== 'valid') {
        invalidDocuments.push(docType);
      }
    }

    if (missingDocuments.length > 0) {
      result.passed = false;
      result.errors.push(`Missing documents: ${missingDocuments.join(', ')}`);
      result.details.missingDocuments = missingDocuments;
    }

    if (invalidDocuments.length > 0) {
      result.warnings.push(`Invalid documents: ${invalidDocuments.join(', ')}`);
      result.details.invalidDocuments = invalidDocuments;
    }

    return result;
  }

  private async checkRequirement(
    entityId: string,
    entityType: string,
    requirement: any
  ): Promise<CheckResult> {
    // Implementation for checking specific requirements
    // This would be similar to runSingleCheck but for individual requirements
    return {
      passed: true,
      warnings: [],
      errors: [],
      details: {},
    };
  }

  private async storeCheckResult(
    entityId: string,
    entityType: string,
    check: { id: string; type: string; requirement: any },
    result: CheckResult
  ): Promise<void> {
    const complianceCheck: ComplianceCheck = {
      id: `CHECK-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      entityId,
      entityType,
      checkType: check.type,
      standard: check.requirement.standard,
      requirement: check.requirement.id,
      status: result.passed ? 'passed' : 'failed',
      details: result.details,
      checkedAt: new Date(),
      checkedBy: 'system',
      metadata: {
        warnings: result.warnings,
        errors: result.errors,
        requiredActions: result.requiredActions,
      },
    };

    await this.db.saveComplianceCheck(complianceCheck);
  }
        }
