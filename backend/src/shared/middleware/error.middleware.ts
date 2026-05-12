import { Request, Response, NextFunction } from 'express';
import { env } from '../../config/env';

// ============================================================
// Global Error Handler Middleware — Juhnios Rold Backend
// ============================================================

export class AppError extends Error {
  constructor(
    public message: string,
    public statusCode: number = 500,
    public errors?: string[]
  ) {
    super(message);
    this.name = 'AppError';
    Error.captureStackTrace(this, this.constructor);
  }
}

export class NotFoundError extends AppError {
  constructor(entity = 'Resource') {
    super(`${entity} not found`, 404);
    this.name = 'NotFoundError';
  }
}

export class ValidationError extends AppError {
  constructor(message: string, errors?: string[]) {
    super(message, 400, errors);
    this.name = 'ValidationError';
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super(message, 401);
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') {
    super(message, 403);
    this.name = 'ForbiddenError';
  }
}

const getDatabaseErrorCode = (err: Error): string | undefined =>
  (err as unknown as { code?: string }).code;

// ---- 404 handler (place before error handler) ----
export const notFoundHandler = (req: Request, res: Response): void => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
};

// ---- Global error handler ----
export const globalErrorHandler = (
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  console.error(`[ERROR] ${err.name}: ${err.message}`);
  if (env.NODE_ENV === 'development') {
    console.error(err.stack);
  }

  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      message: err.message,
      errors: err.errors,
    });
    return;
  }

  // PostgreSQL errors
  const databaseErrorCode = getDatabaseErrorCode(err);

  if (databaseErrorCode === '23505') {
    res.status(409).json({
      success: false,
      message: 'A record with this data already exists (duplicate key)',
    });
    return;
  }

  if (databaseErrorCode === '23503') {
    res.status(400).json({
      success: false,
      message: 'Referenced resource does not exist (foreign key violation)',
    });
    return;
  }

  // Fallback
  res.status(500).json({
    success: false,
    message: env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
  });
};
