import { Request, Response, NextFunction } from 'express';
import { AuthService } from './auth.service';
import { sendSuccess, sendCreated } from '../../shared/utils/response';

// ============================================================
// Auth Controller — HTTP layer for authentication
// ============================================================

const authService = new AuthService();

/**
 * POST /api/auth/register
 * Public — create a new CLIENT account
 */
export const register = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const result = await authService.register(req.body);
    sendCreated(res, result, 'Registration successful — welcome to Juhnios Rold!');
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/auth/login
 * Public — authenticate and receive tokens
 */
export const login = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const result = await authService.login(req.body);
    sendSuccess(res, result, 'Login successful');
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/auth/refresh
 * Public — exchange refresh token for new access token
 */
export const refreshToken = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { refreshToken: token } = req.body;
    const tokens = await authService.refreshTokens(token);
    sendSuccess(res, tokens, 'Token refreshed successfully');
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/auth/me
 * Protected — get current authenticated user
 */
export const me = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = await authService.me(req.user!.userId);
    sendSuccess(res, user, 'Current user fetched successfully');
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/auth/logout
 * Protected - revokes the provided refresh token, or all active tokens for the user.
 */
export const logout = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    await authService.logout(req.user!.userId, req.body?.refreshToken);
    sendSuccess(res, null, 'Logged out successfully');
  } catch (err) {
    next(err);
  }
};
