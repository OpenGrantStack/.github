export { GrantReadyClient } from './client';
export * from './types';

// Re-export types for convenience
export type {
  Grant,
  GrantApplication,
  ComplianceCheck,
  WorkflowInstance,
  Task,
  AuthTokens,
  UserSession,
} from './types';

// Configuration interface
export interface GrantReadyConfig {
  baseUrl: string;
  apiKey?: string;
  accessToken?: string;
  timeout?: number;
  maxRetries?: number;
  headers?: Record<string, string>;
}

// Default configuration
export const DEFAULT_CONFIG: Partial<GrantReadyConfig> = {
  timeout: 30000,
  maxRetries: 3,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
};

// Version info
export const VERSION = '1.0.0';
export const SDK_NAME = '@grantready/cloud-sdk';
