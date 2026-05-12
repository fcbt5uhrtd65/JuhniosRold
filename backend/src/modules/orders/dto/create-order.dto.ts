import { body } from 'express-validator';

// ============================================================
// Order DTOs — Orders Module
// ============================================================

export const createOrderDto = [
  body('items')
    .isArray({ min: 1 })
    .withMessage('Order must contain at least one item'),

  body('items.*.product_id')
    .isUUID()
    .withMessage('Each item must have a valid product ID'),

  body('items.*.quantity')
    .isInt({ min: 1 })
    .withMessage('Quantity must be at least 1'),

  body('shipping_address')
    .notEmpty()
    .withMessage('Shipping address is required'),

  body('shipping_address.full_name')
    .trim()
    .notEmpty()
    .withMessage('Full name is required in shipping address'),

  body('shipping_address.address_line1')
    .trim()
    .notEmpty()
    .withMessage('Address line 1 is required'),

  body('shipping_address.city')
    .trim()
    .notEmpty()
    .withMessage('City is required'),

  body('shipping_address.department')
    .trim()
    .notEmpty()
    .withMessage('Department is required'),

  body('shipping_address.phone')
    .trim()
    .notEmpty()
    .withMessage('Phone is required in shipping address'),

  body('shipping_address.country')
    .optional()
    .trim()
    .default('Colombia'),

  body('payment_method')
    .trim()
    .notEmpty()
    .withMessage('Payment method is required')
    .isIn(['credit_card', 'debit_card', 'nequi', 'daviplata', 'pse', 'cash_on_delivery', 'bancolombia'])
    .withMessage('Invalid payment method'),

  body('notes')
    .optional()
    .trim()
    .isLength({ max: 500 }),
];

export const updateOrderStatusDto = [
  body('status')
    .isIn(['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'])
    .withMessage('Invalid order status'),

  body('payment_status')
    .optional()
    .isIn(['pending', 'paid', 'failed', 'refunded'])
    .withMessage('Invalid payment status'),

  body('payment_reference')
    .optional()
    .trim()
    .isLength({ max: 255 }),

  body('notes')
    .optional()
    .trim()
    .isLength({ max: 500 }),
];
