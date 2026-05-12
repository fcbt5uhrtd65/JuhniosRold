import { Router } from 'express';
import {
  getAllOrders,
  getOrderStats,
  getOrderById,
  createOrder,
  updateOrderStatus,
  cancelOrder,
} from './order.controller';
import { createOrderDto, updateOrderStatusDto } from './dto/create-order.dto';
import { validate } from '../../shared/middleware/validate.middleware';
import { authenticate } from '../../shared/middleware/auth.middleware';
import { adminOnly, authorize } from '../../shared/middleware/roles.middleware';
import { UserRole } from '../../shared/types';

// ============================================================
// Order Routes — /api/orders
// ============================================================

const router = Router();

// All order routes require authentication
router.use(authenticate);

/**
 * @route   GET /api/orders
 * @desc    List orders (Admin: all; Client: own)
 * @access  Private
 */
router.get('/', getAllOrders);

/**
 * @route   GET /api/orders/stats
 * @desc    Order statistics for admin dashboard
 * @access  Admin
 */
router.get('/stats', adminOnly, getOrderStats);

/**
 * @route   GET /api/orders/:id
 * @desc    Get order details with items
 * @access  Owner or Admin
 */
router.get('/:id', getOrderById);

/**
 * @route   POST /api/orders
 * @desc    Create a new order (checkout)
 * @access  Private (authenticated users)
 */
router.post('/', createOrderDto, validate, createOrder);

/**
 * @route   PATCH /api/orders/:id/status
 * @desc    Update order/payment status
 * @access  Admin
 */
router.patch('/:id/status', authorize(UserRole.ADMIN, UserRole.SELLER), updateOrderStatusDto, validate, updateOrderStatus);

/**
 * @route   POST /api/orders/:id/cancel
 * @desc    Cancel own order (if pending/confirmed)
 * @access  Owner or Admin
 */
router.post('/:id/cancel', cancelOrder);

export default router;
