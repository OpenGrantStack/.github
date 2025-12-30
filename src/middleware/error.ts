import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';

interface AppError extends Error {
  statusCode?: number;
  code?: string;
  details?: Record<string, any>;
}

export const errorHandler = (
  error: AppError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  console.error(`[Error] ${req.method} ${req.url}:`, {
    message: error.message,
    stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    details: error.details,
  });

  // Zod validation errors
  if (error instanceof ZodError) {
    return res.status(400).json({
      error: 'Validation failed',
      details: error.errors.map(err => ({
        field: err.path.join('.'),
        message: err.message,
      })),
    });
  }

  // Prisma errors
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    switch (error.code) {
      case 'P2002':
        return res.status(409).json({
          error: 'Duplicate entry',
          fields: error.meta?.target,
        });
      case 'P2025':
        return res.status(404).json({
          error: 'Record not found',
        });
      default:
        return res.status(500).json({
          error: 'Database error',
          code: error.code,
        });
    }
  }

  // Custom application errors
  if (error.statusCode) {
    return res.status(error.statusCode).json({
      error: error.message,
      code: error.code,
      details: error.details,
    });
  }

  // Default server error
  const statusCode = 500;
  const response: Record<string, any> = {
    error: 'Internal server error',
  };

  if (process.env.NODE_ENV === 'development') {
    response.stack = error.stack;
    response.message = error.message;
  }

  return res.status(statusCode).json(response);
};

// Utility function to create standardized errors
export const createError = (
  message: string,
  statusCode: number = 500,
  details?: Record<string, any>
): AppError => {
  const error = new Error(message) as AppError;
  error.statusCode = statusCode;
  error.details = details;
  return error;
};

// Common error types
export const Errors = {
  NOT_FOUND: (resource: string = 'Resource') => 
    createError(`${resource} not found`, 404),
  UNAUTHORIZED: () => 
    createError('Authentication required', 401),
  FORBIDDEN: () => 
    createError('Insufficient permissions', 403),
  BAD_REQUEST: (message: string = 'Invalid request') => 
    createError(message, 400),
  CONFLICT: (message: string = 'Resource conflict') => 
    createError(message, 409),
  VALIDATION: (details: Record<string, any>) => 
    createError('Validation failed', 400, details),
};
