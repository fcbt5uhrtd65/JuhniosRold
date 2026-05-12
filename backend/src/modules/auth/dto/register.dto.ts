import { body } from 'express-validator';

// ============================================================
// Register DTO — Auth Module
// ============================================================

export const registerDto = [
  body('email')
    .isEmail()
    .withMessage('Must be a valid email address')
    .normalizeEmail()
    .toLowerCase(),

  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain uppercase, lowercase, and a number'),

  body('first_name')
    .trim()
    .notEmpty()
    .withMessage('First name is required')
    .isLength({ max: 100 })
    .withMessage('First name cannot exceed 100 characters'),

  body('last_name')
    .optional({ values: 'falsy' })
    .trim()
    .isLength({ max: 100 })
    .withMessage('Last name cannot exceed 100 characters'),

  body('phone')
    .optional()
    .trim()
    .matches(/^[+\d\s()-]{7,20}$/)
    .withMessage('Invalid phone number format'),
];
