import { body } from 'express-validator';
import { ProductCategory } from '../../../shared/types';

// ============================================================
// Update Product DTO — Products Module (all fields optional)
// ============================================================

const categories = Object.values(ProductCategory);

export const updateProductDto = [
  body('name').optional().trim().notEmpty().isLength({ max: 200 }),
  body('description').optional().trim().notEmpty(),
  body('short_description').optional().trim().isLength({ max: 500 }),
  body('category').optional().isIn(categories).withMessage(`Invalid category`),
  body('type').optional().trim().isLength({ max: 100 }),
  body('presentation').optional().trim().isLength({ max: 100 }),
  body('price').optional().isFloat({ min: 0 }),
  body('wholesale_price').optional().isFloat({ min: 0 }),
  body('pro_price').optional().isFloat({ min: 0 }),
  body('stock').optional().isInt({ min: 0 }),
  body('min_stock').optional().isInt({ min: 0 }),
  body('location').optional().trim().isLength({ max: 120 }),
  body('lot').optional().trim().isLength({ max: 120 }),
  body('sku').optional().trim().isLength({ max: 100 }),
  body('image_url').optional().isURL(),
  body('images').optional().isArray(),
  body('images.*').optional().isURL(),
  body('ingredients').optional().isArray(),
  body('benefits').optional().isArray(),
  body('how_to_use').optional().trim(),
  body('weight_ml').optional().isInt({ min: 1 }),
  body('is_active').optional().isBoolean(),
  body('is_featured').optional().isBoolean(),
  body('active').optional().isBoolean(),
  body('featured').optional().isBoolean(),
  body('tags').optional().isArray(),
];

export const updateStockDto = [
  body('quantity')
    .optional()
    .isInt()
    .withMessage('Quantity must be an integer (positive to add, negative to subtract)'),

  body('stock')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Stock must be a non-negative integer'),

  body('reason')
    .optional()
    .trim()
    .isLength({ max: 255 }),
];
