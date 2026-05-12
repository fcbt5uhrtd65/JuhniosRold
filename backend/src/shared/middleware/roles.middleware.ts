import { Request, Response, NextFunction } from 'express';
import { UserRole } from '../types';
import { sendForbidden, sendUnauthorized } from '../utils/response';

// ============================================================
// Role-Based Authorization Middleware — Juhnios Rold Backend
// ============================================================

/**
 * Middleware factory: restricts access to users with the specified roles
 * Usage: router.get('/admin', authenticate, authorize(UserRole.ADMIN), handler)
 */
export const authorize = (...allowedRoles: UserRole[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      sendUnauthorized(res, 'Authentication required');
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      sendForbidden(
        res,
        `Access denied — required roles: ${allowedRoles.join(', ')}`
      );
      return;
    }

    next();
  };
};

/**
 * Middleware: only ADMIN role
 */
export const adminOnly = authorize(UserRole.ADMIN);

/**
 * Middleware: ADMIN or PRO users
 */
export const adminOrPro = authorize(UserRole.ADMIN, UserRole.PRO);

/**
 * Middleware: ADMIN, SELLER, or DISTRIBUTOR
 */
export const staffOnly = authorize(
  UserRole.ADMIN,
  UserRole.SELLER,
  UserRole.DISTRIBUTOR
);

/**
 * Middleware: resource owner or admin
 * Checks that req.user.userId === req.params.userId OR user is ADMIN
 */
export const ownerOrAdmin = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (!req.user) {
    sendUnauthorized(res, 'Authentication required');
    return;
  }

  const targetId = req.params.userId || req.params.id;
  const isOwner = req.user.userId === targetId;
  const isAdmin = req.user.role === UserRole.ADMIN;

  if (!isOwner && !isAdmin) {
    sendForbidden(res, 'You can only access your own resources');
    return;
  }

  next();
};
