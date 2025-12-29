import { CreateGrantRequest, SubmitApplicationRequest } from './models';
import { validate as validateUUID } from 'uuid';

export function validateGrantCreation(data: CreateGrantRequest): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Title validation
  if (!data.title || data.title.trim().length === 0) {
    errors.push('Title is required');
  } else if (data.title.length > 200) {
    errors.push('Title must be less than 200 characters');
  }

  // Funding amount validation
  if (typeof data.fundingAmount !== 'number' || data.fundingAmount <= 0) {
    errors.push('Funding amount must be a positive number');
  } else if (data.fundingAmount > 1000000000) {
    errors.push('Funding amount cannot exceed 1,000,000,000');
  }

  // Deadline validation
  if (!data.deadline) {
    errors.push('Deadline is required');
  } else {
    const deadline = new Date(data.deadline);
    const now = new Date();
    
    if (isNaN(deadline.getTime())) {
      errors.push('Invalid deadline date');
    } else if (deadline <= now) {
      errors.push('Deadline must be in the future');
    } else if (deadline > new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000)) {
      errors.push('Deadline cannot be more than one year in the future');
    }
  }

  // Currency validation
  if (data.currency && !/^[A-Z]{3}$/.test(data.currency)) {
    errors.push('Currency must be a valid 3-letter ISO code');
  }

  // Eligibility criteria validation
  if (data.eligibilityCriteria) {
    if (!Array.isArray(data.eligibilityCriteria)) {
      errors.push('Eligibility criteria must be an array');
    } else {
      data.eligibilityCriteria.forEach((criteria, index) => {
        if (typeof criteria !== 'string' || criteria.trim().length === 0) {
          errors.push(`Eligibility criteria at index ${index} must be a non-empty string`);
        } else if (criteria.length > 1000) {
          errors.push(`Eligibility criteria at index ${index} must be less than 1000 characters`);
        }
      });
    }
  }

  // Metadata validation
  if (data.metadata) {
    if (typeof data.metadata !== 'object' || Array.isArray(data.metadata)) {
      errors.push('Metadata must be an object');
    } else {
      const metadataStr = JSON.stringify(data.metadata);
      if (metadataStr.length > 10000) {
        errors.push('Metadata size exceeds limit');
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

export function validateGrantApplication(data: SubmitApplicationRequest): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Organization ID validation (if provided)
  if (data.organizationId && !validateUUID(data.organizationId)) {
    errors.push('Invalid organization ID format');
  }

  // Data validation
  if (!data.data || typeof data.data !== 'object' || Array.isArray(data.data)) {
    errors.push('Application data must be an object');
  } else {
    const dataStr = JSON.stringify(data.data);
    if (dataStr.length > 50000) {
      errors.push('Application data size exceeds limit');
    }

    // Validate required fields if they exist
    const requiredFields = ['projectTitle', 'projectDescription', 'budget'];
    requiredFields.forEach(field => {
      if (!data.data[field]) {
        errors.push(`Missing required field: ${field}`);
      }
    });

    // Budget validation
    if (data.data.budget) {
      if (typeof data.data.budget !== 'number' || data.data.budget <= 0) {
        errors.push('Budget must be a positive number');
      } else if (data.data.budget > 10000000) {
        errors.push('Budget cannot exceed 10,000,000');
      }
    }
  }

  // Attachments validation
  if (data.attachments) {
    if (!Array.isArray(data.attachments)) {
      errors.push('Attachments must be an array');
    } else {
      const maxAttachments = 10;
      const maxTotalSize = 50 * 1024 * 1024; // 50 MB
      let totalSize = 0;

      if (data.attachments.length > maxAttachments) {
        errors.push(`Cannot have more than ${maxAttachments} attachments`);
      }

      data.attachments.forEach((attachment, index) => {
        if (!attachment.name || attachment.name.trim().length === 0) {
          errors.push(`Attachment at index ${index} must have a name`);
        }

        if (!attachment.type || !isValidMimeType(attachment.type)) {
          errors.push(`Attachment at index ${index} has invalid MIME type`);
        }

        if (!attachment.url || !isValidUrl(attachment.url)) {
          errors.push(`Attachment at index ${index} has invalid URL`);
        }

        if (attachment.size && attachment.size > 10 * 1024 * 1024) {
          errors.push(`Attachment at index ${index} exceeds 10MB size limit`);
        }

        if (attachment.size) {
          totalSize += attachment.size;
        }
      });

      if (totalSize > maxTotalSize) {
        errors.push(`Total attachment size exceeds ${maxTotalSize / (1024 * 1024)}MB limit`);
      }
    }
  }

  // Metadata validation
  if (data.metadata) {
    if (typeof data.metadata !== 'object' || Array.isArray(data.metadata)) {
      errors.push('Metadata must be an object');
    } else {
      const metadataStr = JSON.stringify(data.metadata);
      if (metadataStr.length > 5000) {
        errors.push('Metadata size exceeds limit');
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

export function validateGrantId(grantId: string): boolean {
  if (!grantId || typeof grantId !== 'string') {
    return false;
  }

  // Grant ID format: GRANT-XXXXXXX or custom format
  return /^[A-Z0-9-]+$/.test(grantId);
}

export function validateApplicationId(applicationId: string): boolean {
  if (!applicationId || typeof applicationId !== 'string') {
    return false;
  }

  // Application ID format: APP-XXXXXXX
  return /^APP-[A-Z0-9]+$/.test(applicationId);
}

function isValidMimeType(mimeType: string): boolean {
  const validTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'image/jpeg',
    'image/png',
    'image/gif',
    'text/plain',
    'text/csv',
  ];

  return validTypes.includes(mimeType.toLowerCase());
}

function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return ['http:', 'https:'].includes(parsed.protocol);
  } catch {
    return false;
  }
  }
