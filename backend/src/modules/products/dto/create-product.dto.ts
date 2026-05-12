import { body } from 'express-validator';
import { ProductCategory } from '../../../shared/types';

// ============================================================
// Create Product DTO — Products Module
// ============================================================

const categories = Object.values(ProductCategory);

export const createProductDto = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Product name is required')
    .isLength({ max: 200 }),

  body('description')
    .trim()
    .notEmpty()
    .withMessage('Product description is required'),

  body('short_description')
    .optional()
    .trim()
    .isLength({ max: 500 }),

  body('category')
    .isIn(categories)
    .withMessage(`Category must be one of: ${categories.join(', ')}`),

  body('type').optional().trim().isLength({ max: 100 }),

  body('presentation').optional().trim().isLength({ max: 100 }),

  body('price')
    .isFloat({ min: 0 })
    .withMessage('Price must be a positive number'),

  body('pro_price')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('PRO price must be a positive number'),

  body('wholesale_price')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Wholesale price must be a positive number'),

  body('stock')
    .isInt({ min: 0 })
    .withMessage('Stock must be a non-negative integer'),

  body('min_stock')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Minimum stock must be a non-negative integer'),

  body('location').optional().trim().isLength({ max: 120 }),

  body('lot').optional().trim().isLength({ max: 120 }),

  body('sku')
    .optional()
    .trim()
    .isLength({ max: 100 }),

  body('images')
    .optional()
    .isArray()
    .withMessage('Images must be an array'),

  body('images.*')
    .optional()
    .isURL()
    .withMessage('Each image must be a valid URL'),

  body('image_url')
    .optional()
    .isURL()
    .withMessage('Image URL must be a valid URL'),

  body('ingredients')
    .optional()
    .isArray()
    .withMessage('Ingredients must be an array'),

  body('benefits')
    .optional()
    .isArray()
    .withMessage('Benefits must be an array'),

  body('how_to_use')
    .optional()
    .trim(),

  body('weight_ml')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Weight must be a positive integer (ml)'),

  body('is_featured')
    .optional()
    .isBoolean(),

  body('active')
    .optional()
    .isBoolean(),

  body('featured')
    .optional()
    .isBoolean(),

  body('tags')
    .optional()
    .isArray(),
];
