import { body, param } from 'express-validator';

export const stockParamDto = [
  param('productId').isUUID().withMessage('Invalid product ID'),
];

export const updateInventoryStockDto = [
  ...stockParamDto,
  body('stock')
    .isInt({ min: 0 })
    .withMessage('Stock must be a non-negative integer'),
  body('reason').optional().trim().isLength({ max: 255 }),
];

export const createInventoryMovementDto = [
  body('product_id').isUUID().withMessage('Invalid product ID'),
  body('type')
    .isIn(['adjustment', 'in', 'out', 'sale', 'return'])
    .withMessage('Invalid movement type'),
  body('quantity')
    .isInt({ min: 1 })
    .withMessage('Quantity must be at least 1'),
  body('reason').optional().trim().isLength({ max: 255 }),
];
