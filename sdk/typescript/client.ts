import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { GrantReadyConfig, DEFAULT_CONFIG } from './index';
import {
  Grant,
  GrantApplication,
  ComplianceCheckRequest,
  ComplianceCheckResult,
  WorkflowInstance,
  Task,
  AuthTokens,
  UserCredentials,
  CreateGrantRequest,
  SubmitApplicationRequest,
  ApiResponse,
  PaginatedResponse,
} from './types';

export class GrantReadyClient {
  private client: AxiosInstance;
  private config: GrantReadyConfig;
  private accessToken?: string;
  private refreshToken?: string;

  constructor(config: GrantReadyConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.accessToken = config.accessToken;
    
    this.client = axios.create({
      baseURL: `${this.config.baseUrl}/v1`,
      timeout: this.config.timeout,
      headers: {
        ...this.config.headers,
        ...(this.config.apiKey && { 'X-API-Key': this.config.apiKey }),
        ...(this.accessToken && { Authorization: `Bearer ${this.accessToken}` }),
      },
    });

    this.setupInterceptors();
  }

  private setupInterceptors(): void {
    // Request interceptor
    this.client.interceptors.request.use(
      (config) => {
        // Add request ID for tracing
        config.headers['X-Request-ID'] = this.generateRequestId();
        config.headers['X-Client-Version'] = '1.0.0';
        
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Response interceptor
    this.client.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;

        // Handle token refresh
        if (
          error.response?.status === 401 &&
          !originalRequest._retry &&
          this.refreshToken
        ) {
          originalRequest._retry = true;
          
          try {
            const tokens = await this.refreshAuthToken(this.refreshToken);
            this.setTokens(tokens);
            
            // Retry original request
            originalRequest.headers.Authorization = `Bearer ${tokens.accessToken}`;
            return this.client(originalRequest);
          } catch (refreshError) {
            // Refresh failed, clear tokens
            this.clearTokens();
            return Promise.reject(refreshError);
          }
        }

        // Handle rate limiting
        if (error.response?.status === 429) {
          const retryAfter = error.response.headers['retry-after'];
          if (retryAfter) {
            await this.delay(parseInt(retryAfter) * 1000);
            return this.client(originalRequest);
          }
        }

        return Promise.reject(error);
      }
    );
  }

  // Authentication methods
  async authenticate(credentials: UserCredentials): Promise<AuthTokens> {
    const response = await this.client.post<ApiResponse<AuthTokens>>(
      '/auth/login',
      credentials
    );
    
    const tokens = response.data.data;
    this.setTokens(tokens);
    
    return tokens;
  }

  async refreshAuthToken(refreshToken: string): Promise<AuthTokens> {
    const response = await this.client.post<ApiResponse<AuthTokens>>(
      '/auth/refresh',
      {},
      {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
        },
      }
    );
    
    const tokens = response.data.data;
    this.setTokens(tokens);
    
