import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import { sendBadRequest } from '../utils/response';

// ============================================================
// Express-Validator Middleware — Juhnios Rold Backend
// Collects validation errors and returns 400 if any
// ============================================================

export const validate = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map((e) => e.msg as string);
    sendBadRequest(res, 'Validation failed', errorMessages);
    return;
  }
  next();
};
