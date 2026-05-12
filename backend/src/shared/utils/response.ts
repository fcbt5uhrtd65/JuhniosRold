import { Response } from 'express';
import { ApiResponse, PaginatedResult } from '../types';

// ============================================================
// HTTP Response Helpers — Juhnios Rold Backend
// ============================================================

export const sendSuccess = <T>(
  res: Response,
  data: T,
  message = 'Success',
  statusCode = 200,
  meta?: Record<string, unknown>
): Response => {
  const response: ApiResponse<T> = { success: true, message, data, meta };
  return res.status(statusCode).json(response);
};

export const sendCreated = <T>(
  res: Response,
  data: T,
  message = 'Resource created successfully'
): Response => sendSuccess(res, data, message, 201);

export const sendError = (
  res: Response,
  message: string,
  statusCode = 500,
  errors?: string[]
): Response => {
  const response: ApiResponse = { success: false, message, errors };
  return res.status(statusCode).json(response);
};

export const sendNotFound = (res: Response, entity = 'Resource'): Response =>
  sendError(res, `${entity} not found`, 404);

export const sendUnauthorized = (res: Response, message = 'Unauthorized'): Response =>
  sendError(res, message, 401);

export const sendForbidden = (res: Response, message = 'Forbidden — insufficient permissions'): Response =>
  sendError(res, message, 403);

export const sendBadRequest = (res: Response, message: string, errors?: string[]): Response =>
  sendError(res, message, 400, errors);

export const sendPaginated = <T>(
  res: Response,
  result: PaginatedResult<T>,
  message = 'Success'
): Response => {
  const { total, page, limit, totalPages } = result;
  return sendSuccess(res, result, message, 200, { total, page, limit, totalPages });
};

/**
 * Build pagination params from query string
 */
export const getPaginationParams = (
  query: Record<string, unknown>
): { page: number; limit: number; offset: number } => {
  const page = Math.max(1, parseInt(String(query.page || '1'), 10));
  const limit = Math.min(100, Math.max(1, parseInt(String(query.limit || '20'), 10)));
  const offset = (page - 1) * limit;
  return { page, limit, offset };
};

/**
 * Build a slug from a string
 */
export const slugify = (text: string): string =>
  text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');

/**
 * Generate a human-readable order number
 */
export const generateOrderNumber = (): string => {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `JR-${timestamp}-${random}`;
};
