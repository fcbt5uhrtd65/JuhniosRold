import { body, param } from 'express-validator';

// ============================================================
// User DTOs — Users Module
// ============================================================

export const updateUserDto = [
  body('first_name')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('First name cannot be empty')
    .isLength({ max: 100 }),

  body('last_name')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Last name cannot be empty')
    .isLength({ max: 100 }),

  body('phone')
    .optional()
    .trim()
    .matches(/^[+\d\s()-]{7,20}$/)
    .withMessage('Invalid phone number format'),

  body('avatar_url')
    .optional()
    .isURL()
    .withMessage('Avatar must be a valid URL'),
];

export const changePasswordDto = [
  body('current_password')
    .notEmpty()
    .withMessage('Current password is required'),

  body('new_password')
    .isLength({ min: 8 })
    .withMessage('New password must be at least 8 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain uppercase, lowercase, and a number'),
];

export const adminUpdateUserDto = [
  ...updateUserDto,
  body('role')
    .optional()
    .isIn(['ADMIN', 'PRO', 'SELLER', 'DISTRIBUTOR', 'CLIENT'])
    .withMessage('Invalid role'),

  body('is_active')
    .optional()
    .isBoolean()
    .withMessage('is_active must be boolean'),
];

export const uuidParamDto = [
  param('id')
    .isUUID()
    .withMessage('Invalid user ID format'),
];
