import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { env } from '../../config/env';

// ============================================================
// Password Hashing Utilities — Juhnios Rold Backend
// ============================================================

/**
 * Hash a plain-text password using bcrypt
 */
export const hashPassword = async (password: string): Promise<string> => {
  const salt = await bcrypt.genSalt(env.BCRYPT_ROUNDS);
  return bcrypt.hash(password, salt);
};

/**
 * Compare a plain-text password against a bcrypt hash
 */
export const comparePassword = async (
  password: string,
  hash: string
): Promise<boolean> => {
  return bcrypt.compare(password, hash);
};

export const hashToken = (token: string): string =>
  crypto.createHash('sha256').update(token).digest('hex');