    return tokens;
  }

  async logout(): Promise<void> {
    if (!this.accessToken) return;

    try {
      await this.client.post(
        '/auth/logout',
        {
          refreshToken: this.refreshToken,
        },
        {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
          },
        }
      );
    } finally {
      this.clearTokens();
    }
  }

  setTokens(tokens: AuthTokens): void {
    this.accessToken = tokens.accessToken;
    this.refreshToken = tokens.refreshToken;
    
    // Update axios instance headers
    this.client.defaults.headers.common['Authorization'] = `Bearer ${tokens.accessToken}`;
  }

  clearTokens(): void {
    this.accessToken = undefined;
    this.refreshToken = undefined;
    delete this.client.defaults.headers.common['Authorization'];
  }

  // Grant methods
  async createGrant(request: CreateGrantRequest): Promise<Grant> {
    const response = await this.client.post<ApiResponse<Grant>>(
      '/grants',
      request
    );
    return response.data.data;
  }

  async getGrant(grantId: string): Promise<Grant> {
    const response = await this.client.get<ApiResponse<Grant>>(
      `/grants/${grantId}`
    );
    return response.data.data;
  }

  async listGrants(options?: {
    page?: number;
    limit?: number;
    status?: string;
  }): Promise<PaginatedResponse<Grant>> {
    const response = await this.client.get<ApiResponse<PaginatedResponse<Grant>>>(
      '/grants',
      { params: options }
    );
    return response.data.data;
  }

  // Application methods
  async submitApplication(
    grantId: string,
    request: SubmitApplicationRequest
  ): Promise<GrantApplication> {
    const response = await this.client.post<ApiResponse<GrantApplication>>(
      `/grants/${grantId}/applications`,
      request
    );
    return response.data.data;
  }

  async getApplication(applicationId: string): Promise<GrantApplication> {
    const response = await this.client.get<ApiResponse<GrantApplication>>(
      `/applications/${applicationId}`
    );
    return response.data.data;
  }

  async listApplications(options?: {
    grantId?: string;
    status?: string;
    page?: number;
    limit?: number;
  }): Promise<PaginatedResponse<GrantApplication>> {
    const response = await this.client.get<ApiResponse<PaginatedResponse<GrantApplication>>>(
      '/applications',
      { params: options }
    );
    return response.data.data;
  }

  // Compliance methods
  async runComplianceCheck(
    request: ComplianceCheckRequest
  ): Promise<ComplianceCheckResult> {
    const response = await this.client.post<ApiResponse<ComplianceCheckResult>>(
      '/compliance/checks',
      request
    );
    return response.data.data;
  }

  async getComplianceHistory(
    entityId: string,
    entityType: string,
    limit?: number
  ): Promise<any[]> {
    const response = await this.client.get<ApiResponse<any[]>>(
      `/compliance/history/${entityType}/${entityId}`,
      { params: { limit } }
    );
    return response.data.data;
  }

  // Workflow methods
  async executeWorkflow(request: {
    workflowId: string;
    entityId: string;
    entityType: string;
    variables?: Record<string, any>;
  }): Promise<WorkflowInstance> {
    const response = await this.client.post<ApiResponse<WorkflowInstance>>(
      '/workflows/execute',
      request
    );
    return response.data.data;
  }

  async getWorkflowInstance(instanceId: string): Promise<WorkflowInstance> {
    const response = await this.client.get<ApiResponse<WorkflowInstance>>(
      `/workflows/instances/${instanceId}`
    );
    return response.data.data;
  }

  async updateWorkflowStep(
    instanceId: string,
    stepId: string,
    status: string,
    result?: any
  ): Promise<void> {
    await this.client.put(
      `/workflows/instances/${instanceId}/steps/${stepId}`,
      { status, result }
    );
  }

  // Task methods
  async getTask(taskId: string): Promise<Task> {
    const response = await this.client.get<ApiResponse<Task>>(
      `/tasks/${taskId}`
    );
    return response.data.data;
  }

  async listTasks(options?: {
    status?: string;
    assignee?: string;
    page?: number;
    limit?: number;
  }): Promise<PaginatedResponse<Task>> {
    const response = await this.client.get<ApiResponse<PaginatedResponse<Task>>>(
      '/tasks',
      { params: options }
    );
    return response.data.data;
  }

  async updateTaskStatus(
    taskId: string,
    status: string,
    comments?: string
  ): Promise<Task> {
    const response = await this.client.put<ApiResponse<Task>>(
      `/tasks/${taskId}/status`,
      { status, comments }
    );
    return response.data.data;
  }

  async submitTaskApproval(
    taskId: string,
    decision: 'approve' | 'reject',
    comments?: string
  ): Promise<Task> {
    const response = await this.client.post<ApiResponse<Task>>(
      `/tasks/${taskId}/approval`,
      { decision, comments }
    );
    return response.data.data;
  }

  // Utility methods
  async healthCheck(): Promise<boolean> {
    try {
      await this.client.get('/health');
      return true;
    } catch {
      return false;
    }
  }

  async getApiStatus(): Promise<any> {
    const response = await this.client.get('/status');
    return response.data;
  }

  // Helper methods
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Request customization
  setHeader(key: string, value: string): void {
    this.client.defaults.headers.common[key] = value;
  }

  removeHeader(key: string): void {
    delete this.client.defaults.headers.common[key];
  }

  // Error handling wrapper
  async withRetry<T>(
    operation: () => Promise<T>,
    maxRetries: number = this.config.maxRetries || 3
  ): Promise<T> {
    let lastError: Error;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        
        // Don't retry on 4xx errors (except 429 which is handled by interceptor)
        if (axios.isAxiosError(error) && error.response?.status && error.response.status < 500) {
          throw error;
        }

        // Exponential backoff
        if (attempt < maxRetries - 1) {
          const delay = Math.pow(2, attempt) * 1000;
          await this.delay(delay);
        }
      }
    }

    throw lastError!;
  }
      }
