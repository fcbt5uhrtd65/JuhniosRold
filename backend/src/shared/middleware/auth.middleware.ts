import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/jwt.utils';
import { sendUnauthorized } from '../utils/response';

// ============================================================
// Authentication Middleware — Juhnios Rold Backend
// Verifies JWT token on every protected route
// ============================================================

export const authenticate = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      sendUnauthorized(res, 'No authorization token provided');
      return;
    }

    const token = authHeader.split(' ')[1];

    if (!token) {
      sendUnauthorized(res, 'Malformed authorization header');
      return;
    }

    const decoded = verifyAccessToken(token);
    req.user = decoded;
    next();
  } catch (error: unknown) {
    if (error instanceof Error) {
      if (error.name === 'TokenExpiredError') {
        sendUnauthorized(res, 'Token has expired — please log in again');
        return;
      }
      if (error.name === 'JsonWebTokenError') {
        sendUnauthorized(res, 'Invalid token');
        return;
      }
    }
    sendUnauthorized(res, 'Authentication failed');
  }
};

/**
 * Optional auth — attaches user if token is present but doesn't block if not
 */
export const optionalAuthenticate = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      if (token) {
        req.user = verifyAccessToken(token);
      }
    }
  } catch {
    // Silently ignore invalid tokens for optional auth
  }
  next();
};
