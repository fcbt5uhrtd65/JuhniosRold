import jwt from 'jsonwebtoken';
import { env } from '../../config/env';
import { JwtPayload, UserRole } from '../types';

// ============================================================
// JWT Utilities — Juhnios Rold Backend
// ============================================================

/**
 * Sign an access token (short-lived)
 */
export const signAccessToken = (payload: Omit<JwtPayload, 'iat' | 'exp'>): string => {
  return jwt.sign(payload, env.JWT.SECRET, {
    expiresIn: env.JWT.EXPIRES_IN as string,
  } as jwt.SignOptions);
};

/**
 * Sign a refresh token (long-lived)
 */
export const signRefreshToken = (payload: Omit<JwtPayload, 'iat' | 'exp'>): string => {
  return jwt.sign(payload, env.JWT.REFRESH_SECRET, {
    expiresIn: env.JWT.REFRESH_EXPIRES_IN as string,
  } as jwt.SignOptions);
};

/**
 * Verify and decode an access token
 */
export const verifyAccessToken = (token: string): JwtPayload => {
  return jwt.verify(token, env.JWT.SECRET) as JwtPayload;
};

/**
 * Verify and decode a refresh token
 */
export const verifyRefreshToken = (token: string): JwtPayload => {
  return jwt.verify(token, env.JWT.REFRESH_SECRET) as JwtPayload;
};

/**
 * Generate both access and refresh tokens for a user
 */
export const generateTokenPair = (
  userId: string,
  email: string,
  role: UserRole
): { accessToken: string; refreshToken: string } => {
  const payload: Omit<JwtPayload, 'iat' | 'exp'> = { userId, email, role };
  return {
    accessToken: signAccessToken(payload),
    refreshToken: signRefreshToken(payload),
  };
};
