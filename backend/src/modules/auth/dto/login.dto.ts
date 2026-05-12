import { body } from 'express-validator';

// ============================================================
// Login DTO — Auth Module
// ============================================================

export const loginDto = [
  body('email')
    .isEmail()
    .withMessage('Must be a valid email address')
    .normalizeEmail()
    .toLowerCase(),

  body('password')
    .notEmpty()
    .withMessage('Password is required'),
];

export const refreshTokenDto = [
  body('refreshToken')
    .notEmpty()
    .withMessage('Refresh token is required'),
];
