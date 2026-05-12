import { body, param } from 'express-validator';
import { BusinessType } from '../../../shared/types';

// ============================================================
// PRO Module DTOs
// ============================================================

const businessTypes = Object.values(BusinessType);

export const requestProDto = [
  body('business_name')
    .trim()
    .notEmpty()
    .withMessage('Business name is required')
    .isLength({ max: 200 }),

  body('business_type')
    .isIn(businessTypes)
    .withMessage(`Business type must be one of: ${businessTypes.join(', ')}`),

  body('nit')
    .optional()
    .trim()
    .matches(/^\d{9}-\d$/)
    .withMessage('NIT format: 123456789-0'),

  body('tax_id')
    .optional()
    .trim()
    .isLength({ max: 50 }),

  body('message')
    .optional()
    .trim()
    .isLength({ max: 500 }),

  body('city')
    .trim()
    .notEmpty()
    .withMessage('City is required'),

  body('department')
    .trim()
    .notEmpty()
    .withMessage('Department is required'),

  body('website_url')
    .optional()
    .isURL()
    .withMessage('Website must be a valid URL'),

  body('social_media')
    .optional()
    .isObject()
    .withMessage('Social media must be an object'),
];

export const approveProDto = [
  param('id').isUUID().withMessage('Invalid profile ID'),

  body('discount_percentage')
    .optional()
    .isFloat({ min: 0, max: 50 })
    .withMessage('Discount must be between 0 and 50%'),

  body('priority_shipping')
    .optional()
    .isBoolean(),

  body('early_access')
    .optional()
    .isBoolean(),

  body('benefits')
    .optional()
    .isObject(),
];

export const rejectProDto = [
  param('id').isUUID().withMessage('Invalid profile ID'),

  body('reason')
    .trim()
    .notEmpty()
    .withMessage('Rejection reason is required')
    .isLength({ max: 500 }),
];
